"""GET /api/tone/live/ : the family's real-time tone chart, built from per-clip samples."""

from datetime import timedelta
from unittest.mock import patch

from django.utils import timezone

from care import presence, voice_ai
from care.models import Alert, Shift, ToneReading, ToneSample

from .helpers import FamilyTestCase
from .test_tone_endpoint import FakeAnalyzer


class LiveToneTests(FamilyTestCase):
    def sample(self, shift, minutes_ago, **tones):
        shares = {'happy': 0, 'calm': 0, 'neutral': 1, 'stressed': 0, 'angry': 0, **tones}
        return ToneSample.objects.create(
            shift=shift, at=timezone.now() - timedelta(minutes=minutes_ago), speech_s=10, **shares
        )

    def shift_today(self):
        start = max(presence.day_start(), timezone.now() - timedelta(hours=3))
        return Shift.objects.create(caretaker=self.caretaker, elderly=self.elder, start_time=start, is_demo=True)

    def get(self, api=None):
        return (api or self.sponsor_api).get('/api/tone/live/')

    def test_only_the_family_can_see_it(self):
        self.assertEqual(self.get(self.caretaker_api).status_code, 403)
        self.assertEqual(self.get(self.elder_api).status_code, 403)
        self.assertEqual(self.get(self.sponsor_api.__class__()).status_code, 401)

    def test_empty_day(self):
        d = self.get().data
        self.assertEqual((d['state'], d['series'], d['today'], d['current']), ('idle', [], None, None))

    def test_chart_points_current_tone_and_day_stats(self):
        s = self.shift_today()
        self.sample(s, 100, calm=0.8, neutral=0.2)
        self.sample(s, 60, neutral=0.5, stressed=0.5)
        self.sample(s, 2, angry=0.9, stressed=0.1, neutral=0)
        d = self.get().data
        self.assertGreaterEqual(len(d['series']), 2)
        for p in d['series']:
            self.assertEqual(sum(p['shares'].values()), 100)
            self.assertEqual(p['tension'], p['shares']['stressed'] + p['shares']['angry'])
        self.assertEqual(d['current']['dominant'], 'angry')  # last few minutes only
        t = d['today']
        self.assertEqual(sum(i['percent'] for i in t['items']), 100)
        self.assertEqual(t['clips'], 3)
        self.assertEqual(t['speech_minutes'], 0.5)
        self.assertLess(t['calmest']['tension'], t['tensest']['tension'])
        self.assertIn(t['quality'], ('fair', 'needs_attention'))

    def test_state_is_live_only_while_in_range_and_hearing_speech(self):
        s = self.shift_today()
        s.is_demo = False
        s.save()
        self.put_in_range()
        self.sample(s, 1, calm=1, neutral=0)
        self.assertEqual(self.get().data['state'], 'live')
        ToneSample.objects.all().delete()
        self.sample(s, 10, calm=1, neutral=0)  # speech, but not for a while
        self.assertEqual(self.get().data['state'], 'listening')

    def test_earlier_days_give_a_trend_and_a_usual_level(self):
        past = Shift.objects.create(
            caretaker=self.caretaker, elderly=self.elder, start_time=timezone.now() - timedelta(days=2), is_demo=True
        )
        for tone, pct in (('happy', 40), ('calm', 30), ('neutral', 20), ('stressed', 10), ('angry', 0)):
            ToneReading.objects.create(shift=past, tone=tone, percent=pct, seconds=pct * 6)
        self.sample(self.shift_today(), 5, calm=1, neutral=0)
        d = self.get().data
        self.assertEqual([(x['tension'], x['positive']) for x in d['earlier_days']], [(10, 70)])
        self.assertEqual(d['today']['usual_tension'], 10)

    def test_each_analysed_clip_leaves_a_sample_but_no_audio(self):
        self.put_in_range()
        self.caretaker_api.get('/api/shift/state/')
        with patch.object(voice_ai, 'get_analyzer', return_value=FakeAnalyzer(distress=True)):
            self.caretaker_api.post('/api/audio/tone/', data=b'RIFFxxxx', content_type='audio/wav')
        sample = ToneSample.objects.get()
        self.assertEqual((sample.speech_s, sample.angry, sample.distress), (6.0, 0.5, True))
        d = self.get().data
        self.assertEqual(d['state'], 'live')
        self.assertEqual(d['today']['raised_voice_clips'], 1)
        self.assertEqual(d['today']['vocal_alerts'], Alert.objects.filter(kind=Alert.Kind.VOCAL).count())

    def test_shift_detail_carries_the_tone_timeline_for_family_only(self):
        s = self.shift_today()
        self.sample(s, 30, happy=1, neutral=0)
        self.assertEqual(len(self.sponsor_api.get(f'/api/shifts/{s.pk}/').data['tone_timeline']), 1)
        self.assertNotIn('tone_timeline', self.caretaker_api.get(f'/api/shifts/{s.pk}/').data)
