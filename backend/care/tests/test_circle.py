"""The care circle: contacts for chat, and the "I need help" emergency that family and caretakers must all see."""

from datetime import timedelta
from unittest import mock

from django.utils import timezone

from accounts.models import Role
from care import push
from care.models import Alert, Message

from .helpers import FamilyTestCase, client_for, make_user


class ContactsTests(FamilyTestCase):
    def test_everyone_sees_the_rest_of_their_circle(self):
        emails = lambda api: [c['email'] for c in api.get('/api/chat/contacts/').data]
        self.assertEqual(emails(self.elder_api), ['family@example.com', 'care@example.com'])
        self.assertEqual(emails(self.caretaker_api), ['family@example.com', 'elder@example.com'])
        self.assertEqual(emails(self.sponsor_api), ['elder@example.com', 'care@example.com'])

    def test_unread_counts(self):
        self.caretaker_api.post('/api/chat/', {'to': 'elder@example.com', 'body': 'Hi'}, format='json')
        unread = {c['email']: c['unread'] for c in self.elder_api.get('/api/chat/contacts/').data}
        self.assertEqual(unread, {'family@example.com': 0, 'care@example.com': 1})
        self.elder_api.get('/api/chat/?with=care@example.com')  # opening the thread reads it
        self.assertEqual(self.elder_api.get('/api/chat/contacts/').data[1]['unread'], 0)

    def test_a_person_not_linked_yet_has_no_contacts(self):
        loner = client_for(make_user('loner@example.com', 'Loner', Role.CARETAKER))
        self.assertEqual(loner.get('/api/chat/contacts/').data, [])


