from datetime import timedelta

from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import Invite, Role, User


def register(api, email='pat@example.com', name='Pat Parent', password='secret1'):
    return api.post('/api/auth/register/', {'name': name, 'email': email, 'password': password}, format='json')


class RegistrationAndLoginTests(TestCase):
    def setUp(self):
        self.api = APIClient()

    def test_everyone_starts_as_a_normal_family_user(self):
        r = register(self.api)
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['role'], Role.USER)
        self.assertIn('token', r.data)

    def test_password_is_hashed_never_stored_plainly(self):
        register(self.api, password='secret1')
        self.assertNotEqual(User.objects.get().password, 'secret1')
        self.assertTrue(User.objects.get().check_password('secret1'))

    def test_duplicate_email_is_rejected_case_insensitively(self):
        register(self.api, email='pat@example.com')
        r = register(self.api, email='PAT@Example.com')
        self.assertEqual(r.status_code, 400)
        self.assertEqual(User.objects.count(), 1)

    def test_validation(self):
        self.assertEqual(register(self.api, name='P').status_code, 400)
        self.assertEqual(register(self.api, email='not-an-email').status_code, 400)
        self.assertEqual(register(self.api, password='abc').status_code, 400)

    def test_login_success_and_failure(self):
        register(self.api)
        ok = self.api.post('/api/auth/login/', {'email': 'pat@example.com', 'password': 'secret1'}, format='json')
        self.assertEqual(ok.status_code, 200)
        bad = self.api.post('/api/auth/login/', {'email': 'pat@example.com', 'password': 'wrong'}, format='json')
        self.assertEqual(bad.status_code, 400)
        self.assertEqual(bad.data['detail'], 'Incorrect email or password.')

    def test_session_lasts_about_three_months(self):
        token = AccessToken(register(self.api).data['token'])
        lifetime = timedelta(seconds=token['exp'] - token['iat'])
        self.assertEqual(lifetime.days, 90)

    def test_protected_endpoint_needs_a_token(self):
        self.assertEqual(self.api.get('/api/me/').status_code, 401)


class RoleLinkingTests(TestCase):
    """A family account adds caretaker / elderly emails; matching accounts are converted automatically."""

    def setUp(self):
        self.api = APIClient()
        self.family = register(self.api).data
        self.family_api = APIClient()
        self.family_api.credentials(HTTP_AUTHORIZATION=f"Bearer {self.family['token']}")

    def add(self, email, role, api=None):
        return (api or self.family_api).post('/api/team/', {'email': email, 'role': role}, format='json')

    def test_existing_account_is_converted_and_linked(self):
        register(self.api, email='cara@example.com', name='Cara Care')
        self.assertEqual(self.add('cara@example.com', 'caretaker').status_code, 201)
        cara = User.objects.get(email='cara@example.com')
        self.assertEqual(cara.role, Role.CARETAKER)
        self.assertEqual(cara.sponsor.email, 'pat@example.com')

    def test_unknown_email_becomes_an_invite_and_applies_on_registration(self):
        self.add('ella@example.com', 'elderly')
        self.assertTrue(Invite.objects.filter(email='ella@example.com').exists())
        registered = register(self.api, email='ella@example.com', name='Ella Elder')
        self.assertEqual(registered.data['role'], Role.ELDERLY)
        self.assertFalse(Invite.objects.filter(email='ella@example.com').exists())

    def test_guards(self):
        register(self.api, email='cara@example.com', name='Cara Care')
        self.add('cara@example.com', 'caretaker')
        self.assertEqual(self.add('cara@example.com', 'caretaker').status_code, 400)  # already in circle
        self.assertEqual(self.add('pat@example.com', 'caretaker').status_code, 400)  # own email
        self.assertEqual(self.add('x@example.com', 'doctor').status_code, 400)  # unknown role
        self.assertEqual(self.add('not-an-email', 'elderly').status_code, 400)

    def test_account_owned_by_another_family_cannot_be_taken(self):
        other = register(self.api, email='other@example.com', name='Other Family').data
        other_api = APIClient()
        other_api.credentials(HTTP_AUTHORIZATION=f"Bearer {other['token']}")
        register(self.api, email='cara@example.com', name='Cara Care')
        self.add('cara@example.com', 'caretaker')
        r = self.add('cara@example.com', 'caretaker', api=other_api)
        self.assertEqual(r.status_code, 400)
        self.assertEqual(User.objects.get(email='cara@example.com').sponsor.email, 'pat@example.com')

    def test_only_family_accounts_may_add_people(self):
        register(self.api, email='cara@example.com', name='Cara Care')
        self.add('cara@example.com', 'caretaker')
        cara_api = APIClient()
        token = self.api.post('/api/auth/login/', {'email': 'cara@example.com', 'password': 'secret1'}, format='json').data['token']
        cara_api.credentials(HTTP_AUTHORIZATION=f'Bearer {token}')
        self.assertEqual(self.add('z@example.com', 'elderly', api=cara_api).status_code, 400)

    def test_profiles_link_the_three_roles_together(self):
        register(self.api, email='cara@example.com', name='Cara Care')
        register(self.api, email='ella@example.com', name='Ella Elder')
        self.add('cara@example.com', 'caretaker')
        self.add('ella@example.com', 'elderly')
        login = lambda e: self.api.post('/api/auth/login/', {'email': e, 'password': 'secret1'}, format='json').data['token']
        for email, role in (('cara@example.com', 'caretaker'), ('ella@example.com', 'elderly')):
            c = APIClient()
            c.credentials(HTTP_AUTHORIZATION=f'Bearer {login(email)}')
            me = c.get('/api/me/').data
            self.assertEqual(me['role'], role)
            self.assertEqual(me['sponsor']['email'], 'pat@example.com')
            self.assertEqual([p['email'] for p in me['caretakers']], ['cara@example.com'])
            self.assertEqual([p['email'] for p in me['elderly']], ['ella@example.com'])
