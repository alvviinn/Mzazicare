from care.models import Alert, Shift

from .helpers import FamilyTestCase, place


class ShiftApiTests(FamilyTestCase):
    def test_shift_starts_by_itself_when_both_phones_report_close_together(self):
        place(self.elder, 0)
        self.caretaker_api.post('/api/location/', {'latitude': -1.29205, 'longitude': 36.8219, 'accuracy': 5}, format='json')
        state = self.caretaker_api.get('/api/shift/state/').data
        self.assertEqual((state['status'], state['source'], state['range']['state']), ('active', 'auto', 'in'))
        self.assertEqual(state['elderly']['name'], 'Ella Elder')

    def test_state_before_any_location_is_unknown(self):
        state = self.caretaker_api.get('/api/shift/state/').data
        self.assertEqual((state['status'], state['range']['state']), ('none', 'unknown'))

    def test_manual_start_is_gone(self):
        """Shifts only start by themselves (in range). Older apps still call start: they get a clear refusal."""
        self.put_in_range(100)  # away from the elderly person
        r = self.caretaker_api.post('/api/shift/start/')
        self.assertEqual(r.status_code, 400)
        self.assertIn('start by themselves', r.data['detail'])
        self.assertEqual(Shift.objects.count(), 0)

    def test_manual_stop(self):
        self.put_in_range(5)
        self.caretaker_api.get('/api/shift/state/')  # in range: the shift starts automatically
        stopped = self.caretaker_api.post('/api/shift/stop/').data
        self.assertEqual(stopped['status'], 'none')
        self.assertEqual(self.caretaker_api.post('/api/shift/stop/').status_code, 400)  # nothing to stop

    def test_hours_summary(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')
        hours = self.caretaker_api.get('/api/hours/').data
        self.assertEqual(len(hours['recent']), 1)
        self.assertEqual({'today', 'week', 'month', 'total'} <= set(hours), True)

    def test_fake_location_raises_an_alert_for_the_family_once(self):
        for _ in range(2):
            self.caretaker_api.post('/api/location/', {'latitude': -1.2, 'longitude': 36.8, 'mocked': True}, format='json')
        self.assertEqual(Alert.objects.filter(sponsor=self.sponsor, kind=Alert.Kind.GEOFENCE).count(), 1)

    def test_location_validation_and_roles(self):
        bad = self.caretaker_api.post('/api/location/', {'latitude': 95, 'longitude': 36.8}, format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(self.sponsor_api.post('/api/location/', {'latitude': -1.2, 'longitude': 36.8}, format='json').status_code, 403)

    def test_only_caretakers_use_shift_endpoints(self):
        for api in (self.sponsor_api, self.elder_api):
            self.assertEqual(api.get('/api/shift/state/').status_code, 403)
            self.assertEqual(api.post('/api/shift/start/').status_code, 403)

    def test_an_open_emergency_is_shown_to_the_caretaker(self):
        self.elder_api.post('/api/elder/sos/')
        state = self.caretaker_api.get('/api/shift/state/').data
        self.assertIn('emergency button', state['emergency']['message'])
        self.assertEqual(Shift.objects.count(), 0)
