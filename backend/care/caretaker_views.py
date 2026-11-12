from datetime import datetime, time, timedelta

from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import BaseParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User

from . import presence
from .models import Alert, Chore, Location, Shift, ShiftSegment, Task, TaskCompletion, TrackPoint
from .shift_views import shift_card
from .tasks import MAX_PHOTO_BYTES, MAX_TASKS, completion_json, photo_type, task_json, visible_tasks


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
        if not mocked:
            record_track(user, lat, lon, acc, now)
        return Response({'detail': 'ok'})


TRACK_EVERY_S = 30


def record_track(user, lat, lon, acc, now):
    """Keep the position for the shift map, only while one of this phone's shifts is open."""
    who = 'caretaker' if user.role == Role.CARETAKER else 'elderly'
    open_shifts = Shift.objects.filter(end_time__isnull=True, is_demo=False)
    open_shifts = open_shifts.filter(caretaker=user) if who == 'caretaker' else open_shifts.filter(elderly=user)
    for shift in open_shifts:
        last = shift.track.filter(who=who).order_by('-at').first()
        if last and (now - last.at).total_seconds() < TRACK_EVERY_S:
            continue
        TrackPoint.objects.create(shift=shift, who=who, latitude=lat, longitude=lon, accuracy=acc, at=now)


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


def require_task_access(user):
    if user.role not in (Role.CARETAKER, Role.USER):
        raise PermissionDenied('Task lists are for caretakers and family accounts.')


def clean_title(data):
    title = (data.get('title') or '').strip()
    if not title:
        raise ValidationError({'detail': 'Write the task first.'})
    if len(title) > 200:
        raise ValidationError({'detail': 'Task is too long (200 characters max).'})
    return title


class TaskListView(APIView):
    """Caretakers: their own list. Family: the lists of their caretakers, and assigning tasks to them."""

    def get(self, request):
        user = request.user
        require_task_access(user)
        if user.role == Role.CARETAKER:
            return Response([task_json(t) for t in visible_tasks(user)])
        caretakers = User.objects.filter(sponsor=user, role=Role.CARETAKER).order_by('date_joined')
        return Response([task_json(t) for c in caretakers for t in visible_tasks(c)])

    def post(self, request):
        user = request.user
        require_task_access(user)
        title = clean_title(request.data)
        if user.role == Role.CARETAKER:
            caretaker, assigned_by = user, None
        else:
            caretaker = User.objects.filter(
                email=(request.data.get('caretaker_email') or '').strip().lower(), sponsor=user, role=Role.CARETAKER
            ).first()
            if not caretaker:
                raise ValidationError({'detail': 'Choose one of your caretakers.'})
            assigned_by = user
        if Task.objects.filter(caretaker=caretaker).count() >= MAX_TASKS:
            raise ValidationError({'detail': 'Too many tasks. Delete some you no longer need.'})
        task = Task.objects.create(
            caretaker=caretaker, assigned_by=assigned_by, title=title, recurring=bool(request.data.get('recurring'))
        )
        sync_chore(caretaker, task)
        return Response(task_json(task), status=201)


class TaskDetailView(APIView):
    def _task(self, request, pk):
        user = request.user
        require_task_access(user)
        if user.role == Role.CARETAKER:
            task = Task.objects.filter(pk=pk, caretaker=user).first()
        else:  # family may only change the tasks they assigned
            task = Task.objects.filter(pk=pk, assigned_by=user, caretaker__sponsor=user).first()
        if not task:
            raise ValidationError({'detail': 'Task not found.'})
        return task

    def _require_owner(self, request, task):
        if request.user.role == Role.CARETAKER and task.assigned_by_id:
            raise PermissionDenied('The family assigned this task, so only they can change or remove it.')

    def patch(self, request, pk):
        task = self._task(request, pk)
        if 'is_done' in request.data:
            if request.user.role != Role.CARETAKER:
                raise PermissionDenied('Only the caretaker can mark a task done.')
            if bool(request.data['is_done']):
                if not task.is_done:
                    raise ValidationError({'detail': 'Take a photo to show the task is done.'})  # see TaskDoneView
            elif task.is_done:  # untick: the proof for this tick is removed with it
                TaskCompletion.objects.filter(task=task, done_at=task.done_at).delete()
                task.is_done, task.done_at = False, None
        if 'title' in request.data:
            self._require_owner(request, task)
            task.title = clean_title(request.data)
        if 'recurring' in request.data:
            self._require_owner(request, task)
            task.recurring = bool(request.data['recurring'])
        task.save()
        sync_chore(task.caretaker, task)
        return Response(task_json(task))

    def delete(self, request, pk):
        task = self._task(request, pk)
        self._require_owner(request, task)
        task.delete()
        return Response(status=204)


