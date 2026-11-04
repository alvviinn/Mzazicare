"""Sign in with Google: the app or web page gets an ID token from Google and the backend checks it here.

The token must be signed by Google, unexpired, issued for one of our own client IDs (GOOGLE_CLIENT_IDS) and carry a
verified email address. The backend still issues its own JWT afterwards, exactly as for a password sign-in.
"""

from django.conf import settings
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token
from rest_framework.exceptions import ValidationError

_transport = google_requests.Request()  # caches Google's public keys between calls


def verify_id_token(token):
    """The verified claims of a Google ID token: sub, email, name."""
    if not settings.GOOGLE_CLIENT_IDS:
        raise ValidationError({'detail': 'Google sign-in is not set up on this server.'})
    if not token or not isinstance(token, str):
        raise ValidationError({'detail': 'Google sign-in did not complete. Please try again.'})
    try:
        # audience=None here, checked below against every client ID we use (web, Android, iOS)
        claims = id_token.verify_oauth2_token(token, _transport, audience=None)
    except ValueError:
        raise ValidationError({'detail': 'Google sign-in could not be verified. Please try again.'})
    if claims.get('aud') not in settings.GOOGLE_CLIENT_IDS:
        raise ValidationError({'detail': 'This Google sign-in was not made for MzaziCare.'})
    if claims.get('iss') not in ('accounts.google.com', 'https://accounts.google.com'):
        raise ValidationError({'detail': 'Google sign-in could not be verified. Please try again.'})
    if not claims.get('email') or not claims.get('email_verified'):
        raise ValidationError({'detail': 'Your Google account needs a verified email address.'})
    return {
        'sub': claims['sub'],
        'email': claims['email'].strip().lower(),
        'name': (claims.get('name') or claims['email'].split('@')[0]).strip()[:150],
    }
