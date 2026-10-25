"""The shift list and the shift detail that both the caretaker and the family can open."""

from datetime import timedelta

from care import presence
from care.models import Chore, Shift, ShiftSegment, ToneReading

from .helpers import FamilyTestCase, client_for, make_user


class ShiftViewsTests(FamilyTestCase):
    def make_day(self, days_ago=1):
        """A finished day: 08:00-10:00 and 10:30-13:00, one 30 minute break, ended at the end of the day."""
        base = presence.day_start() - timedelta(days=days_ago) + timedelta(hours=8)
        shift = Shift.objects.create(
            caretaker=self.caretaker, elderly=self.elder, start_time=base, end_time=base + timedelta(hours=5),
            ended_by='auto', source='auto',
        )
        ShiftSegment.objects.create(shift=shift, start=base, end=base + timedelta(hours=2))
        ShiftSegment.objects.create(shift=shift, start=base + timedelta(hours=2, minutes=30), end=base + timedelta(hours=5))
        Chore.objects.create(shift=shift, description='Lunch', is_done=True, done_at=base + timedelta(hours=4))
        Chore.objects.create(shift=shift, description='Walk', is_done=False)
        return shift

    def test_detail_shows_arrival_break_return_and_departure(self):
        shift = self.make_day()
        d = self.caretaker_api.get(f'/api/shifts/{shift.pk}/').data
        self.assertEqual([e['kind'] for e in d['timeline']], ['arrived', 'stepped_out', 'returned', 'left'])
        self.assertEqual(d['timeline'][2]['break_minutes'], 30)
        self.assertEqual(d['timeline'][3]['note'], 'End of the day')
        self.assertEqual((d['minutes'], d['break_minutes'], d['breaks']), (270, 30, 1))
        self.assertEqual(len(d['segments']), 2)
        self.assertEqual([(b['minutes'], b['end'] is not None) for b in d['breaks_list']], [(30, True)])
        self.assertEqual((d['chores_done'], d['chores_total']), (1, 2))
        self.assertEqual(d['status'], 'ended')

    def test_family_sees_the_same_shift_plus_the_tone_of_the_visit(self):
        shift = self.make_day()
        ToneReading.objects.create(shift=shift, tone='neutral', percent=100, seconds=60)
        as_family = self.sponsor_api.get(f'/api/shifts/{shift.pk}/').data
        as_caretaker = self.caretaker_api.get(f'/api/shifts/{shift.pk}/').data
        self.assertEqual(as_family['timeline'], as_caretaker['timeline'])
        self.assertIn('tones', as_family)
        self.assertNotIn('tones', as_caretaker)  # the tone analysis is for the family, not the caretaker's own screen

    def test_other_people_cannot_open_the_shift(self):
        shift = self.make_day()
        stranger = client_for(make_user('stranger@example.com', 'Stranger'))
        other_caretaker = client_for(make_user('other@example.com', 'Other Carer', 'caretaker', make_user('f2@example.com', 'F2')))
        for api in (stranger, other_caretaker, self.elder_api):
            self.assertEqual(api.get(f'/api/shifts/{shift.pk}/').status_code, 404)
        self.assertEqual(self.caretaker_api.get('/api/shifts/99999/').status_code, 404)

    def test_list_has_one_card_per_day_newest_first(self):
        old, newer = self.make_day(3), self.make_day(1)
        for api in (self.caretaker_api, self.sponsor_api):
            cards = api.get('/api/shifts/').data
            self.assertEqual([c['id'] for c in cards], [newer.pk, old.pk])
            self.assertEqual(cards[0]['breaks'], 1)
            self.assertIn('date', cards[0])

    def test_list_is_not_available_to_the_elderly(self):
        self.assertEqual(self.elder_api.get('/api/shifts/').status_code, 403)

    def test_caretaker_never_sees_another_caretakers_days_in_their_list(self):
        self.make_day()
        other = make_user('other@example.com', 'Other Carer', 'caretaker', self.sponsor)  # same family, other caretaker
        self.assertEqual(client_for(other).get('/api/shifts/').data, [])
        self.assertEqual(len(self.sponsor_api.get('/api/shifts/').data), 1)

    def test_live_shift_state_reports_the_phase_and_todays_card(self):
        self.put_in_range(5)
        state = self.caretaker_api.get('/api/shift/state/').data
        self.assertEqual(state['phase'], 'active')
        self.assertEqual(state['today']['status'], 'on_shift')
        self.put_in_range(100)
        state = self.caretaker_api.get('/api/shift/state/').data
        self.assertEqual((state['phase'], state['today']['status']), ('break', 'paused'))
        self.assertEqual(state['today']['breaks'], 1)  # the break is on the record straight away

    def test_todays_shift_can_still_be_opened_after_tapping_end(self):
        self.put_in_range(5)
        self.caretaker_api.get('/api/shift/state/')
        self.caretaker_api.post('/api/shift/stop/')
        state = self.caretaker_api.get('/api/shift/state/').data
        self.assertEqual((state['status'], state['phase']), ('none', 'ended'))
        self.assertIsNotNone(state['today'])
        self.assertEqual(self.caretaker_api.get(f"/api/shifts/{state['today']['id']}/").status_code, 200)

    def test_hours_recent_uses_the_day_cards(self):
        self.make_day()
        recent = self.caretaker_api.get('/api/hours/').data['recent']
        self.assertEqual((recent[0]['minutes'], recent[0]['breaks'], recent[0]['break_minutes']), (270, 1, 30))
