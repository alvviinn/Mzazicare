"""A phone whose MzaziCare went to sleep is pushed "tap to turn it back on" (care/wake.py)."""

from datetime import datetime, timedelta
from unittest import mock

from django.utils import timezone

from care import push, wake
from care.models import Location

from .helpers import FamilyTestCase

NAIROBI_NOON = timezone.make_aware(datetime(2026, 11, 23, 12, 0))
NAIROBI_NIGHT = timezone.make_aware(datetime(2026, 11, 23, 23, 0))


class WakeTests(FamilyTestCase):
    def setUp(self):
        super().setUp()
        self.sent = []
        patcher = mock.patch.object(push, 'notify', side_effect=lambda users, *a, **kw: self.sent.append((users, a, kw)))
        patcher.start()
        self.addCleanup(patcher.stop)

    def last_fix(self, user, at):
        Location.objects.update_or_create(user=user, defaults={'latitude': -1.29, 'longitude': 36.82, 'updated_at': at})

    def test_a_quiet_elder_phone_is_pushed_when_the_caretaker_reports(self):
        self.last_fix(self.elder, NAIROBI_NOON - timedelta(minutes=45))
        pushed = wake.nudge_quiet_phones(self.caretaker, NAIROBI_NOON)
        self.assertEqual(pushed, [self.elder])
        users, (title, body, data, channel), kw = self.sent[0]
        self.assertEqual((data, channel, kw['urgent']), ({'type': 'wake'}, 'alerts', True))
        self.assertIn('Gusa hapa', body)  # the elder's push is also in Kiswahili

    def test_a_working_phone_is_left_alone(self):
        self.last_fix(self.elder, NAIROBI_NOON - timedelta(minutes=2))
        self.assertEqual(wake.nudge_quiet_phones(self.caretaker, NAIROBI_NOON), [])

    def test_pushed_once_per_silence_then_again_after_six_hours(self):
        self.last_fix(self.caretaker, NAIROBI_NOON - timedelta(hours=1))
        self.assertEqual(wake.nudge_quiet_phones(self.elder, NAIROBI_NOON), [self.caretaker])
        self.assertEqual(wake.nudge_quiet_phones(self.elder, NAIROBI_NOON + timedelta(minutes=5)), [])
        self.assertEqual(wake.nudge_quiet_phones(self.elder, NAIROBI_NOON + timedelta(hours=5)), [])
        self.assertEqual(wake.nudge_quiet_phones(self.elder, NAIROBI_NOON + timedelta(hours=6, minutes=1)), [self.caretaker])

    def test_after_it_wakes_and_sleeps_again_it_is_pushed_again(self):
        self.last_fix(self.caretaker, NAIROBI_NOON - timedelta(hours=1))
        wake.nudge_quiet_phones(self.elder, NAIROBI_NOON)
        self.last_fix(self.caretaker, NAIROBI_NOON + timedelta(minutes=10))  # tapped, sharing again
        then = NAIROBI_NOON + timedelta(minutes=40)  # and asleep again
        self.assertEqual(wake.nudge_quiet_phones(self.elder, then), [self.caretaker])

    def test_nobody_is_woken_at_night(self):
        self.last_fix(self.elder, NAIROBI_NIGHT - timedelta(hours=2))
        self.assertEqual(wake.nudge_quiet_phones(self.caretaker, NAIROBI_NIGHT), [])

    def test_family_phones_and_other_circles_are_not_pushed(self):
        self.last_fix(self.sponsor, NAIROBI_NOON - timedelta(hours=2))  # family phones do not share location
        self.assertEqual(wake.nudge_quiet_phones(self.caretaker, NAIROBI_NOON), [])

    def test_reporting_a_position_triggers_the_check(self):
        self.last_fix(self.elder, timezone.now() - timedelta(hours=1))
        with mock.patch.object(wake, 'DAY_HOURS', range(0, 24)):
            r = self.caretaker_api.post('/api/location/', {'latitude': -1.29, 'longitude': 36.82, 'accuracy': 5}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertTrue(any(s[1][2] == {'type': 'wake'} for s in self.sent))
