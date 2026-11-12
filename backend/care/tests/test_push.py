"""Push notifications: phones register a token, new alerts and chat messages are sent to Firebase (FCM)."""

import json
from unittest import mock

from django.test import override_settings

from accounts.models import Role
from care import push
from care.models import Alert, Message, PushDevice

from .helpers import FamilyTestCase, client_for, make_user

TOKEN = 'fcm-token_' + 'A1b2:' * 30  # shaped like a Firebase registration token
FAMILY, CARER, ELDER = ('fam' + 'x' * 60, 'car' + 'x' * 60, 'eld' + 'x' * 60)


class RegisterTests(FamilyTestCase):
    def test_any_role_can_register_and_unregister(self):
        for api in (self.sponsor_api, self.caretaker_api, self.elder_api):
            self.assertEqual(api.post('/api/push/', {'token': TOKEN}, format='json').status_code, 201)
        # the token follows whoever signed in on the phone last
        self.assertEqual(PushDevice.objects.get(token=TOKEN).user, self.elder)
        self.assertEqual(self.elder_api.delete('/api/push/', {'token': TOKEN}, format='json').status_code, 204)
        self.assertFalse(PushDevice.objects.exists())

    def test_rejects_garbage_and_anonymous(self):
        self.assertEqual(self.sponsor_api.post('/api/push/', {'token': 'hello'}, format='json').status_code, 400)
        self.assertEqual(self.sponsor_api.post('/api/push/', {}, format='json').status_code, 400)
        from rest_framework.test import APIClient

        self.assertEqual(APIClient().post('/api/push/', {'token': TOKEN}, format='json').status_code, 401)

    def test_cannot_unregister_someone_elses_phone(self):
        PushDevice.objects.create(user=self.sponsor, token=TOKEN)
        self.caretaker_api.delete('/api/push/', {'token': TOKEN}, format='json')
        self.assertTrue(PushDevice.objects.filter(token=TOKEN).exists())


@override_settings(PUSH_ENABLED=True)
class SendTests(FamilyTestCase):
    def setUp(self):
        super().setUp()
        PushDevice.objects.create(user=self.sponsor, token=FAMILY)
        PushDevice.objects.create(user=self.caretaker, token=CARER)
        PushDevice.objects.create(user=self.elder, token=ELDER)
        self.auth = mock.patch('care.push._auth', return_value=('demo-project', 'access-token'))
        self.auth.start()
        # Send synchronously so the test can look at what went out.
        self.thread = mock.patch('care.push.threading.Thread', side_effect=lambda target, args, daemon: mock.Mock(start=lambda: target(*args)))
        self.thread.start()
        self.post = mock.patch('care.push.requests.Session.post')
        self.posted = self.post.start()
        self.posted.return_value.ok = True

    def tearDown(self):
        self.thread.stop()
        self.post.stop()
        self.auth.stop()

    def sent(self):
        """The FCM messages that went out, with their data payload decoded."""
        out = []
        for call in self.posted.call_args_list:
            self.assertEqual(call.args[0], 'https://fcm.googleapis.com/v1/projects/demo-project/messages:send')
            self.assertEqual(call.kwargs['headers']['Authorization'], 'Bearer access-token')
            m = call.kwargs['json']['message']
            self.assertTrue(all(isinstance(v, str) for v in m['data'].values()))  # FCM data must be strings
            out.append({'to': m['token'], 'title': m['data']['title'], 'body': m['data']['message'],
                        'channelId': m['data']['channelId'], 'priority': m['android']['priority'],
                        'data': json.loads(m['data']['body'])})
        return out

    def test_unwell_alert_goes_to_the_family_only(self):
        with self.captureOnCommitCallbacks(execute=True):
            Alert.objects.create(sponsor=self.sponsor, kind='unwell', message='Ella is not feeling well.')
        [m] = self.sent()
        self.assertEqual(m['to'], FAMILY)
        self.assertEqual((m['title'], m['channelId'], m['priority']), ('Not feeling well', 'alerts', 'HIGH'))
        self.assertEqual(m['data']['type'], 'alert')

    def test_sos_also_reaches_the_caretaker(self):
        with self.captureOnCommitCallbacks(execute=True):
            Alert.objects.create(sponsor=self.sponsor, kind='sos', message='Ella pressed I need help.')
        self.assertEqual({m['to'] for m in self.sent()}, {FAMILY, CARER})

    def test_demo_alerts_are_silent(self):
        with self.captureOnCommitCallbacks(execute=True):
            Alert.objects.create(sponsor=self.sponsor, kind='sos', message='demo', is_demo=True)
        self.assertEqual(self.sent(), [])

    def test_chat_message_goes_to_the_recipient(self):
        with self.captureOnCommitCallbacks(execute=True):
            r = self.caretaker_api.post('/api/chat/', {'to': self.sponsor.email, 'body': 'All good today'}, format='json')
        self.assertEqual(r.status_code, 201)
        [m] = self.sent()
        self.assertEqual((m['to'], m['title'], m['body'], m['channelId']), (FAMILY, 'Cara Care', 'All good today', 'messages'))
        self.assertEqual(m['data'], {'type': 'chat', 'from': self.caretaker.email})

    def test_unregistered_phones_are_forgotten(self):
        self.posted.return_value.ok = False
        self.posted.return_value.status_code = 404
        self.posted.return_value.json.return_value = {
            'error': {'status': 'NOT_FOUND', 'details': [{'@type': 'type.googleapis.com/google.firebase.fcm.v1.FcmError', 'errorCode': 'UNREGISTERED'}]}
        }
        with self.captureOnCommitCallbacks(execute=True):
            Message.objects.create(sender=self.sponsor, recipient=self.elder, body='Hi Mum')
        self.assertFalse(PushDevice.objects.filter(token=ELDER).exists())

    def test_network_errors_never_break_the_request(self):
        import requests

        self.posted.side_effect = requests.ConnectionError('offline')
        with self.captureOnCommitCallbacks(execute=True):
            r = self.sponsor_api.post('/api/chat/', {'to': self.caretaker.email, 'body': 'Hello'}, format='json')
        self.assertEqual(r.status_code, 201)

    def test_nobody_registered_means_nothing_sent(self):
        loner = make_user('other@example.com', 'Other Family')
        helper = make_user('helper@example.com', 'Help Er', Role.CARETAKER, loner)
        with self.captureOnCommitCallbacks(execute=True):
            client_for(helper).post('/api/chat/', {'to': loner.email, 'body': 'Hi'}, format='json')
        self.posted.assert_not_called()


