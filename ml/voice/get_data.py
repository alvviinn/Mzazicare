"""Download the public datasets used to train the tone model.

    python -m voice.get_data            # everything
    python -m voice.get_data ravdess esc50

Data goes to MZAZI_DATA (default C:\\mzazicare-data\\voice), outside the repo and outside OneDrive.
Anything already on disk is skipped, so it is safe to re-run after an interruption.

Sources (all freely available for research):
  ravdess      RAVDESS speech, 24 actors, acted emotions            https://zenodo.org/records/1188976
  cremad       CREMA-D, 91 actors, acted emotions (HF mirror)        https://huggingface.co/datasets/myleslinder/crema-d
  esc50        ESC-50 environmental sounds (background / non-speech) https://github.com/karoldvl/ESC-50
  librispeech  LibriSpeech dev-clean, natural read speech (neutral)  https://www.openslr.org/12

If a download is very slow, fetch the file with `curl -L -o <dest> <url>` into DATA/zips and re-run.
"""

import os
import sys
import tarfile
import time
import urllib.request
import zipfile
from pathlib import Path

DATA = Path(os.environ.get('MZAZI_DATA', r'C:\mzazicare-data\voice'))
UA = {'User-Agent': 'mzazicare-research/1.0'}

URLS = {
    'ravdess': 'https://zenodo.org/records/1188976/files/Audio_Speech_Actors_01-24.zip',
    'esc50': 'https://codeload.github.com/karoldvl/ESC-50/zip/refs/heads/master',
    'librispeech': 'https://openslr.elda.org/resources/12/dev-clean.tar.gz',  # mirror of openslr.org/12
    'cremad': 'https://huggingface.co/datasets/myleslinder/crema-d/resolve/main/data/crema_d.tar.gz',
}


def fetch(url, dest, retries=4):
    dest = Path(dest)
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    part = dest.with_suffix(dest.suffix + '.part')
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r, open(part, 'wb') as f:
                while chunk := r.read(1 << 20):
                    f.write(chunk)
            part.replace(dest)
            return dest
        except Exception as e:  # network hiccup: wait and retry
            if attempt == retries - 1:
                raise
            time.sleep(2 * (attempt + 1))
            print(f'  retry {attempt + 1} for {url}: {e}', flush=True)


def ravdess():
    out = DATA / 'ravdess'
    if any(out.glob('Actor_*')):
        return print('ravdess: already there')
    print('ravdess: downloading (~208 MB)...', flush=True)
    with zipfile.ZipFile(fetch(URLS['ravdess'], DATA / 'zips' / 'ravdess.zip')) as zf:
        zf.extractall(out)
    print('ravdess: done', sum(1 for _ in out.rglob('*.wav')), 'files', flush=True)


def esc50():
    out = DATA / 'esc50'
    if (out / 'ESC-50-master' / 'meta' / 'esc50.csv').exists():
        return print('esc50: already there')
    print('esc50: downloading (~600 MB)...', flush=True)
    with zipfile.ZipFile(fetch(URLS['esc50'], DATA / 'zips' / 'esc50.zip')) as zf:
        zf.extractall(out)
    print('esc50: done', sum(1 for _ in out.rglob('*.wav')), 'files', flush=True)


def librispeech():
    out = DATA / 'librispeech'
    if any(out.rglob('*.flac')):
        return print('librispeech: already there')
    print('librispeech: downloading dev-clean (~338 MB)...', flush=True)
    with tarfile.open(fetch(URLS['librispeech'], DATA / 'zips' / 'dev-clean.tar.gz')) as tf:
        members = [m for m in tf.getmembers() if m.name.endswith('.flac')]
        tf.extractall(out, members=members, filter='data')
    print('librispeech: done', len(members), 'files', flush=True)


def cremad():
    out = DATA / 'cremad' / 'AudioWAV'
    if len(list(out.glob('*.wav'))) >= 7400:
        return print('cremad: already there')
    print('cremad: downloading (~470 MB)...', flush=True)
    out.mkdir(parents=True, exist_ok=True)
    n = 0
    with tarfile.open(fetch(URLS['cremad'], DATA / 'zips' / 'crema_d.tar.gz')) as tf:
        for m in tf:
            if m.isfile() and m.name.lower().endswith('.wav'):
                with tf.extractfile(m) as src, open(out / Path(m.name).name, 'wb') as dst:
                    dst.write(src.read())
                n += 1
    print('cremad: done', n, 'files', flush=True)


STEPS = {'ravdess': ravdess, 'esc50': esc50, 'librispeech': librispeech, 'cremad': cremad}

if __name__ == '__main__':
    for name in sys.argv[1:] or list(STEPS):
        STEPS[name]()
    print('ALL DOWNLOADS DONE', flush=True)
