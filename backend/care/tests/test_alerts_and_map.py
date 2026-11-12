"""Evidence shown with alerts, severity order, and the shift map (trail + geofence) for the family."""
from datetime import timedelta

from django.utils import timezone

from care.models import Alert, Shift, TrackPoint

from .helpers import LAT, LON, METRE, FamilyTestCase, place


class AlertEvidenceTests(FamilyTestCase):
    def alerts(self):
        return self.sponsor_api.get('/api/dashboard/').data['alerts']

    def test_sos_alert_names_the_patient_and_where_the_phone_was(self):
        place(self.elder, 0, accuracy=8)
        self.elder_api.post('/api/elder/sos/')
        a = self.alerts()[0]
        self.assertEqual((a['kind'], a['patient'], a['severity']), ('sos', 'Ella Elder', 3))
        self.assertAlmostEqual(a['position']['latitude'], LAT)
        self.assertEqual(a['position']['accuracy'], 8)

    def test_an_old_position_is_not_shown_as_evidence(self):
        place(self.elder, 0, at=timezone.now() - timedelta(hours=2))
        self.elder_api.post('/api/elder/sos/')
        self.assertIsNone(self.alerts()[0]['position'])

    def test_open_alerts_come_most_severe_first(self):
        Alert.objects.create(sponsor=self.sponsor, kind=Alert.Kind.SHORT, message='short')
        Alert.objects.create(sponsor=self.sponsor, kind=Alert.Kind.SOS, message='sos', status=Alert.Status.DISMISSED)
        Alert.objects.create(sponsor=self.sponsor, kind=Alert.Kind.UNWELL, message='unwell')
        Alert.objects.create(sponsor=self.sponsor, kind=Alert.Kind.SOS, message='sos open')
        self.assertEqual([a['message'] for a in self.alerts()], ['sos open', 'unwell', 'short', 'sos'])


class ShiftMapTests(FamilyTestCase):
    def report(self, api, metres_north, accuracy=5):
        return api.post(
            '/api/location/',
            {'latitude': LAT + metres_north * METRE, 'longitude': LON, 'accuracy': accuracy},
            format='json',
        )

    def test_positions_are_kept_only_while_a_shift_is_open(self):
        self.report(self.caretaker_api, 500)  # no shift yet: nothing is kept
        self.assertEqual(TrackPoint.objects.count(), 0)
        place(self.elder, 0)
        self.report(self.caretaker_api, 5)  # in range: the shift starts, this fix is kept
        self.report(self.caretaker_api, 6)  # too soon after the last one: skipped
        self.assertEqual(TrackPoint.objects.filter(who='caretaker').count(), 1)
        self.report(self.elder_api, 0)
        self.assertEqual(TrackPoint.objects.filter(who='elderly').count(), 1)

    def test_family_sees_the_trail_and_geofence_the_caretaker_does_not(self):
        place(self.elder, 0)
        self.report(self.caretaker_api, 5)
        self.report(self.elder_api, 0)
        shift = Shift.objects.get()
        TrackPoint.objects.filter(shift=shift).update(at=timezone.now() - timedelta(minutes=5))
        self.report(self.caretaker_api, 8)

        data = self.sponsor_api.get(f'/api/shifts/{shift.pk}/').data['map']
        self.assertEqual(data['radius_m'], 15)
        self.assertAlmostEqual(data['centre']['latitude'], LAT)
        self.assertEqual(len(data['trail']), 2)
        self.assertNotIn('map', self.caretaker_api.get(f'/api/shifts/{shift.pk}/').data)

    def test_trail_is_deleted_with_the_shift(self):
        place(self.elder, 0)
        self.report(self.caretaker_api, 5)
        Shift.objects.all().delete()
        self.assertEqual(TrackPoint.objects.count(), 0)


class DemoDataTests(FamilyTestCase):
    def test_sample_data_has_a_map_trail_and_alert_evidence(self):
        from io import StringIO

        from django.core.management import call_command

        call_command('seed_demo', self.sponsor.email, stdout=StringIO())
        shift = Shift.objects.filter(is_demo=True).first()
        data = self.sponsor_api.get(f'/api/shifts/{shift.pk}/').data['map']
        self.assertIsNotNone(data['centre'])
        self.assertGreater(len(data['trail']), 0)
        vocal = [a for a in self.sponsor_api.get('/api/dashboard/').data['alerts'] if a['kind'] == 'vocal_distress'][0]
        self.assertEqual(vocal['patient'], 'Ella Elder')
        self.assertIsNotNone(vocal['position'])
