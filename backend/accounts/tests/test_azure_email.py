import base64
import hashlib
import hmac
import json
from unittest import mock

from django.core.mail import EmailMessage, get_connection
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from accounts import azure_email
from accounts.models import User

from .test_auth_and_roles import register_only

KEY = base64.b64encode(b'not-a-real-key-0123456789').decode()
CONN = f'endpoint=https://mzazi-mail.communication.azure.com/;accesskey={KEY}'
SENDER = 'DoNotReply@abc123.azurecomm.net'
AZURE = {'EMAIL_BACKEND': 'accounts.azure_email.AzureEmailBackend', 'ACS_EMAIL_CONNECTION_STRING': CONN,
         'DEFAULT_FROM_EMAIL': f'MzaziCare <{SENDER}>'}


def accepted():
    return mock.Mock(status_code=202, text='')


class ConnectionStringTests(TestCase):
    def test_parses_endpoint_and_key(self):
        self.assertEqual(azure_email.parse_connection_string(CONN),
                         ('https://mzazi-mail.communication.azure.com', KEY))

    def test_rejects_a_broken_string(self):
        for bad in ('', 'endpoint=https://x.communication.azure.com/', 'accesskey=abc', 'endpoint=http://x;accesskey=a'):
            with self.assertRaises(ValueError):
                azure_email.parse_connection_string(bad)


class SigningTests(TestCase):
    def test_signature_follows_the_acs_hmac_scheme(self):
        url = 'https://mzazi-mail.communication.azure.com/emails:send?api-version=2023-03-31'
        body = b'{"a": 1}'
        date = 'Tue, 10 Nov 2026 12:00:00 GMT'
        h = azure_email.signed_headers('POST', url, body, KEY, date=date)
        content_hash = base64.b64encode(hashlib.sha256(body).digest()).decode()
        to_sign = (f'POST\n/emails:send?api-version=2023-03-31\n'
                   f'{date};mzazi-mail.communication.azure.com;{content_hash}')
        sig = base64.b64encode(hmac.new(base64.b64decode(KEY), to_sign.encode(), hashlib.sha256).digest()).decode()
        self.assertEqual(h['x-ms-date'], date)
        self.assertEqual(h['x-ms-content-sha256'], content_hash)
        self.assertEqual(h['Authorization'],
                         f'HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature={sig}')


@override_settings(**AZURE)
class BackendTests(TestCase):
    def test_sends_one_request_with_the_message(self):
        with mock.patch('accounts.azure_email.requests.post', return_value=accepted()) as post:
            n = EmailMessage('Your code: 123456', 'Your code is 123456', to=['pat@example.com']).send()
        self.assertEqual(n, 1)
        url, = post.call_args.args
        self.assertEqual(url, 'https://mzazi-mail.communication.azure.com/emails:send?api-version=2023-03-31')
        body = json.loads(post.call_args.kwargs['data'])
        self.assertEqual(body['senderAddress'], SENDER)  # display name stripped: ACS wants the bare address
        self.assertEqual(body['recipients'], {'to': [{'address': 'pat@example.com'}]})
        self.assertEqual(body['content'], {'subject': 'Your code: 123456', 'plainText': 'Your code is 123456'})
        self.assertIn('HMAC-SHA256', post.call_args.kwargs['headers']['Authorization'])

    def test_a_refusal_raises(self):
        refused = mock.Mock(status_code=401, text='{"error":{"code":"Denied"}}')
        with mock.patch('accounts.azure_email.requests.post', return_value=refused):
            with self.assertRaises(OSError):
                EmailMessage('s', 'b', to=['pat@example.com']).send()

    def test_fail_silently_counts_nothing(self):
        refused = mock.Mock(status_code=500, text='')
        with self.assertLogs('accounts.azure_email', 'ERROR'), mock.patch(
            'accounts.azure_email.requests.post', return_value=refused
        ):
            n = get_connection(fail_silently=True).send_messages([EmailMessage('s', 'b', to=['pat@example.com'])])
        self.assertEqual(n, 0)

    def test_registration_emails_the_code_through_azure(self):
        with mock.patch('accounts.azure_email.requests.post', return_value=accepted()) as post:
            r = register_only(APIClient())
        self.assertEqual(r.status_code, 201)
        body = json.loads(post.call_args.kwargs['data'])
        self.assertEqual(body['recipients']['to'], [{'address': 'pat@example.com'}])
        self.assertRegex(body['content']['plainText'], r'sign-in code is \d{6}')

    def test_registration_is_undone_if_azure_refuses(self):
        refused = mock.Mock(status_code=403, text='')
        with self.assertLogs('accounts.two_factor', 'ERROR'), mock.patch(
            'accounts.azure_email.requests.post', return_value=refused
        ):
            r = register_only(APIClient())
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.exists())
