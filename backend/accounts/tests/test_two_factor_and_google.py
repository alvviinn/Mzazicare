from datetime import timedelta
from unittest import mock

from django.core import mail
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from accounts import two_factor
from accounts.models import Invite, LoginChallenge, Role, User

from .test_auth_and_roles import last_code, register, register_only

PASSWORD = 'secret1'


def login_step(api, email='pat@example.com', password=PASSWORD):
    return api.post('/api/auth/login/', {'email': email, 'password': password}, format='json')


def verify(api, challenge, code):
    return api.post('/api/auth/verify/', {'challenge': challenge, 'code': code}, format='json')


class EmailCodeTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def test_a_new_account_gets_a_code_instead_of_a_token(self):
        r = register_only(self.api)
        self.assertEqual(r.status_code, 201)
        self.assertNotIn('token', r.data)
        self.assertTrue(r.data['two_factor'])
        self.assertEqual(r.data['sent_to'], 'p***@example.com')
        self.assertNotIn('dev_code', r.data)
        self.assertEqual(mail.outbox[-1].to, ['pat@example.com'])
        self.assertRegex(last_code(), r'^\d{6}$')
        self.assertTrue(User.objects.get().two_factor_required)

    def test_every_password_sign_in_of_a_new_account_needs_the_code(self):
        register(self.api)
        r = login_step(self.api)
        self.assertNotIn('token', r.data)
        ok = verify(self.api, r.data['challenge'], last_code())
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.data['name'], 'Pat Parent')
        self.assertEqual(self._me(ok.data['token']).status_code, 200)

    def test_existing_accounts_keep_signing_in_with_the_password_alone(self):
        User.objects.create_user('old@example.com', PASSWORD, name='Old Account')  # made before two-step sign-in
        mail.outbox.clear()
        r = login_step(self.api, 'old@example.com')
        self.assertEqual(r.status_code, 200)
        self.assertIn('token', r.data)
        self.assertEqual(mail.outbox, [])

    def test_a_wrong_password_sends_no_code(self):
        register(self.api)
        mail.outbox.clear()
        self.assertEqual(login_step(self.api, password='wrong').status_code, 400)
        self.assertEqual(mail.outbox, [])

    def test_wrong_codes_are_limited(self):
        register(self.api)
        challenge = login_step(self.api).data['challenge']
        good = last_code()
        wrong = '000000' if good != '000000' else '111111'
        for left in (4, 3, 2, 1):
            r = verify(self.api, challenge, wrong)
            self.assertEqual(r.status_code, 400)
            self.assertIn(f'{left} tr', r.data['detail'])
        r = verify(self.api, challenge, wrong)
        self.assertTrue(r.data['expired'])
        self.assertEqual(verify(self.api, challenge, good).status_code, 400)  # spent, even with the right code

    def test_a_code_works_once_and_only_with_its_challenge(self):
        register(self.api)
        challenge = login_step(self.api).data['challenge']
        code = last_code()
        self.assertEqual(verify(self.api, 'made-up', code).status_code, 400)
        self.assertEqual(verify(self.api, challenge, f' {code[:3]} {code[3:]} ').status_code, 200)  # spaces are fine
        self.assertEqual(verify(self.api, challenge, code).status_code, 400)
        self.assertFalse(LoginChallenge.objects.exists())

    def test_codes_expire_after_ten_minutes(self):
        register(self.api)
        challenge = login_step(self.api).data['challenge']
        LoginChallenge.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        r = verify(self.api, challenge, last_code())
        self.assertEqual(r.status_code, 400)
        self.assertTrue(r.data['expired'])

    def test_only_the_newest_sign_in_attempt_counts(self):
        register(self.api)
        first = login_step(self.api).data['challenge']
        first_code = last_code()
        login_step(self.api)
        self.assertEqual(verify(self.api, first, first_code).status_code, 400)

    def test_resend_waits_a_little_and_replaces_the_code(self):
        register(self.api)
        challenge = login_step(self.api).data['challenge']
        old = last_code()
        self.assertIn('wait', self.api.post('/api/auth/resend/', {'challenge': challenge}, format='json').data['detail'])
        LoginChallenge.objects.update(last_sent_at=timezone.now() - two_factor.RESEND_AFTER)
        r = self.api.post('/api/auth/resend/', {'challenge': challenge}, format='json')
        self.assertEqual(r.status_code, 200)
        new = last_code()
        if new != old:  # (one in a million they match)
            self.assertEqual(verify(self.api, challenge, old).status_code, 400)
        self.assertEqual(verify(self.api, challenge, new).status_code, 200)

    def test_only_hashes_are_stored(self):
        register(self.api)
        challenge = login_step(self.api).data['challenge']
        row = LoginChallenge.objects.get()
        self.assertNotIn(last_code(), (row.code_hash, row.token_hash))
        self.assertNotEqual(row.token_hash, challenge)

    def test_registration_is_undone_if_the_code_cannot_be_emailed(self):
        with self.assertLogs('accounts.two_factor', 'ERROR'), mock.patch(
            'accounts.two_factor.send_mail', side_effect=OSError('smtp down')
        ):
            r = register_only(self.api)
        self.assertEqual(r.status_code, 400)
        self.assertIn('could not send', r.data['detail'])
        self.assertFalse(User.objects.exists())

    @override_settings(TWO_FACTOR_ECHO_CODE=True)
    def test_development_echo_returns_the_code(self):
        self.assertEqual(register_only(self.api).data['dev_code'], last_code())

    def _me(self, token):
        c = APIClient()
        c.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        return c.get('/api/me/')


