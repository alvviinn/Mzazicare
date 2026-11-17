"""Shared constants. Training and live inference must use exactly the same values."""

SR = 16000  # sample rate (Hz) every clip is converted to
WINDOW_S = 3.0  # the model judges 3-second windows
WINDOW = int(SR * WINDOW_S)
N_FFT = 512  # 32 ms
HOP = 320  # 20 ms
N_MELS = 64
N_MFCC = 40  # 40-dim MFCC per frame, as in the project spec
FMIN, FMAX = 50, 7600
N_FRAMES = 1 + (WINDOW - N_FFT) // HOP  # 149

# The five tones shown on the family dashboard, plus "noise" for anything that is not a person
# speaking (TV, traffic, dogs, appliances...). "noise" windows are ignored when summarising tone.
TONES = ['happy', 'calm', 'neutral', 'stressed', 'angry']
CLASSES = TONES + ['noise']

# Windows quieter than this (before normalisation) are treated as silence and skipped.
SILENCE_DB = -55.0

# Training round. 1 = the original model (acted emotions only). 2 adds laughter (as happy) and other human
# non-speech sounds such as coughs and sneezes (as noise), after laughter was found to read as "tense" in a live test.
# Round 2+ writes its features and models to separate files/folders, so round 1 stays reproducible.
import os as _os

ROUND = int(_os.environ.get('MZAZI_VOICE_ROUND', '2'))
TARGET_RMS_DB = -23.0  # every window is level-normalised, so a quiet phone and a loud one look alike
