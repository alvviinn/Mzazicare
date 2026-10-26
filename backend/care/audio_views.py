"""Voice tone capture: who may be recorded, and when.

Both phones (the caretaker's and the elderly person's) send short clips, but only while

  * the caretaker is verified within range of the elderly person (an open shift segment), and
  * BOTH of them have agreed to voice tone monitoring.

Outside a shift, for example when the caretaker is at home, nothing is recorded and the server refuses clips.
The phones ask `GET /audio/status/` before every clip, so the server's answer is the only switch.
Each clip is analysed in memory and dropped; only the tone numbers are kept.
"""

from datetime import timedelta

from django.conf import settings
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import BaseParser
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User

from . import presence, voice_ai
from .models import Alert

CHUNK_S = 10  # how long the phones record at a time


def with_in_range_shift(user, now):
    """The shift this phone is part of right now, if the caretaker is verified near the elderly person."""
    if user.role == Role.CARETAKER:
        shift = presence.evaluate(user, now)
        return shift if shift and presence.open_segment(shift) else None
    if user.role == Role.ELDERLY and user.sponsor_id:
        for caretaker in User.objects.filter(sponsor_id=user.sponsor_id, role=Role.CARETAKER):
            shift = presence.evaluate(caretaker, now)
            if shift and shift.elderly_id == user.pk and presence.open_segment(shift):
                return shift
    return None


def session_for(user, now):
    """(shift or None, reason). `reason` is '' when recording is allowed."""
    if user.role not in (Role.CARETAKER, Role.ELDERLY):
        return None, 'not_a_participant'
    shift = with_in_range_shift(user, now)
    if not shift:
        return None, 'no_shift'  # not on a verified visit: never listen
    if user.voice_consent_at is None:
        return shift, 'you_have_not_agreed'
    if shift.caretaker.voice_consent_at is None or shift.elderly.voice_consent_at is None:
        return shift, 'other_has_not_agreed'  # the other person must agree too
    return shift, ''


class RawAudioParser(BaseParser):
    """Accepts the audio clip as the raw request body (Content-Type: audio/...)."""

    media_type = 'audio/*'

    def parse(self, stream, media_type=None, parser_context=None):
        return stream.read(settings.VOICE_AUDIO_MAX_BYTES + 1)


class StatusView(APIView):
    """GET /api/audio/status/ : should this phone be recording right now?"""

    def get(self, request):
        user = request.user
        shift, reason = session_for(user, timezone.now())
        return Response(
            {
                'record': reason == '' and shift is not None,
                'reason': reason,
                'consent': user.voice_consent_at is not None,
                'chunk_s': CHUNK_S,
            }
        )


class ConsentView(APIView):
    """POST /api/audio/consent/ {consent: true|false}. Each person decides for themselves, and can change their mind."""

    def post(self, request):
        user = request.user
        if user.role not in (Role.CARETAKER, Role.ELDERLY):
            raise PermissionDenied('Only caretakers and elderly people take part in voice monitoring.')
        agree = request.data.get('consent')
        if not isinstance(agree, bool):
            raise ValidationError({'detail': 'Send consent as true or false.'})
        user.voice_consent_at = timezone.now() if agree else None
        user.save(update_fields=['voice_consent_at'])
        return Response({'consent': agree})


class ToneView(APIView):
    """A phone sends a short clip. It is analysed in memory and thrown away; only the tone shares are kept."""

    parser_classes = [RawAudioParser]

    def post(self, request):
        user = request.user
        if user.role not in (Role.CARETAKER, Role.ELDERLY):
            raise PermissionDenied('Only caretakers and elderly people take part in voice monitoring.')
        audio = request.data
        if not isinstance(audio, (bytes, bytearray)) or not audio:
            raise ValidationError({'detail': 'Send the audio clip as the request body.'})
        if len(audio) > settings.VOICE_AUDIO_MAX_BYTES:
            return Response({'detail': 'Clip is too large.'}, status=413)

        now = timezone.now()
        shift, reason = session_for(user, now)
        if reason == 'no_shift':
            return Response({'detail': 'Audio is only analysed during a verified shift.'}, status=409)
        if reason:
            return Response({'detail': 'Voice monitoring needs both people to agree first.'}, status=403)

        try:
            result = voice_ai.get_analyzer().analyze(bytes(audio))
        except FileNotFoundError:
            return Response({'detail': 'The tone model has not been installed on this server yet.'}, status=503)
        except Exception:
            return Response({'detail': 'That audio could not be read. Send a WAV, FLAC, OGG, M4A or 3GP clip.'}, status=400)
        finally:
            del audio  # nothing from the recording outlives this request

        voice_ai.add_to_shift(shift, result, at=now, source=user.role)

        if result['distress']:
            recent = Alert.objects.filter(
                sponsor_id=user.sponsor_id, kind=Alert.Kind.VOCAL, created_at__gte=now - timedelta(minutes=30)
            )
            if not recent.exists():
                Alert.objects.create(
                    sponsor_id=user.sponsor_id,
                    shift=shift,
                    kind=Alert.Kind.VOCAL,
                    message='Angry-sounding voices were picked up during the visit. Please check in with both of them.',
                )
        return Response(
            {
                'speech_s': result['speech_s'],
                'dominant': result['dominant'],
                'tones': result['tones'],
                'distress': result['distress'],
            }
        )