WEB_ID = 'web-client.apps.googleusercontent.com'


def google_claims(**extra):
    return {
        'iss': 'https://accounts.google.com',
        'aud': WEB_ID,
        'sub': 'google-123',
        'email': 'Pat@Example.com',
        'email_verified': True,
        'name': 'Pat Parent',
        **extra,
    }


@override_settings(GOOGLE_CLIENT_IDS=[WEB_ID])
class GoogleSignInTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def google(self, **claims):
        with mock.patch('accounts.google.id_token.verify_oauth2_token', return_value=google_claims(**claims)):
            return self.api.post('/api/auth/google/', {'id_token': 'a-google-id-token'}, format='json')

    def test_first_google_sign_in_creates_an_account_without_a_code(self):
        r = self.google()
        self.assertEqual(r.status_code, 201)
        self.assertIn('token', r.data)
        self.assertEqual(mail.outbox, [])
        user = User.objects.get()
        self.assertEqual((user.email, user.name, user.google_sub, user.role), ('pat@example.com', 'Pat Parent', 'google-123', Role.USER))
        self.assertFalse(user.has_usable_password())
        self.assertEqual(self.google().status_code, 200)  # next time: the same account
        self.assertEqual(User.objects.count(), 1)

    def test_google_links_to_an_existing_account_with_the_same_email(self):
        old = User.objects.create_user('pat@example.com', PASSWORD, name='Pat')
        r = self.google()
        self.assertEqual(r.status_code, 200)
        old.refresh_from_db()
        self.assertEqual(old.google_sub, 'google-123')
        self.assertTrue(old.check_password(PASSWORD))  # the password still works too
        self.assertFalse(old.two_factor_required)  # an existing account stays as it was

    def test_new_account_from_google_takes_its_invite(self):
        family = User.objects.create_user('fam@example.com', PASSWORD, name='Fam')
        Invite.objects.create(email='pat@example.com', role=Role.CARETAKER, sponsor=family)
        self.google()
        user = User.objects.get(email='pat@example.com')
        self.assertEqual((user.role, user.sponsor), (Role.CARETAKER, family))
        self.assertFalse(Invite.objects.exists())

    def test_tokens_for_other_apps_or_unverified_emails_are_refused(self):
        self.assertEqual(self.google(aud='someone-elses-app').status_code, 400)
        self.assertEqual(self.google(email_verified=False).status_code, 400)
        self.assertEqual(self.google(iss='https://evil.example.com').status_code, 400)
        self.assertFalse(User.objects.exists())

    def test_a_forged_token_is_refused(self):
        with mock.patch('accounts.google.id_token.verify_oauth2_token', side_effect=ValueError('bad signature')):
            r = self.api.post('/api/auth/google/', {'id_token': 'forged'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.api.post('/api/auth/google/', {}, format='json').status_code, 400)

    def test_an_email_already_linked_to_another_google_account_is_refused(self):
        User.objects.create_user('pat@example.com', PASSWORD, name='Pat', google_sub='google-999')
        self.assertEqual(self.google().status_code, 400)

    @override_settings(GOOGLE_CLIENT_IDS=[])
    def test_off_when_not_configured(self):
        r = self.google()
        self.assertEqual(r.status_code, 400)
        self.assertIn('not set up', r.data['detail'])
