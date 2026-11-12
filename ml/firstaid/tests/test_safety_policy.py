"""safety.decide_check: the safety question and the "advice + danger banner" reply."""
import unittest

import numpy as np

from firstaid.safety import decide_check

LABELS = ['burns', 'cpr', 'out_of_scope', 'general_medical', 'greeting']
GUIDE = {'burns': {'critical': False}, 'cpr': {'critical': True}}
CFG = {'danger': 0.1, 'danger_strong': 0.8, 'critical_conf': 0.9, 'oos': 0.7, 'nontopic': 0.7, 'answer': 0.95}


def probs(*p):
    return np.array(p, dtype=float)


class DecideCheckTests(unittest.TestCase):
    sure_burns = [probs(.9, .04, .02, .02, .02), probs(.88, .06, .02, .02, .02)]

    def decide(self, topic_probs, p_danger, p_oos=0.0, found=(), **cfg):
        return decide_check('text', topic_probs, LABELS, GUIDE, list(found), p_danger, p_oos, {**CFG, **cfg})

    def test_weak_danger_without_inline_asks_the_question(self):
        self.assertEqual(self.decide(self.sure_burns, p_danger=0.3)['kind'], 'check')

    def test_weak_danger_with_confident_topic_gives_advice_with_banner(self):
        d = self.decide(self.sure_burns, p_danger=0.3, inline=0.8)
        self.assertEqual((d['kind'], d['topic'], d['emergency']), ('answer_check', 'burns', False))

    def test_banner_needs_confidence(self):
        self.assertEqual(self.decide(self.sure_burns, p_danger=0.3, inline=0.95)['kind'], 'check')

    def test_banner_never_when_it_may_not_be_first_aid(self):
        self.assertEqual(self.decide(self.sure_burns, p_danger=0.3, p_oos=0.8, inline=0.5)['kind'], 'check')

    def test_strong_danger_still_says_call_999(self):
        d = self.decide(self.sure_burns, p_danger=0.9, inline=0.5)
        self.assertTrue(d['emergency'])
        self.assertNotIn(d['kind'], ('check', 'answer_check'))

    def test_no_danger_answers_normally(self):
        d = self.decide(self.sure_burns, p_danger=0.01, inline=0.5, answer=0.85)
        self.assertEqual((d['kind'], d['topic'], d['emergency']), ('answer', 'burns', False))


if __name__ == '__main__':
    unittest.main()
