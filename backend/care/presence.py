"""Geofence presence engine.

The geofence is centred on the ELDER's phone: the caretaker is "in range" when their phone is within
ENTER_RADIUS_M of it. Time is only counted while in range (ShiftSegment rows), so manual start/stop
still produces verified hours.
"""

from datetime import timedelta
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
STALE_PAUSE_S = 180  # no usable fix for this long -> pause at the last time they were seen in range
AUTO_END_MIN = 90  # paused this long -> the shift is closed automatically
MANUAL_BLOCK_H = 8  # after a manual stop, don't auto-restart until the caretaker leaves range (or this long passes)


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


def worked_seconds(shift, now=None):
    now = now or timezone.now()
    return sum(max(0, int(((s.end or now) - s.start).total_seconds())) for s in shift.segments.all())


def worked_minutes(shift, now=None):
    return worked_seconds(shift, now) // 60


def open_segment(shift):
    return shift.segments.filter(end__isnull=True).first()


def snapshot_tasks(shift):
    """Copy the caretaker's to-do list into the shift so completion can be reported per visit."""
    for t in visible_tasks(shift.caretaker):
        Chore.objects.create(shift=shift, task=t, description=t.title, is_done=t.is_done, done_at=t.done_at)


def _end(shift, by, at):
    seg = open_segment(shift)
    if seg:
        seg.end = max(at, seg.start)
        seg.save(update_fields=['end'])
    if by == 'auto' and not shift.segments.exists():
        shift.delete()  # the caretaker never reached the elder: nothing worth keeping
        return
    shift.end_time = max(at, shift.start_time)
    shift.ended_by = by
    shift.save(update_fields=['end_time', 'ended_by'])


@transaction.atomic
def evaluate(caretaker, now=None):
    """Bring this caretaker's shift in line with the latest locations. Safe to call at any time."""
    now = now or timezone.now()
    caretaker = User.objects.select_for_update().get(pk=caretaker.pk)
    if caretaker.role != Role.CARETAKER or not caretaker.sponsor_id:
        return None

    cloc = Location.objects.filter(user=caretaker).first()
    shift = (
        Shift.objects.filter(caretaker=caretaker, end_time__isnull=True, is_demo=False)
        .select_related('elderly')
        .first()
    )
    if shift is None:
        _maybe_auto_start(caretaker, cloc, now)
        return Shift.objects.filter(caretaker=caretaker, end_time__isnull=True, is_demo=False).first()

    seg = open_segment(shift)
    eloc = Location.objects.filter(user=shift.elderly).first()
    state, _ = measure(cloc, eloc, now, EXIT_RADIUS_M if seg else ENTER_RADIUS_M)

    if state == 'in':
        shift.last_in_range_at = now
        shift.save(update_fields=['last_in_range_at'])
        if not seg:
            ShiftSegment.objects.create(shift=shift, start=now)
    elif seg:
        gone = state == 'out'
        stale = state == 'unknown' and (now - (shift.last_in_range_at or shift.start_time)).total_seconds() > STALE_PAUSE_S
        if gone or stale:
            seg.end = max(shift.last_in_range_at or now, seg.start)
            seg.save(update_fields=['end'])

    if not open_segment(shift):
        last_end = shift.segments.exclude(end__isnull=True).order_by('-end').values_list('end', flat=True).first()
        paused_since = last_end or shift.start_time
        if now - paused_since > timedelta(minutes=AUTO_END_MIN):
            _end(shift, 'auto', paused_since)
            return None
    return shift


def _maybe_auto_start(caretaker, cloc, now):
    elders = list(User.objects.filter(sponsor_id=caretaker.sponsor_id, role=Role.ELDERLY))
    readings = []
    for e in elders:
        state, d = measure(cloc, Location.objects.filter(user=e).first(), now, ENTER_RADIUS_M)
        readings.append((e, state, d))

    last = Shift.objects.filter(caretaker=caretaker, is_demo=False).order_by('-start_time').first()
    blocked = (
        last is not None
        and last.ended_by == 'manual'
        and not last.rearmed
        and last.end_time is not None
        and now - last.end_time < timedelta(hours=MANUAL_BLOCK_H)
    )
    if blocked:
        if readings and all(s == 'out' for _, s, _ in readings):
            last.rearmed = True  # the caretaker has left, so the next arrival may start a shift again
            last.save(update_fields=['rearmed'])
        return

    near = sorted((d, e.pk, e) for e, s, d in readings if s == 'in')
    if near:
        elder = near[0][2]
        shift = Shift.objects.create(
            caretaker=caretaker, elderly=elder, start_time=now, source='auto', last_in_range_at=now
        )
        ShiftSegment.objects.create(shift=shift, start=now)
        snapshot_tasks(shift)


def start_manual(caretaker, now=None):
    """Caretaker taps Start. The shift opens now, but only in-range time is counted."""
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

    shift = Shift.objects.create(caretaker=caretaker, elderly=elder, start_time=now, source='manual')
    snapshot_tasks(shift)
    return evaluate(caretaker, now)


def stop_manual(caretaker, now=None):
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
