"""Two-step sign-in with a 6-digit code sent by email.

Accounts created after this was added (`User.two_factor_required`) get a code after their password; accounts that
existed before keep signing in with the password alone. Google sign-in skips the code: Google has verified the person.

The client receives a `challenge` (a random token) and must send it back with the code, so a code alone is useless.
Only hashes of the challenge and the code are stored.
"""

import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .models import LoginChallenge

log = logging.getLogger(__name__)

CODE_TTL = timedelta(minutes=10)
MAX_ATTEMPTS = 5  # wrong codes before the challenge is spent
RESEND_AFTER = timedelta(seconds=30)
MAX_SENDS = 5


def _hash(value):
    return hmac.new(settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def mask_email(email):
    """a***@gmail.com : enough to recognise, not enough to harvest."""
    local, _, domain = email.partition('@')
    return f'{local[:1]}***@{domain}'


def _send_code(challenge, code):
    send_mail(
        subject=f'Your MzaziCare code: {code}',
        message=(
            f'Your MzaziCare sign-in code is {code}\n\n'
            f'It expires in {int(CODE_TTL.total_seconds() // 60)} minutes. '
            'If you did not try to sign in, you can ignore this email and nobody can get in without the code.'
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[challenge.user.email],
    )


def _new_code():
    return f'{secrets.randbelow(1_000_000):06d}'


def _payload(challenge, token, code):
    data = {
        'two_factor': True,
        'challenge': token,
        'sent_to': mask_email(challenge.user.email),
        'expires_in': int(CODE_TTL.total_seconds()),
    }
    if settings.TWO_FACTOR_ECHO_CODE:  # local development without an email account only (see settings)
        data['dev_code'] = code
    return data


def start(user):
    """Create a challenge for this user and email them a code. Returns what the client needs for the next step."""
    LoginChallenge.objects.filter(user=user).delete()  # only the newest sign-in attempt counts
    token, code = secrets.token_urlsafe(32), _new_code()
    now = timezone.now()
    challenge = LoginChallenge.objects.create(
        user=user, token_hash=_hash(token), code_hash=_hash(code), expires_at=now + CODE_TTL, sends=1, last_sent_at=now
    )
    _deliver(challenge, code)
    return _payload(challenge, token, code)


def _deliver(challenge, code):
    try:
        _send_code(challenge, code)
    except Exception:  # SMTP down or misconfigured: say so instead of leaving the person waiting for an email
        log.exception('Could not email a sign-in code')
        challenge.delete()
        raise ValidationError({'detail': 'We could not send the code by email. Please try again in a few minutes.'})


def _find(token):
    challenge = (
        LoginChallenge.objects.select_related('user').filter(token_hash=_hash(token or '')).first() if token else None
    )
    if not challenge or challenge.expires_at <= timezone.now():
        raise ValidationError({'detail': 'This code has expired. Sign in again to get a new one.', 'expired': True})
    return challenge


def resend(token):
    challenge = _find(token)
    now = timezone.now()
    if challenge.sends >= MAX_SENDS:
        raise ValidationError({'detail': 'Too many codes sent. Sign in again to start over.', 'expired': True})
    if now - challenge.last_sent_at < RESEND_AFTER:
        wait = int((RESEND_AFTER - (now - challenge.last_sent_at)).total_seconds()) + 1
        raise ValidationError({'detail': f'Please wait {wait} seconds before asking for another code.'})
    code = _new_code()
    challenge.code_hash = _hash(code)
    challenge.attempts = 0
    challenge.sends += 1
    challenge.last_sent_at = now
    challenge.expires_at = now + CODE_TTL
    challenge.save()
    _deliver(challenge, code)
    return _payload(challenge, token, code)


def verify(token, code):
    """The user behind this challenge if the code is right; otherwise a clear error."""
    challenge = _find(token)
    code = ''.join(ch for ch in str(code or '') if ch.isdigit())
    if challenge.attempts >= MAX_ATTEMPTS:
        challenge.delete()
        raise ValidationError({'detail': 'Too many wrong codes. Sign in again to get a new one.', 'expired': True})
    if not hmac.compare_digest(challenge.code_hash, _hash(code)):
        challenge.attempts += 1
        challenge.save(update_fields=['attempts'])
        left = MAX_ATTEMPTS - challenge.attempts
        if left <= 0:
            challenge.delete()
            raise ValidationError({'detail': 'Too many wrong codes. Sign in again to get a new one.', 'expired': True})
        raise ValidationError({'detail': f'That code is not right. {left} tr{"y" if left == 1 else "ies"} left.'})
    user = challenge.user
    challenge.delete()  # a code works once
    return user
