"""First-aid assistant for caretakers: a typed question (English or Kiswahili) in, guidance from the vetted guide out.

The model and guide live in <repo>/ml/firstaid. Messages are not stored: each request is answered and forgotten.
"""
import sys
import threading
from pathlib import Path

from django.conf import settings
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .caretaker_views import require_caretaker

MAX_MESSAGE = 500
_lock = threading.Lock()
_assistant = None


def get_assistant():
    """Load the guide and model once per server process. Raises FileNotFoundError until they are installed."""
    global _assistant
    if _assistant is None:
        with _lock:
            if _assistant is None:
                root = str(Path(settings.VOICE_AI_ROOT))  # the same <repo>/ml folder as the tone model
                if root not in sys.path:
                    sys.path.insert(0, root)
                from firstaid.assistant import FirstAidAssistant

                _assistant = FirstAidAssistant()
    return _assistant


class FirstAidChatView(APIView):
    """POST {message} for a typed question, or {topic} when a suggested answer button is tapped.

    Optional: `awaiting` (the topic whose follow-up question was just asked, so a typed yes/no can answer it) and
    `lang` ('en' or 'sw') to keep the conversation in one language. `check` ('yes' or 'no', sent with the original
    message) answers the safety question "Is someone in danger right now?" (a reply of kind 'check').
    """

    def post(self, request):
        require_caretaker(request.user)
        data = request.data if isinstance(request.data, dict) else {}
        message = data.get('message') or ''
        topic = data.get('topic') or None
        awaiting = data.get('awaiting') or None
        lang = data.get('lang') if data.get('lang') in ('en', 'sw') else None
        check = data.get('check') or None
        if check is not None and check not in ('yes', 'no'):
            raise ValidationError({'check': 'check must be "yes" or "no".'})
        if check and not (isinstance(message, str) and message.strip()):
            raise ValidationError({'message': 'Send the original message with the answer to the safety question.'})
        if not isinstance(message, str) or not all(v is None or isinstance(v, str) for v in (topic, awaiting)):
            raise ValidationError({'detail': 'message, topic and awaiting must be text.'})
        if len(message) > MAX_MESSAGE:
            raise ValidationError({'message': f'Please keep it under {MAX_MESSAGE} characters.'})
        if not message.strip() and not topic:
            raise ValidationError({'message': 'Type a question or choose an option.'})
        try:
            assistant = get_assistant()
        except FileNotFoundError:
            return Response({'detail': 'The first-aid assistant has not been installed on this server yet.'}, status=503)
        if topic and topic not in assistant.guide:
            raise ValidationError({'topic': 'Unknown topic.'})
        return Response(assistant.reply(message=message, topic=topic, awaiting=awaiting, lang=lang, check=check))
