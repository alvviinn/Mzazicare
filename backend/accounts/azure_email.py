"""Django email backend for Azure Communication Services (ACS) Email.

Sends the sign-in codes without anyone's personal mailbox: Azure gives the app its own sending address
(DoNotReply@<random>.azurecomm.net, the "Azure managed domain"). Only the ACS connection string is needed:

    ACS_EMAIL_CONNECTION_STRING=endpoint=https://<name>.communication.azure.com/;accesskey=<key>
    EMAIL_FROM=DoNotReply@<random>.azurecomm.net

Talks to the ACS REST API directly (HMAC-signed request, `requests` only), so no Azure SDK is installed.
https://learn.microsoft.com/rest/api/communication/dataplane/email/send
"""

import base64
import hashlib
import hmac
import json
import logging
from email.utils import formatdate, parseaddr
from urllib.parse import urlparse

import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

log = logging.getLogger(__name__)

API_VERSION = '2023-03-31'
TIMEOUT = 15


def parse_connection_string(value):
    """'endpoint=https://x.communication.azure.com/;accesskey=abc==' -> (endpoint without trailing /, key)."""
    parts = {}
    for piece in value.split(';'):
        name, sep, val = piece.partition('=')
        if sep:
            parts[name.strip().lower()] = val.strip()
    endpoint, key = parts.get('endpoint', '').rstrip('/'), parts.get('accesskey', '')
    if not endpoint.startswith('https://') or not key:
        raise ValueError('ACS_EMAIL_CONNECTION_STRING must look like endpoint=https://...;accesskey=...')
    return endpoint, key


def signed_headers(method, url, body, key, date=None):
    """The HMAC-SHA256 headers ACS expects for a request."""
    u = urlparse(url)
    path_and_query = u.path + (f'?{u.query}' if u.query else '')
    date = date or formatdate(usegmt=True)
    content_hash = base64.b64encode(hashlib.sha256(body).digest()).decode()
    to_sign = f'{method}\n{path_and_query}\n{date};{u.netloc};{content_hash}'
    signature = base64.b64encode(hmac.new(base64.b64decode(key), to_sign.encode(), hashlib.sha256).digest()).decode()
    return {
        'x-ms-date': date,
        'x-ms-content-sha256': content_hash,
        'Authorization': f'HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature={signature}',
        'Content-Type': 'application/json',
    }


class AzureEmailBackend(BaseEmailBackend):
    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self.endpoint, self.key = parse_connection_string(settings.ACS_EMAIL_CONNECTION_STRING)

    def _payload(self, message):
        sender = parseaddr(message.from_email or settings.DEFAULT_FROM_EMAIL)[1]  # ACS takes a bare address
        content = {'subject': message.subject, 'plainText': message.body}
        for alt, mime in getattr(message, 'alternatives', []):
            if mime == 'text/html':
                content['html'] = alt
        return {
            'senderAddress': sender,
            'recipients': {
                'to': [{'address': a} for a in message.to],
                **({'cc': [{'address': a} for a in message.cc]} if message.cc else {}),
                **({'bcc': [{'address': a} for a in message.bcc]} if message.bcc else {}),
            },
            'content': content,
        }

    def send_messages(self, email_messages):
        sent = 0
        url = f'{self.endpoint}/emails:send?api-version={API_VERSION}'
        for message in email_messages:
            if not message.recipients():
                continue
            body = json.dumps(self._payload(message)).encode()
            try:
                r = requests.post(url, data=body, headers=signed_headers('POST', url, body, self.key), timeout=TIMEOUT)
                if r.status_code != 202:  # ACS accepts the message and delivers it asynchronously
                    raise OSError(f'Azure email refused the message: HTTP {r.status_code} {r.text[:300]}')
                sent += 1
            except (requests.RequestException, OSError):
                if not self.fail_silently:
                    raise
                log.exception('Azure email failed')
        return sent
