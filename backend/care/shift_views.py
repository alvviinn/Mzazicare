"""Shift summaries, the shift list and the shift detail (timeline of arrivals, breaks and departures).

A shift is one caretaker's day with one elderly person. Both the caretaker and the family may open it.
"""

from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role

from . import presence
from .models import Shift

# phase -> the status word the apps show
STATUS = {'active': 'on_shift', 'break': 'paused', 'away': 'away', 'waiting': 'waiting', 'ended': 'ended'}
MAX_LIST_DAYS = 90


def iso(dt):
    return dt.isoformat() if dt else None


def shift_status(shift, now=None):
    return STATUS[presence.phase_of(shift, now)]


def shift_card(s, now=None):
    """One shift (one day) as a short summary, used in every list."""
    now = now or timezone.now()
    chores = list(s.chores.all())
    arrived = presence.arrived_at(s)
    return {
        'id': s.pk,
        'date': timezone.localtime(s.start_time).date().isoformat(),
        'caretaker': s.caretaker.name,
        'elderly': s.elderly.name,
        'start': iso(arrived or s.start_time),  # first arrival (or when it was opened, if never arrived)
        'arrived': iso(arrived),
        'left': iso(presence.left_at(s)),  # last time they left range; None while they are there
        'end': iso(s.end_time),  # when the day's shift was closed; None while it is still open
        'minutes': presence.worked_minutes(s, now),  # active, verified time near the elder
        'breaks': len(presence.breaks_of(s, now)),
        'break_minutes': presence.break_minutes(s, now),
        'status': shift_status(s, now),
        'source': s.source,
        'chores_done': sum(c.is_done for c in chores),
        'chores_total': len(chores),
    }


def can_view(user, shift):
    if user.role == Role.CARETAKER:
        return shift.caretaker_id == user.pk
    if user.role == Role.USER:
        return shift.caretaker.sponsor_id == user.pk or shift.elderly.sponsor_id == user.pk
    return False


def shift_detail(shift, now, with_tone):
    segs = presence.segments_of(shift)
    timeline = []
    if shift.source == 'manual' and (not segs or shift.start_time < segs[0].start - timedelta(seconds=60)):
        timeline.append({'kind': 'started', 'at': iso(shift.start_time), 'note': 'Started with the Start button'})
    for i, seg in enumerate(segs):
        if i == 0:
            timeline.append({'kind': 'arrived', 'at': iso(seg.start)})
        else:
            gap = (seg.start - segs[i - 1].end).total_seconds() / 60 if segs[i - 1].end else 0
            timeline.append({'kind': 'returned', 'at': iso(seg.start), 'break_minutes': int(gap)})
        if seg.end:
            if i == len(segs) - 1 and shift.end_time is not None:
                note = 'Ended with the End button' if shift.ended_by == 'manual' else 'End of the day'
                timeline.append({'kind': 'left', 'at': iso(seg.end), 'note': note})
            else:
                timeline.append({'kind': 'stepped_out', 'at': iso(seg.end)})

    def minutes(a, b):
        return max(0, int(((b or now) - a).total_seconds() // 60))

    data = shift_card(shift, now)
    data.update(
        {
            'phase': presence.phase_of(shift, now),
            'timeline': timeline,
            'segments': [{'start': iso(s.start), 'end': iso(s.end), 'minutes': minutes(s.start, s.end)} for s in segs],
            'breaks_list': [{'start': iso(a), 'end': iso(b), 'minutes': minutes(a, b)} for a, b in presence.breaks_of(shift, now)],
            'chores': [
                {'description': c.description, 'is_done': c.is_done, 'done_at': iso(c.done_at)}
                for c in shift.chores.all()
            ],
        }
    )
    if with_tone:  # the tone of the visit is for the family, not shown on the caretaker's own screen
        from .views import tone_summary  # imported here: views imports this module

        from .tone_live import series_of

        data['tones'] = tone_summary([shift])
        data['tone_timeline'] = series_of(list(shift.samples.all()))
    return data


class ShiftListView(APIView):
    """GET /api/shifts/?days=30 : the day-shifts the caller may see, newest first."""

    def get(self, request):
        user = request.user
        now = timezone.now()
        try:
            days = min(max(int(request.query_params.get('days', 30)), 1), MAX_LIST_DAYS)
        except ValueError:
            days = 30
        qs = Shift.objects.filter(start_time__gte=now - timedelta(days=days))
        if user.role == Role.CARETAKER:
            presence.evaluate(user, now)
            qs = qs.filter(caretaker=user, is_demo=False)
        elif user.role == Role.USER:
            for c in user.members.filter(role=Role.CARETAKER):
                presence.evaluate(c, now)
            qs = qs.filter(Q(caretaker__sponsor=user) | Q(elderly__sponsor=user))
        else:
            raise PermissionDenied('Shifts are only available to caretakers and family accounts.')
        qs = qs.select_related('caretaker', 'elderly').prefetch_related('segments', 'chores')[:200]
        return Response([shift_card(s, now) for s in qs])


class ShiftDetailView(APIView):
    """GET /api/shifts/<id>/ : when they arrived, every break, when they left, active time, chores."""

    def get(self, request, pk):
        user = request.user
        shift = Shift.objects.filter(pk=pk).select_related('caretaker', 'elderly').first()
        if not shift or not can_view(user, shift):
            raise NotFound('Shift not found.')
        now = timezone.now()
        presence.evaluate(shift.caretaker, now)  # bring a live shift up to date before showing it
        shift = Shift.objects.filter(pk=pk).select_related('caretaker', 'elderly').first()
        if not shift:  # an empty shift (never reached the elder) is removed when the day closes
            raise NotFound('Shift not found.')
        return Response(shift_detail(shift, now, with_tone=user.role == Role.USER))