class EmergencyTests(FamilyTestCase):
    def setUp(self):
        super().setUp()
        self.sent = []
        patcher = mock.patch.object(push, 'notify', side_effect=lambda users, *a, **kw: self.sent.append((users, a, kw)))
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_help_button_reaches_family_and_caretaker_on_the_emergency_channel(self):
        self.elder_api.post('/api/elder/sos/')
        sos = [s for s in self.sent if s[1][2].get('kind') == 'sos']  # the chat messages are pushed too
        self.assertEqual(len(sos), 1)
        users, (title, body, data, channel), kw = sos[0]
        self.assertEqual({u.email for u in users}, {'family@example.com', 'care@example.com'})
        self.assertEqual((channel, kw['urgent']), ('emergency', True))
        self.assertIn('Ella Elder', title)

    def test_open_emergency_is_listed_for_family_caretaker_and_the_elder(self):
        self.elder_api.post('/api/elder/sos/')
        for api in (self.sponsor_api, self.caretaker_api, self.elder_api):
            items = api.get('/api/emergency/').data
            self.assertEqual(len(items), 1)
            self.assertEqual((items[0]['patient']['name'], items[0]['handled_by']), ('Ella Elder', None))
        other = client_for(make_user('other@example.com', 'Other Family'))
        self.assertEqual(other.get('/api/emergency/').data, [])

    def test_first_responder_is_recorded_and_everyone_is_told(self):
        self.elder_api.post('/api/elder/sos/')
        pk = Alert.objects.get().pk
        self.sent.clear()
        r = self.caretaker_api.post(f'/api/emergency/{pk}/handle/')
        self.assertEqual((r.status_code, r.data['handled_by'], r.data['handled_by_me']), (200, 'Cara Care', True))
        told = {u.email for users, *_ in self.sent for u in users}
        self.assertEqual(told, {'family@example.com', 'elder@example.com'})  # not the responder themselves
        # the family responding second does not take it over
        again = self.sponsor_api.post(f'/api/emergency/{pk}/handle/').data
        self.assertEqual((again['handled_by'], again['handled_by_me']), ('Cara Care', False))
        self.assertEqual(self.elder_api.get('/api/emergency/').data[0]['handled_by'], 'Cara Care')
        self.assertIsNone(self.caretaker_api.get('/api/shift/state/').data['emergency'])  # closed for everyone

    def test_handling_on_a_phone_closes_it_on_the_dashboard_with_who_and_when(self):
        self.elder_api.post('/api/elder/sos/')
        pk = Alert.objects.get().pk
        self.caretaker_api.post(f'/api/emergency/{pk}/handle/')
        a = next(x for x in self.sponsor_api.get('/api/dashboard/').data['alerts'] if x['id'] == pk)
        self.assertEqual((a['status'], a['handled_by']), ('confirmed', 'Cara Care'))
        self.assertIsNotNone(a['handled_at'])
        # the other phones get it back closed, so nobody's alarm keeps ringing
        for api in (self.sponsor_api, self.caretaker_api):
            item = api.get('/api/emergency/').data[0]
            self.assertEqual((item['status'], item['handled_by']), ('confirmed', 'Cara Care'))

    def test_handled_on_the_dashboard_closes_it_on_every_phone(self):
        self.elder_api.post('/api/elder/sos/')
        pk = Alert.objects.get().pk
        self.sent.clear()
        r = self.sponsor_api.post(f'/api/alerts/{pk}/', {'status': 'confirmed'}, format='json')
        self.assertEqual((r.status_code, r.data['handled_by']), (200, 'Pat Parent'))
        told = {u.email for users, *_ in self.sent for u in users}
        self.assertEqual(told, {'care@example.com', 'elder@example.com'})
        for api in (self.caretaker_api, self.elder_api):
            item = api.get('/api/emergency/').data[0]
            self.assertEqual((item['status'], item['handled_by']), ('confirmed', 'Pat Parent'))
        # a caretaker answering afterwards does not take it over
        again = self.caretaker_api.post(f'/api/emergency/{pk}/handle/').data
        self.assertEqual((again['handled_by'], again['handled_by_me']), ('Pat Parent', False))

    def test_false_alarm_closes_it_everywhere_and_the_elder_no_longer_sees_it(self):
        self.elder_api.post('/api/elder/sos/')
        pk = Alert.objects.get().pk
        self.sent.clear()
        self.sponsor_api.post(f'/api/alerts/{pk}/', {'status': 'dismissed'}, format='json')
        a = Alert.objects.get()
        self.assertEqual((a.status, a.handled_by.email), ('dismissed', 'family@example.com'))
        self.assertEqual(self.elder_api.get('/api/emergency/').data, [])
        self.assertEqual(self.caretaker_api.get('/api/emergency/').data[0]['status'], 'dismissed')
        self.assertIsNone(self.caretaker_api.get('/api/shift/state/').data['emergency'])
        told = {u.email for users, *_ in self.sent for u in users}
        self.assertEqual(told, {'care@example.com'})  # the elder is not pushed "false alarm"

    def test_closed_emergencies_stop_coming_back_after_a_few_minutes(self):
        from datetime import timedelta
        from django.utils import timezone
        self.elder_api.post('/api/elder/sos/')
        pk = Alert.objects.get().pk
        self.caretaker_api.post(f'/api/emergency/{pk}/handle/')
        Alert.objects.filter(pk=pk).update(handled_at=timezone.now() - timedelta(minutes=11))
        for api in (self.sponsor_api, self.caretaker_api, self.elder_api):
            self.assertEqual(api.get('/api/emergency/').data, [])

    def test_who_may_respond(self):
        self.elder_api.post('/api/elder/sos/')
        pk = Alert.objects.get().pk
        self.assertEqual(self.elder_api.post(f'/api/emergency/{pk}/handle/').status_code, 403)
        other = client_for(make_user('other@example.com', 'Other Family'))
        self.assertEqual(other.post(f'/api/emergency/{pk}/handle/').status_code, 400)  # not their circle

    def test_closed_or_old_emergencies_no_longer_take_over_the_screen(self):
        self.elder_api.post('/api/elder/sos/')
        alert = Alert.objects.get()
        alert.status = Alert.Status.CONFIRMED
        alert.save()
        self.assertEqual(self.sponsor_api.get('/api/emergency/').data, [])
        Alert.objects.filter(pk=alert.pk).update(status=Alert.Status.OPEN, created_at=timezone.now() - timedelta(hours=13))
        self.assertEqual(self.sponsor_api.get('/api/emergency/').data, [])

    def test_help_message_lands_in_each_chat(self):
        self.elder_api.post('/api/elder/sos/')
        self.assertEqual(Message.objects.filter(sender=self.elder).count(), 2)
        thread = self.caretaker_api.get('/api/chat/?with=elder@example.com').data
        self.assertEqual(thread[0]['body'], 'I need help. Please call me now.')
