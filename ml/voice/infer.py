"""Live inference: audio in (bytes, held in memory only) -> tone shares out.

Used by the Django backend and by `python -m voice.infer some.wav` for quick checks. The audio is decoded,
turned into MFCC features and discarded. Nothing is written to disk.
"""

import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort

from .config import CLASSES, TONES
from .features import is_silent, load_audio, mfcc, split_windows

ART = Path(__file__).parent / 'artifacts'

# A window counts as "speech" only if the model is fairly sure it is a person talking.
MAX_NOISE_PROB = 0.5
# Distress flag (deliberately cautious: wrong alarms upset families). Needs several windows that are
# clearly angry, not just one.
ANGRY_PROB = 0.6
ANGRY_MIN_WINDOWS = 3


class ToneAnalyzer:
    def __init__(self, directory=ART):
        directory = Path(directory)
        self.meta = json.loads((directory / 'labels.json').read_text(encoding='utf-8'))
        self.mean = np.array(self.meta['mean'], np.float32)[None, :, None]
        self.std = np.array(self.meta['std'], np.float32)[None, :, None]
        self.temperature = float(self.meta['temperature'])
        op = self.meta.get('operating_point', {})  # alert rule chosen in voice.operating_point
        self.angry_prob = op.get('angry_prob', ANGRY_PROB)
        self.angry_min_windows = op.get('angry_min_windows', ANGRY_MIN_WINDOWS)
        self.session = ort.InferenceSession(str(directory / 'tone_cnn.onnx'), providers=['CPUExecutionProvider'])

    def _probabilities(self, feats):
        x = ((np.stack(feats) - self.mean) / self.std)[:, None].astype(np.float32)
        logits = self.session.run(None, {'mfcc': x})[0] / self.temperature
        e = np.exp(logits - logits.max(axis=1, keepdims=True))
        return e / e.sum(axis=1, keepdims=True)

    def analyze(self, audio):
        """audio: wav/flac/ogg bytes or a path. Returns a plain dict."""
        y = load_audio(audio)
        duration = len(y) / 16000.0
        windows = [w for w in split_windows(y) if not is_silent(w)]
        result = {'duration_s': round(duration, 1), 'windows': len(windows), 'speech_windows': 0,
                  'speech_s': 0.0, 'tones': {t: 0.0 for t in TONES}, 'dominant': None, 'distress': False}
        if not windows:
            return result

        probs = self._probabilities([mfcc(w) for w in windows])
        noise_i = CLASSES.index('noise')
        speech = probs[:, noise_i] < MAX_NOISE_PROB
        speech &= probs.argmax(axis=1) != noise_i
        if not speech.any():
            return result

        tone_p = probs[speech][:, :len(TONES)]
        tone_p = tone_p / tone_p.sum(axis=1, keepdims=True)  # shares among the five tones
        share = tone_p.mean(axis=0)
        result['speech_windows'] = int(speech.sum())
        result['speech_s'] = round(float(speech.sum()) * 1.5, 1)  # windows hop by 1.5 s
        result['tones'] = {t: round(float(s), 4) for t, s in zip(TONES, share)}
        result['dominant'] = TONES[int(share.argmax())]
        angry_i = TONES.index('angry')
        result['distress'] = int((tone_p[:, angry_i] >= self.angry_prob).sum()) >= self.angry_min_windows
        return result


if __name__ == '__main__':
    analyzer = ToneAnalyzer()
    for path in sys.argv[1:]:
        print(path, json.dumps(analyzer.analyze(path), indent=2))
