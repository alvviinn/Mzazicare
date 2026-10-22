"""POST /api/audio/tone/ : the caretaker's phone sends a clip; it is analysed in memory and dropped."""

import io
import struct
import wave
from pathlib import Path
from unittest import skipUnless
from unittest.mock import patch

from django.conf import settings

from care import voice_ai
from care.models import Alert, Shift, ToneReading

from .helpers import FamilyTestCase

MODEL = Path(settings.VOICE_AI_ROOT) / 'voice' / 'artifacts' / 'tone_cnn.onnx'


def wav_bytes(seconds=6, rate=16000):
    """A WAV of low-level noise, enough to exercise the real pipeline."""
    import random
    rnd = random.Random(1)
    frames = b''.join(struct.pack('<h', int(rnd.gauss(0, 2500))) for _ in range(int(seconds * rate)))
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(frames)
    return buf.getvalue()


class FakeAnalyzer:
    """Stands in for the model so the endpoint logic can be tested without it."""

    def __init__(self, distress=False):
        self.result = {'duration_s': 9.0, 'windows': 4, 'speech_windows': 4, 'speech_s': 6.0,
                       'tones': {'happy': 0.1, 'calm': 0.1, 'neutral': 0.2, 'stressed': 0.1, 'angry': 0.5},
                       'dominant': 'angry', 'distress': distress}

    def analyze(self, audio):
        return self.result


class ToneEndpointRulesTests(FamilyTestCase):
    def post(self, api, body=b'RIFFxxxx'):
        return api.post('/api/audio/tone/', data=body, content_type='audio/wav')

    def test_only_caretakers_may_send_audio(self):
        self.assertEqual(self.post(self.sponsor_api).status_code, 403)
        self.assertEqual(self.post(self.elder_api).status_code, 403)
        self.assertEqual(self.post(self.caretaker_api.__class__()).status_code, 401)

    def test_audio_is_not_analysed_outside_a_verified_shift(self):
        r = self.post(self.caretaker_api)
        self.assertEqual(r.status_code, 409)
        self.assertEqual(ToneReading.objects.count(), 0)

    def test_empty_and_oversized_clips_are_rejected(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')
        self.assertEqual(self.caretaker_api.post('/api/audio/tone/', data=b'', content_type='audio/wav').status_code, 400)
        big = b'0' * (settings.VOICE_AUDIO_MAX_BYTES + 10)
        self.assertEqual(self.post(self.caretaker_api, big).status_code, 413)

    def test_unreadable_audio_is_a_400_not_a_crash(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')
        with patch.object(voice_ai, 'get_analyzer', return_value=_Broken()):
            self.assertEqual(self.post(self.caretaker_api, b'not audio').status_code, 400)

    def test_missing_model_gives_503(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')
        with patch.object(voice_ai, 'get_analyzer', side_effect=FileNotFoundError):
            self.assertEqual(self.post(self.caretaker_api).status_code, 503)

    def test_results_accumulate_per_shift_and_always_sum_to_100(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')
        with patch.object(voice_ai, 'get_analyzer', return_value=FakeAnalyzer()):
            for _ in range(3):
                self.assertEqual(self.post(self.caretaker_api).status_code, 200)
        rows = ToneReading.objects.filter(shift=Shift.objects.get())
        self.assertEqual(rows.count(), 5)
        self.assertEqual(sum(r.percent for r in rows), 100)
        self.assertAlmostEqual(sum(r.seconds for r in rows), 18.0, places=3)  # 3 clips x 6 s of speech

    def test_distress_raises_one_alert_per_half_hour_for_the_family_to_review(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')
        with patch.object(voice_ai, 'get_analyzer', return_value=FakeAnalyzer(distress=True)):
            self.post(self.caretaker_api)
            self.post(self.caretaker_api)
        alerts = Alert.objects.filter(sponsor=self.sponsor, kind=Alert.Kind.VOCAL)
        self.assertEqual(alerts.count(), 1)
        self.assertEqual(alerts.get().status, 'open')  # a person decides; the AI never punishes

    def test_no_distress_means_no_alert(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')
        with patch.object(voice_ai, 'get_analyzer', return_value=FakeAnalyzer(distress=False)):
            self.post(self.caretaker_api)
        self.assertFalse(Alert.objects.exists())


class _Broken:
    def analyze(self, audio):
        raise ValueError('cannot decode')


@skipUnless(MODEL.exists(), 'trained model not present (ml/voice/artifacts/tone_cnn.onnx)')
class ToneEndpointWithRealModelTests(FamilyTestCase):
    def test_real_model_end_to_end_on_a_synthetic_clip(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')
        r = self.caretaker_api.post('/api/audio/tone/', data=wav_bytes(), content_type='audio/wav')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(set(r.data), {'speech_s', 'dominant', 'tones', 'distress'})
        self.assertEqual(set(r.data['tones']), {'happy', 'calm', 'neutral', 'stressed', 'angry'})
        self.assertAlmostEqual(sum(r.data['tones'].values()), 1.0 if r.data['speech_s'] else 0.0, places=2)
