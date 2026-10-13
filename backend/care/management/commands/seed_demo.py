import random
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import Role, User
from care.models import Alert, Chore, Shift, ToneReading

CHORES = ['Morning medication', 'Breakfast', 'Bathing assistance', 'Light housekeeping', 'Lunch', 'Afternoon walk']
# (happy, calm, neutral, stressed, angry) weights; mostly positive so the sample looks realistic.
TONE_PROFILES = [(45, 30, 20, 5, 0), (30, 35, 25, 8, 2), (20, 30, 30, 15, 5), (50, 25, 20, 5, 0)]


class Command(BaseCommand):
    help = 'DEV ONLY: create 7 days of sample shifts, chores, tones and alerts for a family account.'

    def add_arguments(self, parser):
        parser.add_argument('sponsor_email')

    def handle(self, *args, **opts):
        sponsor = User.objects.filter(email=opts['sponsor_email'].lower(), role=Role.USER).first()
        if not sponsor:
            raise CommandError('No family account with that email.')
        caretakers = list(User.objects.filter(sponsor=sponsor, role=Role.CARETAKER))
        elderly = list(User.objects.filter(sponsor=sponsor, role=Role.ELDERLY))
        if not caretakers or not elderly:
            raise CommandError('Add at least one caretaker and one elderly person first.')

        rng = random.Random(7)
        Shift.objects.filter(is_demo=True, caretaker__sponsor=sponsor).delete()
        Alert.objects.filter(is_demo=True, sponsor=sponsor).delete()

        now = timezone.now()
        last_shift = None
        for day in range(6, -1, -1):
            caretaker, person = rng.choice(caretakers), elderly[0]
            start = (now - timedelta(days=day)).replace(hour=8, minute=rng.randint(0, 40), second=0, microsecond=0)
            if day == 0 and start > now:
                start = now - timedelta(hours=1)
            # Today's shift is still running; earlier ones ended after 4-7 hours.
            end = None if day == 0 else start + timedelta(minutes=rng.randint(240, 420))
            shift = Shift.objects.create(caretaker=caretaker, elderly=person, start_time=start, end_time=end, is_demo=True)

            for desc in CHORES:
                done = rng.random() < (0.5 if day == 0 else 0.88)
                Chore.objects.create(
                    shift=shift, description=desc, is_done=done,
                    done_at=start + timedelta(minutes=rng.randint(20, 200)) if done else None,
                )
            profile = rng.choice(TONE_PROFILES)
            for tone, pct in zip(('happy', 'calm', 'neutral', 'stressed', 'angry'), profile):
                ToneReading.objects.create(shift=shift, tone=tone, percent=pct)
            last_shift = shift

        Alert.objects.create(
            sponsor=sponsor, shift=last_shift, kind=Alert.Kind.VOCAL, is_demo=True,
            message='Raised voice detected for about 40 seconds during the afternoon.',
        )
        Alert.objects.create(
            sponsor=sponsor, kind=Alert.Kind.SHORT, is_demo=True, status=Alert.Status.DISMISSED,
            message='A visit was shorter than usual (2h 10m).',
        )
        self.stdout.write(self.style.SUCCESS('Sample data created. Remove it any time by re-running or via the admin.'))
