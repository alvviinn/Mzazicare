"""Who may be recorded and when: both phones, only during a verified shift, only with both people's consent."""

import io
from unittest import skipUnless
from unittest.mock import patch

from care import voice_ai
from care.models import ToneSample

from .helpers import FamilyTestCase
from .test_tone_endpoint import MODEL, FakeAnalyzer


class ConsentTests(FamilyTestCase):
    def consent(self, api, value):
        return api.post('/api/audio/consent/', {'consent': value}, format='json')

    def test_each_person_agrees_for_themselves_and_can_withdraw(self):
        self.assertEqual(self.consent(self.caretaker_api, True).status_code, 200)
        self.caretaker.refresh_from_db()
        self.assertIsNotNone(self.caretaker.voice_consent_at)
        self.assertTrue(self.caretaker_api.get('/api/me/').data['voice_consent'])
        self.consent(self.caretaker_api, False)
        self.caretaker.refresh_from_db()
        self.assertIsNone(self.caretaker.voice_consent_at)
        self.assertFalse(self.caretaker_api.get('/api/me/').data['voice_consent'])

    def test_family_cannot_consent_for_others_or_themselves(self):
        self.assertEqual(self.consent(self.sponsor_api, True).status_code, 403)

    def test_consent_must_be_a_real_yes_or_no(self):
        self.assertEqual(self.consent(self.elder_api, 'yes').status_code, 400)
        self.assertEqual(self.caretaker_api.post('/api/audio/consent/', {}, format='json').status_code, 400)


class WhenToRecordTests(FamilyTestCase):
    def status(self, api):
        return api.get('/api/audio/status/').data

    def test_nobody_is_recorded_without_a_verified_shift(self):
        self.consent_all()
        self.put_in_range(metres=500)  # the caretaker is at home
        for api in (self.caretaker_api, self.elder_api):
            s = self.status(api)
            self.assertFalse(s['record'])
            self.assertEqual(s['reason'], 'no_shift')

    def test_no_locations_at_all_means_no_recording(self):
        self.consent_all()
        self.assertEqual(self.status(self.caretaker_api)['reason'], 'no_shift')

    def test_both_phones_record_during_a_shift_once_both_agreed(self):
        self.consent_all()
        self.put_in_range()
        for api in (self.caretaker_api, self.elder_api):
            s = self.status(api)
            self.assertTrue(s['record'], s)
            self.assertEqual(s['reason'], '')
            self.assertTrue(s['consent'])

    def test_one_person_not_agreeing_stops_both_phones(self):
        self.put_in_range()
        self.caretaker_api.post('/api/audio/consent/', {'consent': True}, format='json')
        self.assertEqual(self.status(self.caretaker_api)['reason'], 'other_has_not_agreed')
        s = self.status(self.elder_api)
        self.assertEqual((s['record'], s['reason'], s['consent']), (False, 'you_have_not_agreed', False))
        self.elder_api.post('/api/audio/consent/', {'consent': True}, format='json')
        self.assertTrue(self.status(self.elder_api)['record'])

    def test_recording_stops_when_the_caretaker_walks_away(self):
        self.consent_all()
        self.put_in_range()
        self.assertTrue(self.status(self.caretaker_api)['record'])
        self.put_in_range(metres=300)
        self.assertFalse(self.status(self.caretaker_api)['record'])
        self.assertFalse(self.status(self.elder_api)['record'])

    def test_the_family_account_is_never_asked_to_record(self):
        self.consent_all()
        self.put_in_range()
        self.assertFalse(self.status(self.sponsor_api)['record'])


class ClipUploadTests(FamilyTestCase):
    def post(self, api):
        return api.post('/api/audio/tone/', data=b'RIFFxxxx', content_type='audio/wav')

    def test_clips_from_both_phones_land_on_the_same_shift_with_their_source(self):
        self.consent_all()
        self.put_in_range()
        with patch.object(voice_ai, 'get_analyzer', return_value=FakeAnalyzer()):
            self.assertEqual(self.post(self.caretaker_api).status_code, 200)
            self.assertEqual(self.post(self.elder_api).status_code, 200)
        self.assertEqual(sorted(ToneSample.objects.values_list('source', flat=True)), ['caretaker', 'elderly'])
        self.assertEqual(ToneSample.objects.values('shift').distinct().count(), 1)

    def test_clip_outside_a_shift_is_refused_and_nothing_is_kept(self):
        self.consent_all()
        self.put_in_range(metres=400)
        with patch.object(voice_ai, 'get_analyzer', side_effect=AssertionError('must not be analysed')):
            self.assertEqual(self.post(self.caretaker_api).status_code, 409)
            self.assertEqual(self.post(self.elder_api).status_code, 409)
        self.assertEqual(ToneSample.objects.count(), 0)

    def test_clip_without_both_consents_is_refused_before_it_is_analysed(self):
        self.put_in_range()
        self.caretaker_api.post('/api/audio/consent/', {'consent': True}, format='json')
        with patch.object(voice_ai, 'get_analyzer', side_effect=AssertionError('must not be analysed')):
            self.assertEqual(self.post(self.caretaker_api).status_code, 403)
            self.assertEqual(self.post(self.elder_api).status_code, 403)
        self.assertEqual(ToneSample.objects.count(), 0)


def aac_clip(seconds=4):
    """What the Android phones send: AAC in an .m4a (MPEG-4) container."""
    import av
    import numpy as np

    rate = 16000
    buf = io.BytesIO()
    rng = np.random.default_rng(3)
    t = np.arange(rate * seconds) / rate
    pcm = 0.2 * np.sin(2 * np.pi * 180 * t) * (1 + np.sin(2 * np.pi * 3 * t)) + 0.02 * rng.standard_normal(len(t))
    with av.open(buf, 'w', format='mp4') as out:
        stream = out.add_stream('aac', rate=rate)
        stream.layout = 'mono'
        frame = av.AudioFrame.from_ndarray((pcm * 32767).astype('int16')[None, :], format='s16', layout='mono')
        frame.sample_rate = rate
        for packet in stream.encode(frame):
            out.mux(packet)
        for packet in stream.encode(None):
            out.mux(packet)
    return buf.getvalue()


@skipUnless(MODEL.exists(), 'trained model not present')
class PhoneFormatTests(FamilyTestCase):
    def test_the_real_model_reads_an_aac_m4a_clip_like_the_phones_send(self):
        self.consent_all()
        self.put_in_range()
        r = self.caretaker_api.post('/api/audio/tone/', data=aac_clip(), content_type='audio/mp4')
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(set(r.data['tones']), {'happy', 'calm', 'neutral', 'stressed', 'angry'})
