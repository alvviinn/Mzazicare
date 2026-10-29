import unittest

import numpy as np
import torch

from voice.compare import angry_scores, apply_temperature, deltas, expected_calibration_error, fit_temperature_np, functionals
from voice.config import CLASSES, N_FRAMES, N_MFCC
from voice.model import ToneBiLSTM, ToneCNN


class ComparisonHelpersTests(unittest.TestCase):
    def test_functionals_have_1680_numbers_and_start_with_the_mfcc_means(self):
        X = np.random.default_rng(0).standard_normal((3, N_MFCC, N_FRAMES)).astype(np.float32)
        F = functionals(X)
        self.assertEqual(F.shape, (3, 1680))
        np.testing.assert_allclose(F[:, :N_MFCC], X.mean(2), rtol=1e-4, atol=1e-5)

    def test_functionals_see_change_over_time(self):
        rising = np.tile(np.linspace(-1, 1, N_FRAMES, dtype=np.float32), (1, N_MFCC, 1))
        falling = rising[:, :, ::-1].copy()  # same values, opposite order: plain statistics cannot tell them apart
        self.assertFalse(np.allclose(functionals(rising), functionals(falling)))

    def test_deltas_of_a_straight_line_are_its_slope(self):
        X = np.tile(np.arange(20, dtype=np.float32), (1, 2, 1)) * 0.5
        np.testing.assert_allclose(deltas(X)[0, 0, 3:-3], 0.5, rtol=1e-5)

    def test_chunked_and_whole_feature_extraction_agree(self):
        X = np.random.default_rng(1).standard_normal((1003, N_MFCC, N_FRAMES)).astype(np.float32)
        np.testing.assert_allclose(functionals(X)[-3:], functionals(X[-3:]), rtol=1e-4, atol=1e-5)

    def test_temperature_softens_overconfident_probabilities(self):
        y = np.array([0, 1] * 50)
        probs = np.where(np.random.default_rng(2).random(100) < 0.7, y, 1 - y)  # right 70 % of the time
        probs = np.eye(len(CLASSES))[probs] * 0.98 + 0.02 / len(CLASSES)  # but always 98 % sure
        T = fit_temperature_np(probs, y)
        self.assertGreater(T, 1.0)
        self.assertLess(apply_temperature(probs, T).max(1).mean(), probs.max(1).mean())

    def test_perfectly_calibrated_predictions_have_no_calibration_error(self):
        probs = np.eye(len(CLASSES))[[0, 1, 2, 3]]
        self.assertAlmostEqual(expected_calibration_error(probs, np.array([0, 1, 2, 3])), 0.0)
        self.assertAlmostEqual(expected_calibration_error(probs, np.array([1, 2, 3, 4])), 1.0)

    def test_noise_windows_never_count_as_angry(self):
        angry, noise = CLASSES.index('angry'), CLASSES.index('noise')
        probs = np.full((2, len(CLASSES)), 0.02)
        probs[0, angry] = 0.9  # clearly an angry voice
        probs[1, noise] = 0.9  # a TV or traffic
        p = angry_scores(probs / probs.sum(1, keepdims=True))
        self.assertGreater(p[0], 0.9)
        self.assertEqual(p[1], 0.0)

    def test_the_bilstm_takes_the_same_input_as_the_deployed_cnn(self):
        x = torch.zeros(2, 1, N_MFCC, N_FRAMES)
        for model in (ToneCNN(), ToneBiLSTM()):
            self.assertEqual(tuple(model.eval()(x).shape), (2, len(CLASSES)))


if __name__ == '__main__':
    unittest.main()
