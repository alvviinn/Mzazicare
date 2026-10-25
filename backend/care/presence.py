"""Geofence presence engine.

The geofence is centred on the ELDER's phone: the caretaker is "in range" when their phone is within
ENTER_RADIUS_M of it. Time is only counted while in range (ShiftSegment rows), so manual start/stop
still produces verified hours.

A shift is one DAY of work for one caretaker with one elderly person. Stepping out of range is a *break*:
the shift stays open, the timer stops, and when the caretaker comes back the same shift continues. Only a
new calendar day (Nairobi time) starts a new shift.
"""

from datetime import datetime, time, timedelta
from math import asin, cos, radians, sin, sqrt

from django.db import transaction
from django.utils import timezone

from accounts.models import Role, User

from .models import Chore, Location, Shift, ShiftSegment
from .tasks import visible_tasks

ENTER_RADIUS_M = 15  # within this distance the caretaker is verified as present
EXIT_RADIUS_M = 20  # once inside, the caretaker only counts as gone beyond this (stops GPS jitter flapping the timer)
FRESH_S = 120  # a location older than this is ignored
MAX_ACCURACY_M = 40  # fixes less accurate than this can't be trusted for a 15 m check
STALE_PAUSE_S = 180  # no usable fix for this long -> a break starts at the last time they were seen in range
MERGE_GAP_S = 120  # coming back within this long of leaving is GPS noise, not a break: no new segment
AWAY_AFTER_MIN = 90  # on a break this long the screens say "away" (it is still the same shift)


def haversine_m(lat1, lon1, lat2, lon2):
    p1, p2 = radians(lat1), radians(lat2)
    a = sin((p2 - p1) / 2) ** 2 + cos(p1) * cos(p2) * sin(radians(lon2 - lon1) / 2) ** 2
    return 2 * 6371000 * asin(sqrt(a))


def measure(a, b, now, radius):
    """Compare two phones. Returns ('in' | 'out' | 'unknown', distance_m or None)."""
    for loc in (a, b):
        if loc is None or loc.mocked or (now - loc.updated_at).total_seconds() > FRESH_S:
            return 'unknown', None
        if (loc.accuracy or 0) > MAX_ACCURACY_M:
            return 'unknown', None
    d = haversine_m(a.latitude, a.longitude, b.latitude, b.longitude)
    return ('in' if d <= radius else 'out'), d


# ---- reading a shift: active time, breaks, phase ----


def day_start(now=None):
    """Midnight (Nairobi time) at the start of the day containing `now`."""
    return timezone.make_aware(datetime.combine(timezone.localdate(now), time.min))


def segments_of(shift):
    return list(shift.segments.all())  # ordered by start


def worked_seconds(shift, now=None):
    now = now or timezone.now()
    return sum(max(0, int(((s.end or now) - s.start).total_seconds())) for s in segments_of(shift))


def worked_minutes(shift, now=None):
    return worked_seconds(shift, now) // 60


def open_segment(shift):
    return shift.segments.filter(end__isnull=True).first()


def breaks_of(shift, now=None):
    """Periods the caretaker was out of range during the day: [(start, end or None if still on it)]."""
    segs = segments_of(shift)
    out = [(a.end, b.start) for a, b in zip(segs, segs[1:]) if a.end]
    if segs and shift.end_time is None and segs[-1].end is not None:
        out.append((segs[-1].end, None))
    return out


def break_minutes(shift, now=None):
    now = now or timezone.now()
    return sum(max(0, int(((end or now) - start).total_seconds())) for start, end in breaks_of(shift, now)) // 60


def arrived_at(shift):
    segs = segments_of(shift)
    return segs[0].start if segs else None


def left_at(shift):
    """When the caretaker last left range (None while they are still there, or never arrived)."""
    segs = segments_of(shift)
    return segs[-1].end if segs and segs[-1].end else None


def phase_of(shift, now=None):
    """'waiting' (opened, not arrived yet), 'active', 'break', 'away' (a long break), or 'ended' (day closed)."""
    now = now or timezone.now()
    if shift.end_time is not None:
        return 'ended'
    segs = segments_of(shift)
    if not segs:
        return 'waiting'
    if segs[-1].end is None:
        return 'active'
    return 'away' if now - segs[-1].end > timedelta(minutes=AWAY_AFTER_MIN) else 'break'


