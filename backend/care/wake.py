"""Wake up a phone whose MzaziCare has gone to sleep.

Android (and phone makers' battery savers) can stop MzaziCare's background location sharing when the app has not
been opened for a while, after a restart, or after an update. A sleeping phone sends nothing, so visits are not
seen and shifts do not start or end. The app cannot restart the sharing by itself: Android only allows it while
the app is on screen.

So whenever a phone in a care circle reports its position, the server looks at the other caretaker and elder
phones of that circle. One that has been silent for QUIET gets a push: "MzaziCare has stopped, tap to turn it back
on". Opening the app restarts the sharing. A phone is pushed once per silence (and again after REPEAT if it stays
silent), and only during the day, so nobody is woken at night.
"""

from datetime import timedelta

from django.db.models import F, Q
from django.utils import timezone

from accounts.models import Role

from . import push
from .models import Location

QUIET = timedelta(minutes=20)  # a working phone reports every 15 s
REPEAT = timedelta(hours=6)
DAY_HOURS = range(7, 21)  # 07:00 to 20:59, Nairobi time

TEXT = {
    Role.CARETAKER: (
        'MzaziCare has stopped',
        'Your phone put MzaziCare to sleep, so visits and shift hours are not being recorded. Tap to turn it back on.',
    ),
    Role.ELDERLY: (
        'MzaziCare has stopped / MzaziCare imesimama',
        'Tap to turn it back on so visits are recorded. Gusa hapa ili iwake tena na ziara zirekodiwe.',
    ),
}


def nudge_quiet_phones(user, now=None):
    """Push the other caretaker and elder phones of this user's circle that have gone silent. Returns who was pushed."""
    now = now or timezone.now()
    if not user.sponsor_id or timezone.localtime(now).hour not in DAY_HOURS:
        return []
    quiet = (
        Location.objects.filter(
            user__sponsor_id=user.sponsor_id,
            user__role__in=(Role.CARETAKER, Role.ELDERLY),
            user__is_active=True,
            updated_at__lt=now - QUIET,
        )
        .exclude(user=user)
        # Not yet pushed during this silence, or pushed long enough ago.
        .filter(Q(nudged_at__isnull=True) | Q(nudged_at__lt=F('updated_at')) | Q(nudged_at__lt=now - REPEAT))
        .select_related('user')
    )
    pushed = []
    for loc in quiet:
        # The update is the lock: when two phones report at once, only one of them sends the push.
        claimed = (
            Location.objects.filter(pk=loc.pk)
            .filter(Q(nudged_at__isnull=True) | Q(nudged_at__lt=F('updated_at')) | Q(nudged_at__lt=now - REPEAT))
            .update(nudged_at=now)
        )
        if not claimed:
            continue
        title, body = TEXT[loc.user.role]
        push.notify([loc.user], title, body, {'type': 'wake'}, 'alerts', urgent=True)
        pushed.append(loc.user)
    return pushed
