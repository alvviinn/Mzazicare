from datetime import datetime

from django.utils import timezone

from care.elder_views import medicines_json
from care.models import Alert, CheckIn, Medication, Message

from .helpers import FamilyTestCase


class ElderEndpointsTests(FamilyTestCase):
    def test_feeling_check_in(self):
        self.assertEqual(self.elder_api.post('/api/elder/checkin/', {'mood': 'angry'}, format='json').status_code, 400)
        self.assertEqual(self.elder_api.post('/api/elder/checkin/', {'mood': 'good'}, format='json').status_code, 201)
        self.assertEqual(self.elder_api.get('/api/elder/home/').data['mood_today']['mood'], 'good')
        self.assertFalse(Alert.objects.exists())  # a good day alerts nobody

    def test_not_feeling_well_alerts_the_family_once_in_three_hours(self):
        for _ in range(2):
            self.elder_api.post('/api/elder/checkin/', {'mood': 'unwell'}, format='json')
        self.assertEqual(Alert.objects.filter(kind=Alert.Kind.UNWELL, sponsor=self.sponsor).count(), 1)
        self.assertEqual(CheckIn.objects.count(), 2)

    def test_emergency_button_alerts_and_messages_the_family_without_duplicates(self):
        self.elder_api.post('/api/elder/sos/')
        self.elder_api.post('/api/elder/sos/')  # an accidental double tap
        self.assertEqual(Alert.objects.filter(kind=Alert.Kind.SOS).count(), 1)
        message = Message.objects.get()
        self.assertEqual((message.sender, message.recipient), (self.elder, self.sponsor))

    def test_only_the_elderly_can_use_elder_endpoints(self):
        for api in (self.sponsor_api, self.caretaker_api):
            self.assertEqual(api.post('/api/elder/sos/').status_code, 403)
            self.assertEqual(api.post('/api/elder/checkin/', {'mood': 'good'}, format='json').status_code, 403)
            self.assertEqual(api.get('/api/elder/home/').status_code, 403)

    def test_caretaker_presence_in_plain_terms(self):
        home = lambda: self.elder_api.get('/api/elder/home/').data['caretaker']['status']
        self.assertEqual(home(), 'not_arrived')
        self.put_in_range(5)
        self.caretaker_api.get('/api/shift/state/')
        self.assertEqual(home(), 'here')
        self.put_in_range(100)
        self.caretaker_api.get('/api/shift/state/')
        self.assertEqual(home(), 'away')

    def test_no_caretaker_linked(self):
        self.caretaker.delete()
        self.assertEqual(self.elder_api.get('/api/elder/home/').data['caretaker']['status'], 'none')


class MedicineTests(FamilyTestCase):
    def add(self, **kw):
        body = {'elderly_email': 'elder@example.com', 'name': 'BP tablet', 'dose': '1 tablet', 'time': '08:00', **kw}
        return self.sponsor_api.post('/api/medicines/', body, format='json')

    def test_family_adds_and_removes_a_reminder(self):
        r = self.add()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(self.sponsor_api.delete(f"/api/medicines/{r.data['id']}/").status_code, 204)
        self.assertFalse(Medication.objects.exists())

    def test_validation_and_permissions(self):
        self.assertEqual(self.add(time='25:99').status_code, 400)
        self.assertEqual(self.add(time='8am').status_code, 400)
        self.assertEqual(self.add(name='').status_code, 400)
        self.assertEqual(self.add(elderly_email='care@example.com').status_code, 400)  # not an elderly person
        self.assertEqual(self.caretaker_api.post('/api/medicines/', {}, format='json').status_code, 403)

    def test_elderly_person_marks_it_taken_and_double_taps_are_harmless(self):
        mid = self.add().data['id']
        for _ in range(2):
            self.assertEqual(self.elder_api.post(f'/api/medicines/{mid}/take/').status_code, 201)
        self.assertEqual(self.elder_api.get('/api/elder/home/').data['medicines'][0]['state'], 'taken')

    def test_family_cannot_mark_medicine_as_taken(self):
        mid = self.add().data['id']
        self.assertEqual(self.sponsor_api.post(f'/api/medicines/{mid}/take/').status_code, 403)

    def test_due_missed_and_later_states(self):
        Medication.objects.create(elderly=self.elder, name='Morning', time=datetime(2000, 1, 1, 8, 0).time())
        at = lambda h, m: timezone.make_aware(datetime(2026, 10, 19, h, m))
        state = lambda now: medicines_json(self.elder, now)[0]['state']
        self.assertEqual(state(at(7, 0)), 'later')
        self.assertEqual(state(at(8, 30)), 'due')
        self.assertEqual(state(at(10, 30)), 'missed')
