from datetime import timedelta

from django.utils import timezone

from accounts.models import Role
from care.models import Alert, Shift, ShiftSegment, ToneReading
from care.views import tone_summary

from .helpers import FamilyTestCase, client_for, make_user


class ChatTests(FamilyTestCase):
    def send(self, api, to, body='Hello'):
        return api.post('/api/chat/', {'to': to, 'body': body}, format='json')

    def test_family_chats_separately_with_each_person(self):
        self.send(self.sponsor_api, 'care@example.com', 'Morning Cara')
        self.send(self.sponsor_api, 'elder@example.com', 'Hi Mama')
        with_cara = self.sponsor_api.get('/api/chat/?with=care@example.com').data
        with_ella = self.sponsor_api.get('/api/chat/?with=elder@example.com').data
        self.assertEqual([m['body'] for m in with_cara], ['Morning Cara'])
        self.assertEqual([m['body'] for m in with_ella], ['Hi Mama'])

    def test_caretaker_and_elderly_cannot_chat_with_each_other(self):
        self.assertEqual(self.send(self.caretaker_api, 'elder@example.com').status_code, 403)
        self.assertEqual(self.caretaker_api.get('/api/chat/?with=elder@example.com').status_code, 403)

    def test_outsiders_cannot_chat_with_the_family(self):
        stranger = client_for(make_user('stranger@example.com', 'Stranger'))
        self.assertEqual(self.send(stranger, 'care@example.com').status_code, 403)

    def test_unread_count_clears_when_the_thread_is_opened(self):
        self.send(self.caretaker_api, 'family@example.com')
        unread = lambda: self.sponsor_api.get('/api/dashboard/').data['caretakers'][0]['unread']
        self.assertEqual(unread(), 1)
        self.sponsor_api.get('/api/chat/?with=care@example.com')
        self.assertEqual(unread(), 0)

    def test_message_validation(self):
        self.assertEqual(self.send(self.sponsor_api, 'care@example.com', '   ').status_code, 400)
        self.assertEqual(self.send(self.sponsor_api, 'care@example.com', 'x' * 2001).status_code, 400)


class AlertTests(FamilyTestCase):
    def test_family_confirms_or_dismisses_and_open_alerts_come_first(self):
        old = Alert.objects.create(sponsor=self.sponsor, kind=Alert.Kind.VOCAL, message='old open')
        new = Alert.objects.create(sponsor=self.sponsor, kind=Alert.Kind.SHORT, message='new', status=Alert.Status.DISMISSED)
        listed = self.sponsor_api.get('/api/dashboard/').data['alerts']
        self.assertEqual([a['id'] for a in listed], [old.pk, new.pk])
        self.assertEqual(self.sponsor_api.post(f'/api/alerts/{old.pk}/', {'status': 'confirmed'}, format='json').status_code, 200)
        old.refresh_from_db()
        self.assertEqual(old.status, 'confirmed')

    def test_bad_status_and_other_families_alerts(self):
        mine = Alert.objects.create(sponsor=self.sponsor, kind=Alert.Kind.VOCAL, message='x')
        self.assertEqual(self.sponsor_api.post(f'/api/alerts/{mine.pk}/', {'status': 'open'}, format='json').status_code, 400)
        stranger = client_for(make_user('stranger@example.com', 'Stranger'))
        self.assertEqual(stranger.post(f'/api/alerts/{mine.pk}/', {'status': 'confirmed'}, format='json').status_code, 400)
        mine.refresh_from_db()
        self.assertEqual(mine.status, 'open')


class DashboardTests(FamilyTestCase):
    def test_dashboard_is_for_family_accounts_only(self):
        self.assertEqual(self.caretaker_api.get('/api/dashboard/').status_code, 403)
        self.assertEqual(self.elder_api.get('/api/dashboard/').status_code, 403)

    def test_not_matched_until_a_caretaker_and_an_elderly_person_are_linked(self):
        lonely = make_user('solo@example.com', 'Solo')
        self.assertFalse(client_for(lonely).get('/api/dashboard/').data['matched'])
        self.assertTrue(self.sponsor_api.get('/api/dashboard/').data['matched'])

    def test_today_chores_are_the_caretakers_own_to_do_list(self):
        self.caretaker_api.post('/api/tasks/', {'title': 'Lunch'}, format='json')
        chores = self.sponsor_api.get('/api/dashboard/').data['today']['chores']
        self.assertEqual([c['description'] for c in chores], ['Lunch'])

    def test_live_shift_shows_as_on_shift_then_paused(self):
        self.put_in_range(5)
        self.caretaker_api.get('/api/shift/state/')
        self.assertEqual(self.sponsor_api.get('/api/dashboard/').data['today']['status'], 'on_shift')
        self.put_in_range(100)
        self.assertEqual(self.sponsor_api.get('/api/dashboard/').data['today']['status'], 'paused')


class ToneSummaryTests(FamilyTestCase):
    def shift_with(self, **percents):
        s = Shift.objects.create(caretaker=self.caretaker, elderly=self.elder, start_time=timezone.now() - timedelta(hours=2),
                                 end_time=timezone.now(), ended_by='manual')
        ShiftSegment.objects.create(shift=s, start=s.start_time, end=s.end_time)
        for tone in ('happy', 'calm', 'neutral', 'stressed', 'angry'):
            ToneReading.objects.create(shift=s, tone=tone, percent=percents.get(tone, 0))
        return s

    def summary(self, shift):
        return tone_summary([Shift.objects.prefetch_related('tones', 'segments').get(pk=shift.pk)])

    def test_percentages_add_up_to_exactly_100(self):
        s = self.shift_with(happy=33, calm=33, neutral=34)
        self.assertEqual(sum(i['percent'] for i in self.summary(s)['items']), 100)

    def test_mostly_neutral_conversation_is_rated_good_not_penalised(self):
        s = self.shift_with(neutral=80, calm=10, happy=5, stressed=3, angry=2)
        r = self.summary(s)
        self.assertEqual((r['dominant'], r['quality']), ('neutral', 'good'))

    def test_quality_follows_the_stressed_plus_angry_share(self):
        self.assertEqual(self.summary(self.shift_with(neutral=70, stressed=15, angry=15))['quality'], 'fair')
        self.assertEqual(self.summary(self.shift_with(neutral=40, stressed=30, angry=30))['quality'], 'needs_attention')

    def test_no_readings_means_no_rating(self):
        s = Shift.objects.create(caretaker=self.caretaker, elderly=self.elder, start_time=timezone.now())
        self.assertIsNone(self.summary(s)['quality'])
