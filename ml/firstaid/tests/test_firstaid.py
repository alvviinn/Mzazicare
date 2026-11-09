"""Checks that need no trained model: the guide, the safety check, language detection and data labelling."""
import unittest

from firstaid.assistant import danger_topics, detect_lang
from firstaid.data import keyword_matcher, lang_of, vary
from firstaid.knowledge import check, load_guide


class GuideTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guide = load_guide()

    def test_guide_has_no_problems(self):
        self.assertEqual(check(self.guide), [])

    def test_every_life_threatening_topic_says_call_999(self):
        for tid, t in self.guide.items():
            if t['critical']:
                for lang in ('en', 'sw'):
                    self.assertIn('999', t['answer'][lang]['urgent'], f'{tid} {lang}')

    def test_core_topics_exist(self):
        for tid in ('cpr', 'choking_severe', 'heart_attack', 'stroke', 'severe_bleeding', 'fall', 'burns',
                    'low_blood_sugar', 'seizure', 'poisoning'):
            self.assertIn(tid, self.guide)

    def test_checker_catches_mistakes(self):
        broken = {k: dict(v) for k, v in self.guide.items()}
        broken['burns'] = dict(broken['burns'], followup={'ask': None, 'options': [{'goto': 'nowhere', 'label': {}}]})
        problems = check(broken)
        self.assertTrue(any('nowhere' in p for p in problems))


class SafetyCheckTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.guide = load_guide()

    def test_danger_words_in_both_languages(self):
        cases = {
            'he is not breathing': 'cpr',
            'hapumui kabisa': 'cpr',
            'she is choking on meat': 'choking_severe',
            'bibi amekabwa na ugali': 'choking_severe',
            'he has bad chest pain': 'heart_attack',
            'kifua kinamuuma sana': 'heart_attack',
            'her face is drooping': 'stroke',
            'mdomo umepinda ghafla': 'stroke',
            'the bleeding won\'t stop': 'severe_bleeding',
            'damu nyingi inatoka': 'severe_bleeding',
            'he is having a seizure': 'seizure',
            'ana degedege': 'seizure',
            'a snake bit him': 'snake_bite',
            'amekunywa mafuta ya taa': 'poisoning',
        }
        for text, topic in cases.items():
            self.assertIn(topic, danger_topics(text, self.guide), text)

    def test_calm_messages_raise_no_alarm(self):
        for text in ('she twisted her ankle', 'what should be in a first aid kit', 'habari yako', 'how do i clean a small cut'):
            self.assertEqual(danger_topics(text, self.guide), [], text)


class LanguageTests(unittest.TestCase):
    def test_detects_kiswahili_and_english(self):
        self.assertEqual(detect_lang('bibi ameanguka bafuni na hawezi kuinuka'), 'sw')
        self.assertEqual(detect_lang('mzee ana homa kali tangu jana'), 'sw')
        self.assertEqual(detect_lang('my patient fell in the bathroom'), 'en')
        self.assertEqual(lang_of('she is choking'), 'en')


class DataTests(unittest.TestCase):
    def test_keyword_labelling_keeps_only_clear_questions(self):
        match = keyword_matcher(load_guide())
        self.assertEqual(match('How do you treat a nosebleed?'), {'nosebleed'})
        self.assertEqual(match('What should I do after an electric shock?'), {'electric_shock'})  # not plain "shock"
        self.assertEqual(match('What is the capital of Kenya?'), set())
        self.assertGreater(len(match('He had a seizure and then a nosebleed')), 1)  # ambiguous: dropped by the builder

    def test_variations_stay_close_to_the_original(self):
        import random
        rng = random.Random(1)
        for _ in range(50):
            v = vary('she burnt her hand on the stove', 'en', rng)
            self.assertTrue(v)
            self.assertLess(len(v), 120)


if __name__ == '__main__':
    unittest.main()