@override_settings(PUSH_ENABLED=False)
class OffSwitchTests(FamilyTestCase):
    def test_disabled_sends_nothing(self):
        PushDevice.objects.create(user=self.sponsor, token=TOKEN)
        with mock.patch('care.push.requests.Session.post') as posted, self.captureOnCommitCallbacks(execute=True):
            Alert.objects.create(sponsor=self.sponsor, kind='sos', message='x')
        posted.assert_not_called()
        self.assertTrue(push.valid_token(TOKEN))


@override_settings(PUSH_ENABLED=True)
class FirebaseConfigTests(FamilyTestCase):
    def test_no_key_configured_sends_nothing(self):
        with mock.patch.dict('os.environ', {}, clear=False) as env, mock.patch('care.push.requests.Session.post') as posted:
            env.pop('FIREBASE_CREDENTIALS_FILE', None)
            env.pop('FIREBASE_CREDENTIALS_B64', None)
            push._credentials = None
            push.deliver([push.build(TOKEN, 't', 'b', {}, 'alerts')])
        posted.assert_not_called()

    def test_a_broken_key_is_logged_not_raised(self):
        with mock.patch.dict('os.environ', {'FIREBASE_CREDENTIALS_FILE': '', 'FIREBASE_CREDENTIALS_B64': 'bm90IGpzb24='}), mock.patch('care.push.requests.Session.post') as posted:
            push._credentials = None
            push.deliver([push.build(TOKEN, 't', 'b', {}, 'alerts')])
        posted.assert_not_called()
        push._credentials = None

    def test_other_errors_keep_the_phone(self):
        PushDevice.objects.create(user=self.sponsor, token=TOKEN)
        res = mock.Mock(ok=False, status_code=400, text='bad')
        res.json.return_value = {'error': {'message': 'Invalid payload', 'details': [{'errorCode': 'INVALID_ARGUMENT'}]}}
        with mock.patch('care.push._auth', return_value=('p', 'a')), mock.patch('care.push.requests.Session.post', return_value=res):
            push.deliver([push.build(TOKEN, 't', 'b', {}, 'alerts')])
        self.assertTrue(PushDevice.objects.filter(token=TOKEN).exists())
