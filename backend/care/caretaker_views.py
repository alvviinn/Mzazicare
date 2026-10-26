from datetime import datetime, time, timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User

from . import presence
from .models import Alert, Chore, Location, Shift, ShiftSegment, Task
from .shift_views import shift_card
from .tasks import MAX_TASKS, task_json, visible_tasks


def require_caretaker(user):
    if user.role != Role.CARETAKER:
        raise PermissionDenied('This is only available to caretakers.')


def local_midnight(day):
    return timezone.make_aware(datetime.combine(day, time.min))


def minutes_since(user, since, now):
    """Verified (in-range) minutes worked since a moment, clipped to that moment."""
    segs = ShiftSegment.objects.filter(shift__caretaker=user, shift__is_demo=False).filter(
        Q(end__isnull=True) | Q(end__gt=since)
    )
    seconds = sum(max(0, int(((s.end or now) - max(s.start, since)).total_seconds())) for s in segs)
    return seconds // 60


def parse_coord(value, low, high, name):
    try:
        v = float(value)
    except (TypeError, ValueError):
        raise ValidationError({'detail': f'{name} is required.'})
    if not low <= v <= high:
        raise ValidationError({'detail': f'{name} is out of range.'})
    return v


class LocationView(APIView):
    """Each phone reports where it is. The elder's phone is the centre of the geofence."""

    def post(self, request):
        user = request.user
        if user.role not in (Role.CARETAKER, Role.ELDERLY):
            raise PermissionDenied('Location sharing is only used for caretakers and elderly people.')
        lat = parse_coord(request.data.get('latitude'), -90, 90, 'Latitude')
        lon = parse_coord(request.data.get('longitude'), -180, 180, 'Longitude')
        acc = request.data.get('accuracy')
        acc = float(acc) if isinstance(acc, (int, float)) and acc >= 0 else None
        mocked = bool(request.data.get('mocked'))
        now = timezone.now()

        Location.objects.update_or_create(
            user=user,
            defaults={'latitude': lat, 'longitude': lon, 'accuracy': acc, 'mocked': mocked, 'updated_at': now},
        )

        if mocked and user.sponsor_id:
            recent = Alert.objects.filter(
                sponsor_id=user.sponsor_id, kind=Alert.Kind.GEOFENCE, created_at__gte=now - timedelta(hours=1)
            )
            if not recent.exists():
                Alert.objects.create(
                    sponsor_id=user.sponsor_id,
                    kind=Alert.Kind.GEOFENCE,
                    message=f'{user.name}\'s phone is reporting a fake (mock) location. Visit time is not counted.',
                )

        # A fresh fix may change who is in range: re-check the affected caretaker(s).
        if user.role == Role.CARETAKER:
            presence.evaluate(user, now)
        elif user.sponsor_id:
            for c in User.objects.filter(sponsor_id=user.sponsor_id, role=Role.CARETAKER):
                presence.evaluate(c, now)
        return Response({'detail': 'ok'})


def state_json(user, now):
    shift = presence.evaluate(user, now)
    state, distance, elder, sharing = presence.current_reading(user, shift, now)
    seg = presence.open_segment(shift) if shift else None
    midnight = local_midnight(timezone.localdate(now))
    # Today's shift as a card, even if it was ended with the End button (so it can still be opened).
    todays = shift or next(iter(presence.todays_shifts(user, now)), None)
    sos = Alert.objects.filter(
        sponsor_id=user.sponsor_id, kind=Alert.Kind.SOS, status=Alert.Status.OPEN,
        created_at__gte=now - timedelta(minutes=30),
    ).first()
    return {
        'emergency': {'message': sos.message, 'at': sos.created_at.isoformat()} if sos else None,
        'status': 'none' if not shift else 'active' if seg else 'waiting',
        # what the screen says: none | waiting (not arrived yet) | active | break | away (long break) | ended
        'phase': presence.phase_of(shift, now) if shift else ('ended' if todays else 'none'),
        'today': shift_card(todays, now) if todays else None,
        'source': shift.source if shift else None,
        'started_at': shift.start_time.isoformat() if shift else None,
        'shift_minutes': presence.worked_minutes(shift, now) if shift else 0,
        'today_minutes': minutes_since(user, midnight, now),
        'elderly': {'name': elder.name, 'email': elder.email} if elder else None,
        'range': {
            'state': state,  # 'in' | 'out' | 'unknown'
            'distance_m': round(distance) if distance is not None and distance <= 500 else None,
            'elder_sharing': sharing,  # false when the elder's phone isn't sending a fresh location
            'radius_m': presence.ENTER_RADIUS_M,
        },
    }


