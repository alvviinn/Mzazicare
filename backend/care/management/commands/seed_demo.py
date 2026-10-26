import random
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from accounts.models import Role, User
from care.models import Alert, Chore, Shift, ShiftSegment, Task, ToneReading, ToneSample

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
        Task.objects.filter(is_demo=True, caretaker__sponsor=sponsor).delete()

        # Sample to-do list for today, so the family's "today's chores" card has something to show.
        for c in caretakers:
            for i, desc in enumerate(CHORES):
                done = i < 3
                Task.objects.create(
                    caretaker=c, title=desc, recurring=True, is_demo=True, is_done=done,
                    done_at=timezone.now() - timedelta(minutes=90 - 20 * i) if done else None,
                )

        now = timezone.now()
        last_shift = None
        for day in range(6, -1, -1):
            caretaker, person = rng.choice(caretakers), elderly[0]
            start = (now - timedelta(days=day)).replace(hour=8, minute=rng.randint(0, 40), second=0, microsecond=0)
            if day == 0 and start > now:
                start = now - timedelta(hours=1)
            # Today's shift is still running; earlier ones ended after 4-7 hours.
            end = None if day == 0 else start + timedelta(minutes=rng.randint(240, 420))
            shift = Shift.objects.create(
                caretaker=caretaker, elderly=person, start_time=start, end_time=end, is_demo=True,
                ended_by='auto' if end else '',
            )
            if end is None:
                ShiftSegment.objects.create(shift=shift, start=start)  # today: still there
            else:
                # A finished day: most days include one break (lunch, an errand) in the middle.
                if rng.random() < 0.75:
                    split = start + timedelta(minutes=rng.randint(100, 150))
                    back = split + timedelta(minutes=rng.choice([30, 40, 45, 60]))
                    ShiftSegment.objects.create(shift=shift, start=start, end=split)
                    ShiftSegment.objects.create(shift=shift, start=back, end=end)
                else:
                    ShiftSegment.objects.create(shift=shift, start=start, end=end)

            for desc in CHORES:
                done = rng.random() < (0.5 if day == 0 else 0.88)
                Chore.objects.create(
                    shift=shift, description=desc, is_done=done,
                    done_at=start + timedelta(minutes=rng.randint(20, 200)) if done else None,
                )
            profile = rng.choice(TONE_PROFILES)
            for tone, pct in zip(('happy', 'calm', 'neutral', 'stressed', 'angry'), profile):
                ToneReading.objects.create(shift=shift, tone=tone, percent=pct)
            self.add_samples(rng, shift, profile, start, end or now)
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

    @staticmethod
    def add_samples(rng, shift, profile, start, end):
        """A clip about every 10 minutes (when anyone is talking) whose tone drifts around the shift's profile."""
        weights = list(profile)
        at = start + timedelta(minutes=5)
        while at < end:
            if rng.random() < 0.8:
                drift = [max(0.5, w * rng.uniform(0.4, 1.8)) for w in weights]
                if rng.random() < 0.12:  # a tense moment
                    drift[3] *= 4
                    drift[4] *= 3
                total = sum(drift)
                shares = [d / total for d in drift]
                ToneSample.objects.create(
                    shift=shift, at=at, speech_s=round(rng.uniform(4, 12), 1),
                    happy=shares[0], calm=shares[1], neutral=shares[2], stressed=shares[3], angry=shares[4],
                    distress=shares[4] > 0.45,
                    source=rng.choice(['caretaker', 'elderly']),
                )
            at += timedelta(minutes=rng.randint(8, 14))