def snapshot_tasks(shift):
    """Copy the caretaker's to-do list into the shift so completion can be reported per visit."""
    for t in visible_tasks(shift.caretaker):
        Chore.objects.create(shift=shift, task=t, description=t.title, is_done=t.is_done, done_at=t.done_at)


# ---- changing a shift ----


def _resume(shift, at):
    """The caretaker is (back) in range at `at`: continue the shift."""
    shift.last_in_range_at = at
    shift.save(update_fields=['last_in_range_at'])
    last = shift.segments.exclude(end__isnull=True).order_by('-end').first()
    if last and (at - last.end).total_seconds() <= MERGE_GAP_S:
        last.end = None  # a flicker of a few seconds is not a break: carry on the same segment
        last.save(update_fields=['end'])
    else:
        ShiftSegment.objects.create(shift=shift, start=at)


def _reopen(shift):
    """A shift that was ended earlier today continues (the caretaker came back, or tapped Start)."""
    shift.end_time = None
    shift.ended_by = ''
    shift.rearmed = False
    shift.save(update_fields=['end_time', 'ended_by', 'rearmed'])


def _end(shift, by, at=None):
    """Close the shift. Time already counted is kept; an empty shift is discarded. Returns False if discarded."""
    seg = open_segment(shift)
    if seg:
        seg.end = max(at, seg.start)
        seg.save(update_fields=['end'])
    if not shift.segments.exists():
        shift.delete()  # the caretaker never reached the elder: nothing worth keeping
        return False
    shift.end_time = left_at(shift) or shift.start_time
    shift.ended_by = by
    shift.rearmed = False
    shift.save(update_fields=['end_time', 'ended_by', 'rearmed'])
    return True


def _close_previous_days(caretaker, now):
    """A shift belongs to one day. Close any left open from an earlier day.

    Returns (elder, midnight) if the caretaker was still counting at midnight, so today's shift can carry on
    from 00:00 without losing minutes.
    """
    midnight = day_start(now)
    carry = None
    for s in Shift.objects.filter(caretaker=caretaker, is_demo=False, end_time__isnull=True, start_time__lt=midnight):
        seg = open_segment(s)
        if seg:
            last_seen = s.last_in_range_at or seg.start
            still_there = last_seen >= midnight - timedelta(seconds=STALE_PAUSE_S)
            seg.end = max(midnight if still_there else last_seen, seg.start)
            seg.save(update_fields=['end'])
            if still_there:
                carry = (s.elderly, midnight)
        _end(s, 'auto', None)
    return carry


def current_shift(caretaker, now=None):
    """Today's shift that is still open (counting, or on a break), preferring the one being counted."""
    now = now or timezone.now()
    shifts = list(
        Shift.objects.filter(caretaker=caretaker, is_demo=False, end_time__isnull=True, start_time__gte=day_start(now))
        .select_related('elderly').order_by('-start_time')
    )
    return next((s for s in shifts if open_segment(s)), shifts[0] if shifts else None)


def todays_shifts(caretaker, now=None):
    """Every shift today, including one that was ended manually."""
    now = now or timezone.now()
    return list(
        Shift.objects.filter(caretaker=caretaker, is_demo=False, start_time__gte=day_start(now))
        .select_related('elderly').order_by('-start_time')
    )


