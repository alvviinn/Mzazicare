"""Run every held-out-speaker clip through the LIVE inference path (bytes in, as the backend does) and score it.

    python -m voice.check_live_path

This should roughly match the offline test accuracy from training. A big gap would mean the live pipeline
processes audio differently from training.
"""

from collections import Counter

import numpy as np

from .data import cremad, ravdess
from .infer import ToneAnalyzer

a = ToneAnalyzer()
rows = [r for r in ravdess() + cremad() if r['split'] == 'test']
by_ds = {}
conf = Counter()
for r in rows:
    res = a.analyze(open(r['path'], 'rb').read())
    if not res['dominant']:
        pred = 'none'
    else:
        pred = res['dominant']
    by_ds.setdefault(r['dataset'], []).append(pred == r['label'])
    conf[(r['label'], pred)] += 1

for ds, hits in by_ds.items():
    print(f'{ds}: live-path accuracy {np.mean(hits):.3f} (n={len(hits)})')
labels = ['happy', 'calm', 'neutral', 'stressed', 'angry', 'none']
print('rows = truth, cols = live prediction', labels)
for t in labels[:-1]:
    print(f'{t:9s}', [conf[(t, p)] for p in labels])
