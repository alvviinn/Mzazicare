from django.db.models import Q
from django.utils import timezone

from .models import Task

MAX_TASKS = 100


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
    }
