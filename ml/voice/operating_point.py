"""How often would the family-facing "angry voices" alert fire wrongly, and how often would it catch a real one?

    python -m voice.operating_point

Per-window accuracy hides what matters in the product: the family sees ONE alert per recording, so what counts
is the false-alarm rate of the alert rule on whole recordings. This replays the held-out test windows
(speakers the model never heard) as simulated 10-window recordings.
"""

import json

import numpy as np
import onnxruntime as ort

from .config import CLASSES, TONES
from .data import DATA
from .infer import ART, MAX_NOISE_PROB

rng = np.random.default_rng(0)
meta = json.loads((ART / 'labels.json').read_text(encoding='utf-8'))
d = np.load(DATA / 'features.npz')
te = d['split'] == 'test'
X = d['X'][te].astype(np.float32)
y = d['y'][te]
mean = np.array(meta['mean'], np.float32)[None, :, None]
std = np.array(meta['std'], np.float32)[None, :, None]
sess = ort.InferenceSession(str(ART / 'tone_cnn.onnx'), providers=['CPUExecutionProvider'])
logits = sess.run(None, {'mfcc': ((X - mean) / std)[:, None]})[0] / meta['temperature']
e = np.exp(logits - logits.max(1, keepdims=True))
probs = e / e.sum(1, keepdims=True)

noise_i, angry_i = CLASSES.index('noise'), TONES.index('angry')
is_speech = (probs[:, noise_i] < MAX_NOISE_PROB) & (probs.argmax(1) != noise_i)
tone_p = probs[:, :len(TONES)] / probs[:, :len(TONES)].sum(1, keepdims=True)
p_angry = np.where(is_speech, tone_p[:, angry_i], 0.0)  # non-speech windows can never count as angry

pools = {c: np.where(y == CLASSES.index(c))[0] for c in CLASSES}
calm_mix = {'neutral': .45, 'happy': .20, 'calm': .05, 'stressed': .10, 'noise': .20}


def recording(n_angry, n=10):
    """n windows: n_angry truly angry ones, the rest an everyday mix of non-angry speech and noise."""
    idx = list(rng.choice(pools['angry'], n_angry))
    names, p = zip(*calm_mix.items())
    for c in rng.choice(names, n - n_angry, p=p):
        idx.append(rng.choice(pools[c]))
    return np.array(idx)


def alarm_rate(n_angry, thr, k, trials=4000):
    hits = 0
    for _ in range(trials):
        idx = recording(n_angry)
        hits += int((p_angry[idx] >= thr).sum() >= k)
    return hits / trials


print('Window level: precision of "angry" when the model is at least this sure (held-out speakers)')
for thr in (0.5, 0.6, 0.7, 0.8, 0.9):
    sel = p_angry >= thr
    prec = float((y[sel] == angry_i).mean()) if sel.any() else float('nan')
    rec = float(((y == angry_i) & sel).sum() / (y == angry_i).sum())
    print(f'  p >= {thr:.1f}: precision {prec:.3f} | recall {rec:.3f} | windows {int(sel.sum())}')

print('\nAlert on a 10-window recording (about 25 s of speech): wrongly fires / catches')
print('  rule (p, windows)   no anger   brief (2 angry)   mild (3 angry)   heated (6 angry)')
best = None
for thr in (0.6, 0.7, 0.8):
    for k in (2, 3, 4):
        fa, brief, mild, hot = (alarm_rate(n, thr, k) for n in (0, 2, 3, 6))
        print(f'  p>={thr:.1f}, k>={k}        {fa:7.1%}   {brief:13.1%}   {mild:14.1%}   {hot:15.1%}')
        if fa <= 0.05 and (best is None or hot + mild > best[3] + best[2]):
            best = (thr, k, mild, hot, fa)
# The rule actually used live. Chosen for precision, as the project spec asks: a wrong alarm worries a
# family, while a missed mild argument still shows up in the tone percentages. Also, the app analyses clips
# all through a shift, so a small per-clip false-alarm rate would add up; the cautious rule keeps it tiny.
ADOPTED = (0.6, 3)
fa, brief, mild, hot = (alarm_rate(n, *ADOPTED, trials=8000) for n in (0, 2, 3, 6))
print(f'\nadopted rule p>={ADOPTED[0]}, k>={ADOPTED[1]}: false alarms {fa:.2%} | mild {mild:.1%} | heated {hot:.1%}')
meta['operating_point'] = {
    'angry_prob': ADOPTED[0], 'angry_min_windows': ADOPTED[1],
    'false_alarm_rate_no_anger_per_10_windows': round(fa, 4),
    'detect_brief_2_of_10': round(brief, 3), 'detect_mild_3_of_10': round(mild, 3), 'detect_heated_6_of_10': round(hot, 3),
    'note': 'Simulated from held-out test windows of acted speech. Real homes are untested.',
}
(ART / 'labels.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')
