"""Push notifications sent straight to Firebase Cloud Messaging (FCM HTTP v1), no other service in between.

The Firebase service-account key is a secret and never lives in the repository. Give it to the server as:
  FIREBASE_CREDENTIALS_FILE  path to the key file (local development; set in backend/.env), or
  FIREBASE_CREDENTIALS_B64   the key file's contents, base64-encoded (Azure app setting; scripts/deploy-azure.ps1).
Without either, nothing is sent and the app works as before.

Sending never blocks or breaks a request: it runs after the database commit, in a background thread,
and any error is only logged. PUSH_ENABLED=False switches it off (the test settings do).

Messages are data-only, in the format expo-notifications expects, so the app itself shows them with the
right channel, icon and colour, and a tap opens the right screen
(https://docs.expo.dev/push-notifications/sending-notifications-custom/).
"""

import base64
import json
import logging
import os
import re
import threading

import requests
from django.conf import settings
from django.db import transaction

from .models import PushDevice

log = logging.getLogger(__name__)
SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
SEND_URL = 'https://fcm.googleapis.com/v1/projects/{project}/messages:send'
TOKEN_RE = re.compile(r'^[A-Za-z0-9_\-:.]{32,512}$')  # an FCM registration token
CHANNELS = {'alerts', 'messages'}  # created by the app; Android does not show a message for an unknown channel

_lock = threading.Lock()
_credentials = None


def valid_token(token):
    return bool(TOKEN_RE.match(token or ''))


def enabled():
    return getattr(settings, 'PUSH_ENABLED', os.environ.get('PUSH_ENABLED', '1') != '0')


def _key_info():
    path = os.environ.get('FIREBASE_CREDENTIALS_FILE')
    if path:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    encoded = os.environ.get('FIREBASE_CREDENTIALS_B64')
    if encoded:
        return json.loads(base64.b64decode(encoded))
    return None


def _auth():
    """(project id, OAuth access token) for FCM, refreshed when needed; None when no key is configured."""
    global _credentials
    from google.auth.transport.requests import Request
    from google.oauth2 import service_account

    with _lock:
        if _credentials is None:
            info = _key_info()
            if not info:
                return None
            _credentials = service_account.Credentials.from_service_account_info(info, scopes=[SCOPE])
        if not _credentials.valid:
            _credentials.refresh(Request())
        return _credentials.project_id, _credentials.token


def build(token, title, body, data, channel, urgent=False):
    """One FCM v1 message: data-only, as expo-notifications reads it (all values must be strings)."""
    assert channel in CHANNELS
    return {
        'token': token,
        'android': {'priority': 'HIGH' if urgent else 'NORMAL'},
        'data': {
            'title': title,
            'message': body[:180],
            'channelId': channel,
            'body': json.dumps(data),  # arrives in the app as notification.request.content.data
        },
    }


def deliver(messages):
    """Send each message (FCM v1 takes one per request) and forget phones Firebase no longer knows."""
    try:
        auth = _auth()
    except Exception as e:  # unreadable key, no network for the token, ...
        log.warning('Push not sent (Firebase credentials): %s', e)
        return
    if not auth:
        return
    project, access = auth
    url = SEND_URL.format(project=project)
    headers = {'Authorization': f'Bearer {access}', 'Content-Type': 'application/json'}
    dead = []
    with requests.Session() as http:
        for msg in messages:
            try:
                res = http.post(url, json={'message': msg}, headers=headers, timeout=10)
            except requests.RequestException as e:
                log.warning('Push send failed: %s', e)
                continue
            if res.ok:
                continue
            try:
                error = res.json().get('error', {})
            except ValueError:
                error = {}
            codes = {d.get('errorCode') for d in error.get('details', []) if isinstance(d, dict)}
            if res.status_code == 404 or 'UNREGISTERED' in codes or 'registration token' in error.get('message', ''):
                dead.append(msg['token'])  # app uninstalled, token replaced, or not a real token
            else:
                log.warning('Push rejected (%s): %s', res.status_code, error.get('message', res.text[:200]))
    if dead:
        PushDevice.objects.filter(token__in=dead).delete()


def notify(users, title, body, data, channel, urgent=False):
    """Queue a notification to every phone of these users, sent once the current transaction commits."""
    if not enabled():
        return
    ids = [u.pk for u in users if u is not None]
    if not ids:
        return

    def send():
        tokens = list(PushDevice.objects.filter(user_id__in=ids).values_list('token', flat=True))
        if tokens:
            messages = [build(t, title, body, data, channel, urgent) for t in tokens]
            threading.Thread(target=deliver, args=(messages,), daemon=True).start()

    transaction.on_commit(send)