class RawImageParser(BaseParser):
    """Accepts the proof photo as the raw request body (Content-Type: image/...)."""

    media_type = 'image/*'

    def parse(self, stream, media_type=None, parser_context=None):
        return stream.read(MAX_PHOTO_BYTES + 1)


class TaskDoneView(APIView):
    """POST /api/tasks/<id>/done/ with a photo as the body: the caretaker ticks a task off, with proof."""

    parser_classes = [RawImageParser]

    def post(self, request, pk):
        user = request.user
        require_caretaker(user)
        task = Task.objects.filter(pk=pk, caretaker=user).select_related('caretaker', 'assigned_by').first()
        if not task:
            raise ValidationError({'detail': 'Task not found.'})
        photo = request.data
        if not isinstance(photo, (bytes, bytearray)) or not photo:
            raise ValidationError({'detail': 'Take a photo to show the task is done.'})
        if len(photo) > MAX_PHOTO_BYTES:
            return Response({'detail': 'The photo is too large. Try again.'}, status=413)
        kind = photo_type(photo)
        if not kind:
            raise ValidationError({'detail': 'That is not a photo the app can use (JPEG, PNG or WebP).'})
        if task.is_done:
            return Response(task_json(task))  # already ticked: a double tap must not add a second record
        require_in_range(user)  # a task can only be ticked off at the elderly person's side

        now = timezone.now()
        with transaction.atomic():
            task.is_done, task.done_at = True, now
            task.save()
            TaskCompletion.objects.create(
                task=task,
                caretaker=user,
                assigned_by=task.assigned_by,
                shift=next(iter(presence.todays_shifts(user, now)), None),
                title=task.title,
                recurring=task.recurring,
                done_at=now,
                photo=bytes(photo),
                photo_type=kind,
            )
            sync_chore(user, task)
        return Response(task_json(task), status=201)


def completions_for(user):
    """The task records this person may see: a caretaker their own, a family account their caretakers'."""
    require_task_access(user)
    if user.role == Role.CARETAKER:
        return TaskCompletion.objects.filter(caretaker=user)
    return TaskCompletion.objects.filter(caretaker__sponsor=user)


class TaskHistoryView(APIView):
    """GET /api/tasks/history/?days=30 : every task done in that time, newest first."""

    def get(self, request):
        try:
            days = min(max(int(request.query_params.get('days', 30)), 1), 365)
        except ValueError:
            raise ValidationError({'detail': 'days must be a number.'})
        rows = (
            completions_for(request.user)
            .filter(done_at__gte=timezone.now() - timedelta(days=days))
            .select_related('caretaker', 'assigned_by')
            .defer('photo')[:500]
        )
        return Response({'days': days, 'items': [completion_json(c) for c in rows]})


class CompletionPhotoView(APIView):
    """GET /api/tasks/completions/<id>/photo/ : the proof photo itself (never a public link)."""

    def get(self, request, pk):
        c = completions_for(request.user).filter(pk=pk).only('photo', 'photo_type').first()
        if not c:
            raise ValidationError({'detail': 'Photo not found.'})
        res = HttpResponse(bytes(c.photo), content_type=c.photo_type)
        res['Cache-Control'] = 'private, max-age=86400'
        return res
