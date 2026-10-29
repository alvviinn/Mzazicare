import unittest

import numpy as np
import torch

from voice.compare import angry_scores, expected_calibration_error, stats
from voice.config import CLASSES, N_FRAMES, N_MFCC
from voice.model import ToneBiLSTM, ToneCNN


class ComparisonHelpersTests(unittest.TestCase):
    def test_statistics_features_have_six_numbers_per_coefficient(self):
        X = np.random.default_rng(0).standard_normal((3, N_MFCC, N_FRAMES)).astype(np.float32)
        F = stats(X)
        self.assertEqual(F.shape, (3, 6 * N_MFCC))
        np.testing.assert_allclose(F[:, :N_MFCC], X.mean(2), rtol=1e-5)

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
