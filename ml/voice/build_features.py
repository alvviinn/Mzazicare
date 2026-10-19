"""Turn the indexed audio into MFCC feature arrays, cached in one .npz file.

    python -m voice.build_features

Training clips also get one noisy / phone-band copy (augmentation). Validation and test sets stay clean.
"""

import os
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

from .augment import augment
from .config import CLASSES, SR, WINDOW
from .data import DATA, build_index
from .features import fit_window, load_audio, loudest_window, mfcc

OUT = DATA / 'features.npz'
_NOISE = None


def process(args):
    i, row, all_noise_paths = args
    rng = np.random.default_rng(1000 + i)
    try:
        y = load_audio(row['path'])
    except Exception as e:
        print('skip', row['path'], e, flush=True)
        return []
    out = []
    if row['dataset'] == 'esc50':
        # two windows per 5 s clip: the start and the end
        for seg in (y[:WINDOW], y[-WINDOW:]):
            out.append((mfcc(fit_window(seg)), row, False))
        return out
    if 'offset' in row:
        s = int(row['offset'] * SR)
        win = y[s:s + WINDOW]
    else:
        win = loudest_window(y)
    win = fit_window(win)
    out.append((mfcc(win), row, False))
    if row['split'] == 'train':
        bank = _noise_bank_from_paths(all_noise_paths)
        out.append((mfcc(augment(win, bank, rng)), row, True))
    return out


def _noise_bank_from_paths(paths):
    """Training-fold noise clips used to dirty up speech (kept apart from the test fold)."""
    global _NOISE
    if _NOISE is None:
        _NOISE = [load_audio(p) for p in paths]
    return _NOISE


def main():
    rows = build_index()
    noise_paths = [r['path'] for r in rows if r['dataset'] == 'esc50' and r['split'] == 'train'][:300]
    print(f'{len(rows)} source clips, {len(noise_paths)} noise clips for augmentation', flush=True)

    X, y, split, dataset, speaker, aug = [], [], [], [], [], []
    jobs = [(i, r, noise_paths) for i, r in enumerate(rows)]
    with ProcessPoolExecutor(max_workers=max(1, (os.cpu_count() or 2) - 1)) as pool:
        for n, result in enumerate(pool.map(process, jobs, chunksize=32)):
            for feat, row, is_aug in result:
                X.append(feat.astype(np.float16))
                y.append(CLASSES.index(row['label']))
                split.append(row['split'])
                dataset.append(row['dataset'])
                speaker.append(row['speaker'])
                aug.append(is_aug)
            if n % 1000 == 0:
                print(f'  {n}/{len(rows)}', flush=True)

    np.savez_compressed(
        OUT, X=np.stack(X), y=np.array(y), split=np.array(split), dataset=np.array(dataset),
        speaker=np.array(speaker), aug=np.array(aug),
    )
    print('saved', OUT, np.stack(X).shape, flush=True)


if __name__ == '__main__':
    main()
