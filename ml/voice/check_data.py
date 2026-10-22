"""Check that the datasets and the prepared features are complete and safe to train on.

    python -m voice.check_data

Exits with status 1 if anything is wrong, so it can gate a training run. Checks:
  * every dataset is present with roughly the expected number of files
  * a sample of files from each can actually be decoded
  * the label mapping produces every class in every split
  * no speaker (or ESC-50 clip) appears in more than one split  -> no leakage into the test set
  * the cached features have the right shape and contain no NaN or infinite values
"""

import sys
from collections import Counter, defaultdict

import numpy as np

from .config import CLASSES, N_FRAMES, N_MFCC
from .data import DATA, build_index
from .features import load_audio

# Usable clips after filtering (see data.py): RAVDESS 1056 of 1440 (speech, 6 mapped emotions); CREMA-D 6171 of 7442
# (disgust dropped); LibriSpeech 1381 (max 40 per speaker, >= 3 s); ESC-50 1600 (non-human classes, 2 windows each in training).
EXPECTED_MIN = {'ravdess': 1000, 'cremad': 6000, 'librispeech': 1300, 'esc50': 1500}
problems = []


def check(ok, message):
    print(('  ok  ' if ok else '  XX  ') + message)
    if not ok:
        problems.append(message)


def main():
    print(f'Data folder: {DATA}')
    if not DATA.exists():
        print('  XX  data folder is missing. Run: python -m voice.get_data')
        sys.exit(1)

    print('\n1. Datasets present and decodable')
    rows = build_index()
    by_ds = defaultdict(list)
    for r in rows:
        by_ds[r['dataset']].append(r)
    for name, minimum in EXPECTED_MIN.items():
        check(len(by_ds[name]) >= minimum, f'{name}: {len(by_ds[name])} usable clips (need at least {minimum})')
    rng = np.random.default_rng(0)
    for name, items in by_ds.items():
        sample = [items[i] for i in rng.choice(len(items), min(20, len(items)), replace=False)]
        bad = 0
        for r in sample:
            try:
                if len(load_audio(r['path'])) < 8000:
                    bad += 1
            except Exception:
                bad += 1
        check(bad == 0, f'{name}: {len(sample) - bad}/{len(sample)} sampled files decode and are longer than 0.5 s')

    print('\n2. Labels and splits')
    counts = Counter((r['split'], r['label']) for r in rows)
    for split in ('train', 'val', 'test'):
        missing = [c for c in CLASSES if counts[(split, c)] == 0]
        check(not missing, f'{split}: every class present' + (f' (missing: {missing})' if missing else ''))
    leaked = defaultdict(set)
    for r in rows:
        leaked[r['speaker']].add(r['split'])
    shared = [s for s, v in leaked.items() if len(v) > 1]
    check(not shared, f'no speaker appears in more than one split ({len(leaked)} speakers/clips checked)')
    print('   clips per split:', dict(Counter(r['split'] for r in rows)))

    print('\n3. Cached features')
    path = DATA / 'features.npz'
    if not path.exists():
        check(False, 'features.npz is missing. Run: python -m voice.build_features')
    else:
        d = np.load(path)
        X, split = d['X'], d['split']
        check(X.shape[1:] == (N_MFCC, N_FRAMES), f'feature shape {X.shape[1:]} matches the model input {(N_MFCC, N_FRAMES)}')
        check(bool(np.isfinite(X.astype(np.float32)).all()), 'no NaN or infinite values')
        check(set(split) == {'train', 'val', 'test'}, 'train, val and test all present')
        check(not (d['aug'][split != 'train']).any(), 'augmented copies exist only in the training split')

    print()
    if problems:
        print(f'{len(problems)} problem(s) found.')
        sys.exit(1)
    print('All data checks passed.')


if __name__ == '__main__':
    main()
