"""Index the downloaded datasets and map their labels onto our tone classes.

Label mapping (acted emotion -> care tone):
    happy      <- happy
    calm       <- calm                      (RAVDESS only)
    neutral    <- neutral, plus natural read speech (LibriSpeech)
    stressed   <- fearful, sad              (a person who sounds distressed or anxious)
    angry      <- angry
    noise      <- ESC-50 non-human sounds   (so TV/traffic/dogs are not mistaken for tone)
Left out on purpose: disgust and surprise. They are ambiguous (could be good or bad) and a wrong
"angry" flag would worry a family for no reason.

Splits are by SPEAKER (or by ESC-50 fold), never by clip, so a person heard in training is never in
the test set. Otherwise scores look better than they would on a new voice.
"""

import csv
import os
import random
from pathlib import Path

import soundfile as sf

DATA = Path(os.environ.get('MZAZI_DATA', r'C:\mzazicare-data\voice'))

RAVDESS_MAP = {'01': 'neutral', '02': 'calm', '03': 'happy', '04': 'stressed', '05': 'angry', '06': 'stressed'}
CREMAD_MAP = {'NEU': 'neutral', 'HAP': 'happy', 'SAD': 'stressed', 'FEA': 'stressed', 'ANG': 'angry'}

# ESC-50 classes that are people or close to them; everything else counts as "noise".
HUMAN_ESC = {
    'crying_baby', 'sneezing', 'clapping', 'breathing', 'coughing', 'footsteps',
    'laughing', 'brushing_teeth', 'snoring', 'drinking_sipping',
}


def _split_by_order(items, n_test, n_val):
    items = sorted(items)
    test = set(items[-n_test:])
    val = set(items[-(n_test + n_val):-n_test])
    return lambda x: 'test' if x in test else 'val' if x in val else 'train'


def ravdess():
    rows = []
    for p in sorted((DATA / 'ravdess').rglob('*.wav')):
        f = p.stem.split('-')  # modality-channel-emotion-intensity-statement-repetition-actor
        if len(f) != 7 or f[0] != '03' or f[1] != '01' or f[2] not in RAVDESS_MAP:
            continue
        actor = int(f[6])
        split = 'test' if actor >= 21 else 'val' if actor >= 17 else 'train'
        rows.append(dict(path=str(p), label=RAVDESS_MAP[f[2]], speaker=f'rav{actor}', dataset='ravdess', split=split))
    return rows


def cremad():
    files = sorted((DATA / 'cremad' / 'AudioWAV').glob('*.wav'))
    actors = {p.stem.split('_')[0] for p in files}
    split_of = _split_by_order(actors, n_test=14, n_val=10)
    rows = []
    for p in files:
        actor, _, emo, _ = p.stem.split('_')
        if emo not in CREMAD_MAP:
            continue
        rows.append(dict(path=str(p), label=CREMAD_MAP[emo], speaker=f'cre{actor}', dataset='cremad', split=split_of(actor)))
    return rows


def librispeech(per_speaker=40, seed=1):
    by_speaker = {}
    for p in sorted((DATA / 'librispeech').rglob('*.flac')):
        by_speaker.setdefault(p.stem.split('-')[0], []).append(p)
    split_of = _split_by_order(by_speaker, n_test=8, n_val=6)
    rng = random.Random(seed)
    rows = []
    for spk, files in by_speaker.items():
        rng.shuffle(files)
        for p in files[:per_speaker]:
            try:
                dur = sf.info(str(p)).duration
            except Exception:
                continue
            if dur < 3.0:
                continue
            offset = rng.uniform(0, dur - 3.0)  # a random 3 s stretch of natural speech
            rows.append(dict(path=str(p), label='neutral', speaker=f'lib{spk}', dataset='librispeech',
                             split=split_of(spk), offset=offset))
    return rows


def esc50():
    meta = DATA / 'esc50' / 'ESC-50-master' / 'meta' / 'esc50.csv'
    rows = []
    with open(meta, newline='', encoding='utf-8') as f:
        for r in csv.DictReader(f):
            if r['category'] in HUMAN_ESC:
                continue
            fold = int(r['fold'])
            split = 'test' if fold == 5 else 'val' if fold == 4 else 'train'
            rows.append(dict(path=str(meta.parent.parent / 'audio' / r['filename']), label='noise',
                             speaker=f"esc{r['filename']}", dataset='esc50', split=split))
    return rows


def build_index():
    return ravdess() + cremad() + librispeech() + esc50()


if __name__ == '__main__':
    from collections import Counter
    idx = build_index()
    print('total', len(idx))
    for ds in ('ravdess', 'cremad', 'librispeech', 'esc50'):
        c = Counter((r['split'], r['label']) for r in idx if r['dataset'] == ds)
        print(ds, dict(sorted(c.items())))
