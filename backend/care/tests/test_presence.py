"""The geofence engine: the 15 m circle follows the elder's phone, and only in-range time counts."""

from datetime import timedelta

from django.test import SimpleTestCase
from django.utils import timezone

from care import presence
from care.models import Chore, Shift, Task

from .helpers import FamilyTestCase, place


class DistanceTests(SimpleTestCase):
    def test_haversine_is_accurate_at_short_range(self):
        # 0.001 degrees of latitude is about 111 m
        self.assertAlmostEqual(presence.haversine_m(0.0, 0.0, 0.001, 0.0), 111.2, delta=0.5)
        self.assertEqual(presence.haversine_m(-1.29, 36.82, -1.29, 36.82), 0)


class PresenceEngineTests(FamilyTestCase):
    def setUp(self):
        super().setUp()
        self.t0 = timezone.now() - timedelta(hours=8)  # a fixed starting point, so time is fully controlled

    def at(self, minute):
        return self.t0 + timedelta(minutes=minute)

    def tick(self, minute, metres, accuracy=5.0, mocked=False):
        """Both phones report at `minute`, the caretaker `metres` away, then the engine runs."""
        place(self.elder, 0, self.at(minute))
        place(self.caretaker, metres, self.at(minute), accuracy, mocked)
        return presence.evaluate(self.caretaker, self.at(minute))

    def open_shift(self):
        return Shift.objects.filter(caretaker=self.caretaker, end_time__isnull=True).first()

    def worked(self, shift, minute=999):
        return presence.worked_minutes(Shift.objects.get(pk=shift.pk), self.at(minute))

    # ---- starting ----
    def test_no_shift_until_within_15_metres(self):
        self.assertIsNone(self.tick(0, 30))
        self.assertIsNone(self.tick(1, 18))  # inside the 20 m exit radius but outside the 15 m entry radius
        self.assertEqual(Shift.objects.count(), 0)

    def test_shift_starts_automatically_inside_15_metres(self):
        shift = self.tick(0, 10)
        self.assertEqual(shift.source, 'auto')
        self.assertIsNotNone(presence.open_segment(shift))

    def test_task_list_is_snapshotted_into_the_shift(self):
        Task.objects.create(caretaker=self.caretaker, title='Morning medication', recurring=True)
        shift = self.tick(0, 10)
        self.assertTrue(Chore.objects.filter(shift=shift, description='Morning medication').exists())

    def test_silent_elder_phone_prevents_a_shift(self):
        place(self.elder, 0, self.at(0) - timedelta(minutes=10))  # last heard 10 minutes ago
        place(self.caretaker, 0, self.at(0))
        self.assertIsNone(presence.evaluate(self.caretaker, self.at(0)))

    # ---- pausing and resuming ----
    def test_gps_jitter_at_the_edge_does_not_pause(self):
        self.tick(0, 10)
        self.tick(5, 18)  # between 15 and 20 m: still counted (hysteresis)
        self.assertIsNotNone(presence.open_segment(self.open_shift()))

    def test_timer_stops_when_out_of_range_at_the_last_moment_in_range(self):
        self.tick(0, 10)
        self.tick(10, 5)
        shift = self.tick(15, 100)
        self.assertIsNone(presence.open_segment(shift))
        self.assertEqual(self.worked(shift), 10)

    def test_timer_continues_in_a_new_segment_when_back_in_range(self):
        self.tick(0, 10)
        self.tick(10, 5)
        self.tick(15, 100)
        self.tick(30, 4)
        shift = self.tick(35, 4)
        self.assertEqual(shift.segments.count(), 2)
        self.assertIsNotNone(presence.open_segment(shift))

    # ---- manual start and stop ----
    def test_manual_stop_ends_the_shift_and_keeps_verified_time(self):
        shift = self.tick(0, 10)
        self.tick(10, 5)
        presence.stop_manual(self.caretaker, self.at(10))
        shift = Shift.objects.get(pk=shift.pk)
        self.assertEqual((shift.ended_by, self.worked(shift)), ('manual', 10))

    def test_no_auto_restart_after_manual_stop_until_the_caretaker_has_left(self):
        self.tick(0, 10)
        self.tick(5, 5)
        presence.stop_manual(self.caretaker, self.at(5))
        self.assertIsNone(self.tick(10, 4))  # still standing there: blocked
        self.assertEqual(Shift.objects.count(), 1)
        self.tick(15, 100)  # leaves
        self.assertTrue(Shift.objects.get().rearmed)
        self.assertIsNotNone(self.tick(20, 4))  # arrives again: a new shift starts

    def test_manual_start_away_from_the_elder_counts_nothing_until_in_range(self):
        self.tick(0, 100)
        shift = presence.start_manual(self.caretaker, self.at(0))
        self.assertEqual((shift.source, presence.open_segment(shift), self.worked(shift, 0)), ('manual', None, 0))
        self.tick(5, 4)
        self.tick(10, 4)
        self.assertEqual(self.worked(shift, 10), 5)  # only the 5 minutes verified in range

    def test_cannot_start_a_second_shift(self):
        self.tick(0, 10)
        with self.assertRaises(ValueError):
            presence.start_manual(self.caretaker, self.at(1))

    def test_manual_start_needs_a_linked_elderly_person(self):
        self.elder.delete()
        with self.assertRaises(ValueError):
            presence.start_manual(self.caretaker, self.at(0))

    # ---- trust ----
    def test_fake_gps_location_is_never_counted(self):
        self.tick(0, 10)
        self.tick(5, 5)
        shift = self.tick(10, 4, mocked=True)
        self.assertIsNone(presence.open_segment(shift))
        self.assertEqual(self.worked(shift), 5)

    def test_inaccurate_fix_cannot_start_or_resume_a_shift(self):
        self.assertIsNone(self.tick(0, 4, accuracy=100))

    # ---- closing ----
    def test_shift_paused_for_90_minutes_closes_itself(self):
        self.tick(0, 10)
        self.tick(5, 5)
        presence.evaluate(self.caretaker, self.at(5 + 100))  # nobody has reported for 100 minutes
        shift = Shift.objects.get()
        self.assertEqual((shift.ended_by, self.worked(shift)), ('auto', 5))

    def test_manual_shift_that_never_reaches_the_elder_is_discarded(self):
        self.tick(0, 100)
        shift = presence.start_manual(self.caretaker, self.at(0))
        presence.evaluate(self.caretaker, self.at(95))
        self.assertFalse(Shift.objects.filter(pk=shift.pk).exists())
