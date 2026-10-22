import io
import unittest
import wave

import numpy as np

from voice.config import N_FRAMES, N_MFCC, SR, WINDOW
from voice.features import (fit_window, is_silent, load_audio, loudest_window, mfcc, rms_normalize, split_windows)


def tone(seconds, freq=220.0, amp=0.3, sr=SR):
    t = np.arange(int(seconds * sr)) / sr
    return (amp * np.sin(2 * np.pi * freq * t)).astype(np.float32)


def wav_bytes(samples, sr, channels=1):
    data = np.clip(samples, -1, 1)
    if channels == 2:
        data = np.stack([data, data], axis=1)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as w:
        w.setnchannels(channels)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((data * 32767).astype('<i2').tobytes())
    return buf.getvalue()


class MfccTests(unittest.TestCase):
    def test_shape_matches_the_model_input(self):
        self.assertEqual(mfcc(tone(3)).shape, (N_MFCC, N_FRAMES))

    def test_is_deterministic_and_finite(self):
        a, b = mfcc(tone(3)), mfcc(tone(3))
        self.assertTrue(np.array_equal(a, b))
        self.assertTrue(np.isfinite(a).all())

    def test_loudness_of_the_recording_does_not_change_the_features(self):
        quiet, loud = mfcc(tone(3, amp=0.02)), mfcc(tone(3, amp=0.6))
        self.assertTrue(np.allclose(quiet, loud, atol=1e-3))

    def test_different_sounds_give_different_features(self):
        self.assertFalse(np.allclose(mfcc(tone(3, 200)), mfcc(tone(3, 1800))))


class WindowingTests(unittest.TestCase):
    def test_short_clip_is_tiled_not_zero_padded(self):
        w = fit_window(tone(1.0))
        self.assertEqual(len(w), WINDOW)
        self.assertGreater(np.abs(w[-1000:]).max(), 0.1)  # no silent tail that would reveal the clip length

    def test_long_clip_is_cropped(self):
        self.assertEqual(len(fit_window(tone(5))), WINDOW)

    def test_loudest_window_picks_the_busy_part(self):
        quiet = tone(4, amp=0.001)
        loud = tone(3, amp=0.5)
        picked = loudest_window(np.concatenate([quiet, loud]))
        self.assertGreater(np.abs(picked).max(), 0.4)

    def test_split_windows_counts(self):
        self.assertEqual(len(split_windows(tone(3))), 1)
        self.assertEqual(len(split_windows(tone(4.5))), 2)
        self.assertEqual(len(split_windows(tone(5))), 3)
        self.assertEqual(len(split_windows(tone(0.5))), 0)  # too short to judge

    def test_silence_gate(self):
        self.assertTrue(is_silent(np.zeros(WINDOW, np.float32)))
        self.assertTrue(is_silent(tone(3, amp=1e-4)))
        self.assertFalse(is_silent(tone(3, amp=0.1)))

    def test_rms_normalize_hits_the_target_level(self):
        y = rms_normalize(tone(3, amp=0.01))
        self.assertAlmostEqual(20 * np.log10(np.sqrt(np.mean(y ** 2))), -23.0, delta=0.5)


class LoadAudioTests(unittest.TestCase):
    def test_reads_bytes_in_memory_and_resamples_to_16k(self):
        y = load_audio(wav_bytes(tone(2, sr=44100), 44100))
        self.assertAlmostEqual(len(y) / SR, 2.0, delta=0.02)

    def test_stereo_becomes_mono(self):
        y = load_audio(wav_bytes(tone(1), SR, channels=2))
        self.assertEqual(y.ndim, 1)

    def test_garbage_is_an_error_not_silence(self):
        with self.assertRaises(Exception):
            load_audio(b'this is not audio')


if __name__ == '__main__':
    unittest.main()