@transaction.atomic
def evaluate(caretaker, now=None):
    """Bring this caretaker's shift for today in line with the latest locations. Safe to call at any time."""
    now = now or timezone.now()
    caretaker = User.objects.select_for_update().get(pk=caretaker.pk)
    if caretaker.role != Role.CARETAKER or not caretaker.sponsor_id:
        return None

    carry = _close_previous_days(caretaker, now)
    cloc = Location.objects.filter(user=caretaker).first()
    shifts = todays_shifts(caretaker, now)

    # 1. A shift is being counted right now: keep going, or start a break.
    for s in shifts:
        seg = open_segment(s)
        if seg:
            state, _ = measure(cloc, Location.objects.filter(user=s.elderly).first(), now, EXIT_RADIUS_M)
            if state == 'in':
                s.last_in_range_at = now
                s.save(update_fields=['last_in_range_at'])
            else:
                gone = state == 'out'
                stale = state == 'unknown' and (now - (s.last_in_range_at or seg.start)).total_seconds() > STALE_PAUSE_S
                if gone or stale:
                    seg.end = max(s.last_in_range_at or now, seg.start)  # the break began when last seen in range
                    seg.save(update_fields=['end'])
            return current_shift(caretaker, now)

    # 2. Not counting. Is the caretaker now near an elderly person?
    elders = list(User.objects.filter(sponsor_id=caretaker.sponsor_id, role=Role.ELDERLY))
    readings = [(e, *measure(cloc, Location.objects.filter(user=e).first(), now, ENTER_RADIUS_M)) for e in elders]
    near = sorted((d, e.pk, e) for e, s, d in readings if s == 'in')
    if near:
        elder = near[0][2]
        start_at = carry[1] if carry and carry[0].pk == elder.pk else now  # carry on from midnight if they never left
        shift = next((s for s in shifts if s.elderly_id == elder.pk), None)
        if shift is None:
            shift = Shift.objects.create(
                caretaker=caretaker, elderly=elder, start_time=start_at, source='auto', last_in_range_at=start_at
            )
            ShiftSegment.objects.create(shift=shift, start=start_at)
            snapshot_tasks(shift)
        elif shift.end_time is None:
            _resume(shift, now)  # back from a break: the same shift continues
        elif shift.ended_by != 'manual' or shift.rearmed:
            _reopen(shift)  # the day was closed, but the caretaker has come back: same day, same shift
            _resume(shift, now)
        # else: ended manually and the caretaker has not left range since: stay ended until they leave and return
        return current_shift(caretaker, now)

    # 3. Not near anyone. If a manual End was tapped, the next arrival may continue today's shift.
    if readings and all(s == 'out' for _, s, _ in readings):
        for s in shifts:
            if s.ended_by == 'manual' and not s.rearmed:
                s.rearmed = True
                s.save(update_fields=['rearmed'])
    return current_shift(caretaker, now)


def start_manual(caretaker, now=None):
    """Caretaker taps Start. Today's shift opens (or continues), but only in-range time is counted."""
    now = now or timezone.now()
    elders = list(User.objects.filter(sponsor_id=caretaker.sponsor_id, role=Role.ELDERLY).order_by('date_joined'))
    if not elders:
        raise ValueError('No elderly person is linked to you yet.')
    if evaluate(caretaker, now):
        raise ValueError('A shift is already running.')

    cloc = Location.objects.filter(user=caretaker).first()
    ranked = []
    for e in elders:
        _, d = measure(cloc, Location.objects.filter(user=e).first(), now, ENTER_RADIUS_M)
        ranked.append((d if d is not None else float('inf'), e.pk, e))
    elder = min(ranked)[2]

    earlier = next((s for s in todays_shifts(caretaker, now) if s.elderly_id == elder.pk), None)
    if earlier:
        _reopen(earlier)  # tapped Start after ending earlier today: carry on today's shift
    else:
        shift = Shift.objects.create(caretaker=caretaker, elderly=elder, start_time=now, source='manual')
        snapshot_tasks(shift)
    return evaluate(caretaker, now)


def stop_manual(caretaker, now=None):
    """Caretaker taps End: finished for now. If they come back the same day, the same shift continues."""
    now = now or timezone.now()
    shift = evaluate(caretaker, now)  # settle the segment first so the final minutes are right
    if not shift:
        raise ValueError('No shift is running.')
    _end(shift, 'manual', now)


def current_reading(caretaker, shift, now=None):
    """What the caretaker's screen shows about range: (state, distance_m, elder, elder_sharing)."""
    now = now or timezone.now()
    cloc = Location.objects.filter(user=caretaker).first()
    if shift:
        elders = [shift.elderly]
    else:
        elders = list(User.objects.filter(sponsor_id=caretaker.sponsor_id, role=Role.ELDERLY).order_by('date_joined'))
    best = None
    for e in elders:
        eloc = Location.objects.filter(user=e).first()
        state, d = measure(cloc, eloc, now, ENTER_RADIUS_M)
        sharing = eloc is not None and not eloc.mocked and (now - eloc.updated_at).total_seconds() <= FRESH_S
        key = d if d is not None else float('inf')
        if best is None or key < best[0]:
            best = (key, state, d, e, sharing)
    if not best:
        return 'unknown', None, None, False
    return best[1], best[2], best[3], best[4]
