from django.db.models import Q
from django.utils import timezone

from .models import Task, TaskCompletion

MAX_TASKS = 100
MAX_PHOTO_BYTES = 6_000_000
PHOTO_TYPES = {  # what the first bytes of each accepted image format look like
    'image/jpeg': lambda b: b[:3] == b'\xff\xd8\xff',
    'image/png': lambda b: b[:8] == b'\x89PNG\r\n\x1a\n',
    'image/webp': lambda b: b[:4] == b'RIFF' and b[8:12] == b'WEBP',
}


def photo_type(data):
    """The image type of these bytes, or None if they are not a photo we accept."""
    return next((kind for kind, looks_like in PHOTO_TYPES.items() if looks_like(data)), None)


def latest_completion_id(task):
    """The record behind today's tick (holding the proof photo), if the task is ticked."""
    if not task.is_done or not task.done_at:
        return None
    c = TaskCompletion.objects.filter(task=task, done_at=task.done_at).only('id').first()
    return c.pk if c else None


def visible_tasks(caretaker, now=None):
    """The caretaker's to-do list for today.

    Recurring tasks reset to "not done" on each working day (Mon-Fri), so nothing needs retyping.
    One-off tasks stay until done, and remain visible for the rest of the day they were completed.
    """
    today = timezone.localdate(now)
    if today.weekday() < 5:
        Task.objects.filter(caretaker=caretaker, recurring=True, is_done=True, done_at__date__lt=today).update(
            is_done=False, done_at=None
        )
    return list(
        Task.objects.filter(caretaker=caretaker)
        .select_related('caretaker', 'assigned_by')
        .filter(Q(recurring=True) | Q(is_done=False) | Q(done_at__date=today))
        .order_by('is_done', 'created_at')
    )


def task_json(t):
    return {
        'id': t.pk,
        'title': t.title,
        'recurring': t.recurring,
        'is_done': t.is_done,
        'done_at': t.done_at.isoformat() if t.done_at else None,
        'caretaker': t.caretaker.name,
        'assigned_by': t.assigned_by.name if t.assigned_by_id else None,  # null: the caretaker wrote it
        'completion_id': latest_completion_id(t),  # the proof photo is at /api/tasks/completions/<id>/photo/
    }


def completion_json(c):
    return {
        'id': c.pk,
        'task_id': c.task_id,
        'title': c.title,
        'recurring': c.recurring,
        'caretaker': c.caretaker.name,
        'assigned_by': c.assigned_by.name if c.assigned_by_id else None,
        'done_at': c.done_at.isoformat(),
        'shift_id': c.shift_id,
    }
