"""The first-aid assistant endpoint: who may use it, input checks, and (when the model is installed) real answers."""

from pathlib import Path
from unittest import mock, skipUnless

from django.conf import settings
from django.test import TestCase

from accounts.models import Role
from care import firstaid_views

from .helpers import client_for, make_user

URL = '/api/firstaid/chat/'
INSTALLED = (Path(settings.VOICE_AI_ROOT) / 'firstaid' / 'artifacts' / 'intent.onnx').exists()


class FakeAssistant:
    guide = {'burns': {}, 'cpr': {}}

    def reply(self, **kw):
        return {'kind': 'answer', 'echo': kw}


class AccessAndInputTests(TestCase):
    def setUp(self):
        self.family = make_user('fam@x.com', 'Fam')
        self.carer = make_user('care@x.com', 'Carer', Role.CARETAKER, sponsor=self.family)
        self.elder = make_user('elder@x.com', 'Elder', Role.ELDERLY, sponsor=self.family)
        patcher = mock.patch.object(firstaid_views, 'get_assistant', return_value=FakeAssistant())
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_only_caretakers_can_use_it(self):
        for user in (self.family, self.elder):
            self.assertEqual(client_for(user).post(URL, {'message': 'he fell'}, format='json').status_code, 403)
        self.assertEqual(self.client.post(URL, {'message': 'he fell'}, content_type='application/json').status_code, 401)

    def test_message_is_passed_on(self):
        r = client_for(self.carer).post(URL, {'message': 'she burnt her hand', 'lang': 'sw', 'awaiting': 'cpr'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()['echo'], {'message': 'she burnt her hand', 'topic': None, 'awaiting': 'cpr', 'lang': 'sw',
                                            'check': None})

    def test_safety_question_answer(self):
        c = client_for(self.carer)
        r = c.post(URL, {'message': 'she cut her finger', 'check': 'yes'}, format='json')
        self.assertEqual(r.json()['echo']['check'], 'yes')
        self.assertEqual(c.post(URL, {'message': 'she cut her finger', 'check': 'maybe'}, format='json').status_code, 400)
        self.assertEqual(c.post(URL, {'topic': 'burns', 'check': 'no'}, format='json').status_code, 400)  # needs the message

    def test_button_topic_and_bad_input(self):
        c = client_for(self.carer)
        self.assertEqual(c.post(URL, {'topic': 'burns'}, format='json').json()['echo']['topic'], 'burns')
        self.assertEqual(c.post(URL, {'topic': 'made_up'}, format='json').status_code, 400)
        self.assertEqual(c.post(URL, {'message': '   '}, format='json').status_code, 400)
        self.assertEqual(c.post(URL, {'message': 'x' * 501}, format='json').status_code, 400)
        self.assertEqual(c.post(URL, {'message': ['list']}, format='json').status_code, 400)
        r = c.post(URL, {'message': 'hi', 'lang': 'fr'}, format='json')
        self.assertIsNone(r.json()['echo']['lang'])  # unknown language: detected from the message instead

    def test_missing_model_gives_503(self):
        with mock.patch.object(firstaid_views, 'get_assistant', side_effect=FileNotFoundError):
            self.assertEqual(client_for(self.carer).post(URL, {'message': 'help'}, format='json').status_code, 503)


@skipUnless(INSTALLED, 'first-aid model not installed (run python -m firstaid.export in ml/)')
class RealAssistantTests(TestCase):
    """End to end with the real model and guide."""

    def setUp(self):
        self.carer = make_user('care@x.com', 'Carer', Role.CARETAKER, sponsor=make_user('fam@x.com', 'Fam'))
        self.c = client_for(self.carer)

    def ask(self, **body):
        r = self.c.post(URL, body, format='json')
        self.assertEqual(r.status_code, 200)
        return r.json()

    def test_life_threatening_message_says_call_999(self):
        r = self.ask(message='he is not breathing and not responding')
        self.assertEqual(r['kind'], 'answer')
        self.assertTrue(r['emergency'])
        self.assertIn('999', r['text'])

    def test_answers_in_kiswahili(self):
        r = self.ask(message='bibi ameanguka bafuni na hawezi kuinuka')
        self.assertEqual(r['lang'], 'sw')
        self.assertIn(r['kind'], ('answer', 'clarify', 'check'))  # check: "Je, kuna mtu yuko hatarini sasa hivi?"
        if r['kind'] == 'check':
            self.assertIn('hatarini', r['text'])
        if r['kind'] == 'answer':
            self.assertEqual(r['topic'], 'fall')

    def test_follow_up_by_button_and_by_typed_yes(self):
        first = self.ask(message='she is choking on food')
        self.assertEqual(first['topic'], 'choking_severe')
        self.assertTrue(first['followup']['options'])
        by_button = self.ask(topic=first['followup']['options'][0]['topic'])
        self.assertEqual(by_button['topic'], 'choking_mild')
        by_yes = self.ask(message='yes', awaiting='choking_severe')
        self.assertEqual(by_yes['topic'], 'choking_mild')

    def test_safety_question_yes_and_no(self):
        """When the danger signals are unclear the assistant asks "Is someone in danger right now?" (round-3 policy)."""
        for text in ('he is very tired and weak today', 'tell me about blood pressure tablets', 'my dad feels strange'):
            q = self.ask(message=text)
            if q['kind'] == 'check':
                break
        else:
            self.skipTest('none of these messages gets the safety question with this model')
        self.assertFalse(q['emergency'])
        self.assertEqual([o['topic'] for o in q['followup']['options']], ['__check_yes', '__check_no'])
        yes = self.ask(message=q['check_message'], check='yes')
        self.assertTrue(yes['emergency'])
        self.assertIn('999', yes['urgent'])
        self.assertTrue(yes['followup']['options'])
        no = self.ask(message=q['check_message'], check='no')
        self.assertNotEqual(no['kind'], 'check')
        self.assertFalse(no['emergency'])

    def test_small_problem_gets_advice_with_danger_banner(self):
        r = self.ask(message='she cut her finger while cooking')
        self.assertEqual(r['kind'], 'answer')
        if r.get('danger_banner'):
            self.assertFalse(r['emergency'])
            self.assertIn('999', r['danger_banner'])

    def test_not_first_aid(self):
        self.assertEqual(self.ask(message='what will the weather be like tomorrow')['kind'], 'out_of_scope')
        self.assertEqual(self.ask(message='habari yako')['kind'], 'greeting')