class ShiftStateView(APIView):
    def get(self, request):
        require_caretaker(request.user)
        return Response(state_json(request.user, timezone.now()))


class ShiftStartView(APIView):
    def post(self, request):
        require_caretaker(request.user)
        now = timezone.now()
        try:
            presence.start_manual(request.user, now)
        except ValueError as e:
            raise ValidationError({'detail': str(e)})
        return Response(state_json(request.user, now), status=201)


class ShiftStopView(APIView):
    def post(self, request):
        require_caretaker(request.user)
        now = timezone.now()
        try:
            presence.stop_manual(request.user, now)
        except ValueError as e:
            raise ValidationError({'detail': str(e)})
        return Response(state_json(request.user, now))


class HoursView(APIView):
    def get(self, request):
        user = request.user
        require_caretaker(user)
        now = timezone.now()
        today = timezone.localdate(now)
        recent = (
            Shift.objects.filter(caretaker=user, is_demo=False)
            .select_related('caretaker', 'elderly')
            .prefetch_related('segments', 'chores')[:30]
        )
        return Response(
            {
                'today': minutes_since(user, local_midnight(today), now),
                'week': minutes_since(user, local_midnight(today - timedelta(days=today.weekday())), now),
                'month': minutes_since(user, local_midnight(today.replace(day=1)), now),
                'total': minutes_since(user, timezone.make_aware(datetime(2000, 1, 1)), now),
                'recent': [shift_card(s, now) for s in recent],  # one card per day worked
            }
        )


# ---- To-do list ----


def sync_chore(user, task):
    """Keep today's shift record of this task in step with it (also after tapping End: the day is still today)."""
    shift = next(iter(presence.todays_shifts(user)), None)
    if shift:
        Chore.objects.update_or_create(
            shift=shift,
            task=task,
            defaults={'description': task.title, 'is_done': task.is_done, 'done_at': task.done_at},
        )


def require_in_range(user):
    """Refuse unless the caretaker's phone is verified within the geofence of an elderly person."""
    state, distance, _, _ = presence.current_reading(user, None)
    if state == 'in':
        return
    if state == 'out':
        raise PermissionDenied(
            f'You are about {round(distance)} m from the elderly person. Move within {presence.ENTER_RADIUS_M} m to mark this done.'
        )
    raise PermissionDenied(
        'Your location could not be verified. Turn on location sharing, make sure the elderly person is sharing too, then try again.'
    )


class TaskListView(APIView):
    def get(self, request):
        require_caretaker(request.user)
        return Response([task_json(t) for t in visible_tasks(request.user)])

    def post(self, request):
        user = request.user
        require_caretaker(user)
        title = (request.data.get('title') or '').strip()
        if not title:
            raise ValidationError({'detail': 'Write the task first.'})
        if len(title) > 200:
            raise ValidationError({'detail': 'Task is too long (200 characters max).'})
        if Task.objects.filter(caretaker=user).count() >= MAX_TASKS:
            raise ValidationError({'detail': 'Too many tasks. Delete some you no longer need.'})
        task = Task.objects.create(caretaker=user, title=title, recurring=bool(request.data.get('recurring')))
        sync_chore(user, task)
        return Response(task_json(task), status=201)


class TaskDetailView(APIView):
    def _task(self, request, pk):
        require_caretaker(request.user)
        task = Task.objects.filter(pk=pk, caretaker=request.user).first()
        if not task:
            raise ValidationError({'detail': 'Task not found.'})
        return task

    def patch(self, request, pk):
        task = self._task(request, pk)
        if 'is_done' in request.data:
            task.is_done = bool(request.data['is_done'])
            if task.is_done and not task.done_at:
                require_in_range(request.user)  # a task can only be ticked off at the elderly person's side
            task.done_at = timezone.now() if task.is_done else None
        if 'recurring' in request.data:
            task.recurring = bool(request.data['recurring'])
        task.save()
        sync_chore(request.user, task)
        return Response(task_json(task))

    def delete(self, request, pk):
        self._task(request, pk).delete()
        return Response(status=204)
