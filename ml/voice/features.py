"""Audio -> MFCC features. Pure numpy/scipy so the same code runs in training and in the backend."""

import functools
import io
from math import gcd

import numpy as np
import soundfile as sf
from scipy.fft import dct
from scipy.signal import resample_poly

from .config import (FMAX, FMIN, HOP, N_FFT, N_MELS, N_MFCC, SILENCE_DB, SR, TARGET_RMS_DB, WINDOW)


def _hz_to_mel(f):
    return 2595.0 * np.log10(1.0 + f / 700.0)


def _mel_to_hz(m):
    return 700.0 * (10.0 ** (m / 2595.0) - 1.0)


@functools.lru_cache(maxsize=1)
def _mel_filterbank():
    n_freq = N_FFT // 2 + 1
    hz = _mel_to_hz(np.linspace(_hz_to_mel(FMIN), _hz_to_mel(FMAX), N_MELS + 2))
    bins = np.floor((N_FFT + 1) * hz / SR).astype(int)
    fb = np.zeros((N_MELS, n_freq), np.float32)
    for m in range(1, N_MELS + 1):
        left, centre, right = bins[m - 1], bins[m], bins[m + 1]
        centre = max(centre, left + 1)
        right = max(right, centre + 1)
        fb[m - 1, left:centre] = (np.arange(left, centre) - left) / (centre - left)
        fb[m - 1, centre:right] = (right - np.arange(centre, right)) / (right - centre)
    return fb


@functools.lru_cache(maxsize=1)
def _hann():
    return np.hanning(N_FFT).astype(np.float32)


def load_audio(src):
    """Read a path or in-memory bytes into 16 kHz mono float32. Nothing is written to disk."""
    handle = io.BytesIO(src) if isinstance(src, (bytes, bytearray)) else src
    data, sr = sf.read(handle, dtype='float32', always_2d=True)
    y = data.mean(axis=1)
    if sr != SR:
        g = gcd(sr, SR)
        y = resample_poly(y, SR // g, sr // g).astype(np.float32)
    return y


def rms_db(y):
    return 20.0 * np.log10(np.sqrt(np.mean(np.square(y)) + 1e-12))


def is_silent(y):
    return rms_db(y) < SILENCE_DB


def rms_normalize(y, target_db=TARGET_RMS_DB):
    gain = 10.0 ** (target_db / 20.0) / np.sqrt(np.mean(np.square(y)) + 1e-12)
    return np.clip(y * gain, -1.0, 1.0).astype(np.float32)


def fit_window(y):
    """Exactly WINDOW samples. Short clips are tiled (not zero-padded, so clip length is not a cue)."""
    if len(y) >= WINDOW:
        return y[:WINDOW]
    reps = int(np.ceil(WINDOW / max(len(y), 1)))
    return np.tile(y, reps)[:WINDOW]


def loudest_window(y):
    """For clips longer than a window: the WINDOW-long stretch with the most energy."""
    if len(y) <= WINDOW:
        return fit_window(y)
    step = SR // 4
    best, best_e = 0, -1.0
    for s in range(0, len(y) - WINDOW + 1, step):
        e = float(np.sum(np.square(y[s:s + WINDOW])))
        if e > best_e:
            best, best_e = s, e
    return y[best:best + WINDOW]


def split_windows(y, hop_s=1.5, min_s=1.0):
    """Cut a longer recording into overlapping 3 s windows (the last one may be shorter, >= min_s)."""
    hop = int(hop_s * SR)
    out = []
    if len(y) < int(min_s * SR):
        return out
    for s in range(0, max(1, len(y) - WINDOW + hop), hop):
        seg = y[s:s + WINDOW]
        if len(seg) < int(min_s * SR):
            break
        out.append(seg)
    return out


def mfcc(y):
    """y: one window of audio -> (N_MFCC, frames) float32. Input is fitted to WINDOW and level-normalised."""
    y = rms_normalize(fit_window(np.asarray(y, np.float32)))
    y = np.append(y[0], y[1:] - 0.97 * y[:-1])  # pre-emphasis
    n = 1 + (len(y) - N_FFT) // HOP
    idx = np.arange(N_FFT)[None, :] + HOP * np.arange(n)[:, None]
    frames = y[idx] * _hann()
    power = np.abs(np.fft.rfft(frames, axis=1)) ** 2 / N_FFT
    log_mel = np.log(power @ _mel_filterbank().T + 1e-8)
    return dct(log_mel, type=2, axis=1, norm='ortho')[:, :N_MFCC].T.astype(np.float32)
