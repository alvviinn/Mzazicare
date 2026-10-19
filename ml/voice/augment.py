"""Training-time augmentation, so the model copes with real homes and real phones, not just studio audio."""

import numpy as np
from scipy.signal import butter, sosfilt

from .config import SR, WINDOW


def mix_noise(speech, noise, snr_db):
    """Add background noise to speech at a given signal-to-noise ratio (dB)."""
    if len(noise) < len(speech):
        noise = np.tile(noise, int(np.ceil(len(speech) / len(noise))))
    noise = noise[:len(speech)]
    ps = np.mean(np.square(speech)) + 1e-12
    pn = np.mean(np.square(noise)) + 1e-12
    gain = np.sqrt(ps / (pn * 10.0 ** (snr_db / 10.0)))
    return (speech + gain * noise).astype(np.float32)


def phone_band(y, low=300.0, high=3400.0):
    """Band-limit like a phone microphone / small speaker. Weakens 'studio recording' shortcuts."""
    sos = butter(4, [low, high], btype='bandpass', fs=SR, output='sos')
    return sosfilt(sos, y).astype(np.float32)


def augment(y, noise_bank, rng):
    """One random augmentation of a speech window. noise_bank: list of arrays (training-fold ESC-50 noise)."""
    y = y.astype(np.float32)
    if rng.random() < 0.35:
        y = phone_band(y, low=rng.uniform(200, 400), high=rng.uniform(3000, 4500))
    if noise_bank and rng.random() < 0.8:
        n = noise_bank[rng.integers(len(noise_bank))]
        start = rng.integers(0, max(1, len(n) - WINDOW + 1))
        y = mix_noise(y, n[start:start + WINDOW], rng.uniform(5, 20))
    return y
