"""The medical word list that keeps health messages from being turned away (firstaid/lexicon.py)."""
import json
import unittest

from firstaid import lexicon
from firstaid.config import ARTIFACTS

GUIDE = json.loads((ARTIFACTS / 'guide.json').read_text(encoding='utf-8'))


class LexiconTests(unittest.TestCase):
    def test_clinical_and_kiswahili_words_name_the_situation(self):
        cases = {
            'Laceration': ['severe_bleeding', 'minor_wound'],
            'epistaxis': ['nosebleed'],
            'syncope': ['fainting'],
            'he is vomiting blood': ['internal_bleeding'],
            'anatapika damu': ['internal_bleeding'],
            'my dad says he wants to kill himself': ['mental_health_crisis'],
            'anataka kujiua': ['mental_health_crisis'],
            'dislocated shoulder': ['fracture'],
            'kichwa kinauma sana': ['headache'],
            "he's burning hot and shivering": ['fever'],
        }
        for text, expected in cases.items():
            self.assertEqual(lexicon.topics(text, GUIDE)[:len(expected)], expected, text)

    def test_life_threatening_first(self):
        self.assertEqual(lexicon.topics('he fell and now he is unconscious', GUIDE)[0], 'unresponsive_breathing')

    def test_every_topic_it_names_exists_in_the_guide(self):
        for _, names in lexicon.TERMS:
            for name in names:
                self.assertIn(name, GUIDE, name)

    def test_idioms_objects_and_animals_are_not_first_aid(self):
        for text in ('my laptop is overheating', 'the chicken is burnt', 'my boss gave me a heart attack with that email',
                     'drowning in debt', "ng'ombe wangu ana homa", 'i fell asleep during the sermon'):
            self.assertTrue(lexicon.about_a_thing(text), text)
        for text in ('my mum burnt her hand on the jiko', 'he fell off the bed'):
            self.assertFalse(lexicon.about_a_thing(text), text)

    def test_health_messages_are_recognised(self):
        self.assertTrue(lexicon.is_health('my back hurts'))
        self.assertTrue(lexicon.is_health('mgonjwa ana maumivu'))
        self.assertFalse(lexicon.is_health('what will the weather be tomorrow'))


if __name__ == '__main__':
    unittest.main()
