"""The geofence engine: the 15 m circle follows the elder's phone, only in-range time counts,
and a shift is one DAY (stepping out is a break, a new day is a new shift)."""

from datetime import datetime, timedelta

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
        # Fixed local time (Tuesday 08:00 in Nairobi) so tests never straddle a real midnight.
        self.t0 = timezone.make_aware(datetime(2026, 10, 20, 8, 0))

    def at(self, minute):
        return self.t0 + timedelta(minutes=minute)

    def tick(self, minute, metres, accuracy=5.0, mocked=False):
        """Both phones report at `minute`, the caretaker `metres` away, then the engine runs."""
        place(self.elder, 0, self.at(minute))
        place(self.caretaker, metres, self.at(minute), accuracy, mocked)
        return presence.evaluate(self.caretaker, self.at(minute))

    def shifts(self):
        return Shift.objects.filter(caretaker=self.caretaker).order_by('start_time')

    def fresh(self, shift):
        return Shift.objects.get(pk=shift.pk)

    def worked(self, shift, minute=9999):
        return presence.worked_minutes(self.fresh(shift), self.at(minute))

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

    # ---- breaks: stepping out never ends the shift ----
    def test_gps_jitter_at_the_edge_does_not_pause(self):
        self.tick(0, 10)
        self.tick(5, 18)  # between 15 and 20 m: still counted (hysteresis)
        self.assertIsNotNone(presence.open_segment(self.shifts().get()))

    def test_timer_stops_when_out_of_range_at_the_last_moment_in_range(self):
        self.tick(0, 10)
        self.tick(10, 5)
        shift = self.tick(15, 100)
        self.assertIsNone(presence.open_segment(shift))
        self.assertEqual(self.worked(shift), 10)

    def test_stepping_out_is_a_break_and_coming_back_continues_the_same_shift(self):
        first = self.tick(0, 10)  # 08:00 arrives
        self.tick(120, 5)  # 10:00 still there
        self.tick(125, 100)  # 10:05 steps out (the break began at 10:00, the last time they were seen in range)
        self.tick(150, 100)  # 10:30 still out
        back = self.tick(155, 4)  # 10:35 returns
        self.assertEqual(back.pk, first.pk)  # the SAME shift
        self.assertEqual(self.shifts().count(), 1)
        shift = self.fresh(first)
        self.assertEqual(shift.segments.count(), 2)
        self.assertEqual(len(presence.breaks_of(shift, self.at(160))), 1)
        self.assertEqual(presence.break_minutes(shift, self.at(160)), 35)  # 10:00 to 10:35
        self.assertEqual(presence.worked_minutes(shift, self.at(160)), 120 + 5)  # 2 h before the break, 5 min after

    def test_a_break_never_ends_the_shift_however_long(self):
        first = self.tick(0, 10)
        self.tick(5, 5)
        presence.evaluate(self.caretaker, self.at(5 + 300))  # nobody reports for 5 hours
        shift = self.fresh(first)
        self.assertIsNone(shift.end_time)  # still the day's shift
        self.assertEqual(presence.phase_of(shift, self.at(305)), 'away')
        back = self.tick(330, 4)
        self.assertEqual((back.pk, self.shifts().count()), (first.pk, 1))

    def test_a_few_seconds_out_of_range_is_gps_noise_not_a_break(self):
        self.tick(0, 10)
        self.tick(10, 5)
        self.tick(10.5, 100)  # a flicker
        shift = self.tick(11, 4)
        self.assertEqual(self.fresh(shift).segments.count(), 1)
        self.assertEqual(presence.breaks_of(self.fresh(shift), self.at(12)), [])

    def test_phase_goes_waiting_active_break_away(self):
        self.tick(0, 100)
        manual = presence.start_manual(self.caretaker, self.at(0))
        self.assertEqual(presence.phase_of(manual, self.at(0)), 'waiting')
        self.tick(5, 4)
        self.assertEqual(presence.phase_of(self.fresh(manual), self.at(5)), 'active')
        self.tick(20, 100)
        self.assertEqual(presence.phase_of(self.fresh(manual), self.at(30)), 'break')
        self.assertEqual(presence.phase_of(self.fresh(manual), self.at(5 + 200)), 'away')

    # ---- a new day is a new shift ----
    def test_new_day_starts_a_new_shift(self):
        monday = self.tick(0, 10)
        self.tick(60, 5)
        tomorrow = self.tick(24 * 60, 5)  # 08:00 the next day
        self.assertNotEqual(tomorrow.pk, monday.pk)
        old = self.fresh(monday)
        self.assertIsNotNone(old.end_time)  # yesterday's shift was closed
        self.assertEqual((old.ended_by, self.worked(old)), ('auto', 60))
        self.assertEqual(self.shifts().count(), 2)

    def test_presence_across_midnight_is_split_between_the_two_days(self):
        old = self.tick(0, 10)  # 08:00
        self.tick(958, 5)  # 23:58, phones report every few seconds in real life
        new = self.tick(962, 5)  # 00:02 the next day, still there
        old = self.fresh(old)
        midnight = self.at(960)
        self.assertEqual(old.end_time, midnight)
        self.assertEqual(self.worked(old), 960)  # 08:00 to midnight
        self.assertNotEqual(new.pk, old.pk)
        self.assertEqual(self.fresh(new).start_time, midnight)  # carries on from 00:00: no minutes lost
        self.assertEqual(self.worked(new, 962), 2)

    def test_if_the_caretaker_was_not_seen_near_midnight_yesterday_ends_when_last_seen(self):
        old = self.tick(0, 10)
        self.tick(900, 5)  # 23:00, then no reports at all
        self.tick(1000, 5)  # 00:40 the next day
        old = self.fresh(old)
        self.assertEqual(old.end_time, self.at(900))  # not counted for the unseen hour
        self.assertEqual(self.worked(old), 900)

    def test_a_manual_shift_that_never_reached_the_elder_is_discarded_when_the_day_closes(self):
        self.tick(0, 100)
        shift = presence.start_manual(self.caretaker, self.at(0))
        presence.evaluate(self.caretaker, self.at(24 * 60 + 5))  # next morning
        self.assertFalse(Shift.objects.filter(pk=shift.pk).exists())

    # ---- manual start and stop ----
    def test_manual_stop_ends_the_days_shift_and_keeps_verified_time(self):
        shift = self.tick(0, 10)
        self.tick(10, 5)
        presence.stop_manual(self.caretaker, self.at(10))
        shift = self.fresh(shift)
        self.assertEqual((shift.ended_by, self.worked(shift)), ('manual', 10))

    def test_no_auto_restart_after_manual_stop_until_the_caretaker_has_left(self):
        first = self.tick(0, 10)
        self.tick(5, 5)
        presence.stop_manual(self.caretaker, self.at(5))
        self.assertIsNone(self.tick(10, 4))  # still standing there: stays ended
        self.tick(15, 100)  # leaves
        self.assertTrue(self.fresh(first).rearmed)
        back = self.tick(20, 4)  # comes back the same day
        self.assertEqual(back.pk, first.pk)  # the same shift continues, not a new one
        self.assertEqual(self.shifts().count(), 1)
        shift = self.fresh(first)
        self.assertEqual((shift.end_time, shift.ended_by, shift.segments.count()), (None, '', 2))

    def test_tapping_start_after_ending_continues_todays_shift(self):
        first = self.tick(0, 10)
        self.tick(5, 5)
        presence.stop_manual(self.caretaker, self.at(5))
        self.tick(10, 100)
        again = presence.start_manual(self.caretaker, self.at(10))
        self.assertEqual(again.pk, first.pk)
        self.assertEqual(self.shifts().count(), 1)
        self.tick(15, 4)
        self.assertIsNotNone(presence.open_segment(self.fresh(first)))

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

    def test_cannot_start_while_on_a_break(self):
        self.tick(0, 10)
        self.tick(5, 5)
        self.tick(10, 100)
        with self.assertRaises(ValueError):
            presence.start_manual(self.caretaker, self.at(20))  # the day's shift is already open

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
