"""Index the downloaded datasets and map their labels onto our tone classes.

Label mapping (acted emotion -> care tone):
    happy      <- happy
    calm       <- calm                      (RAVDESS only)
    neutral    <- neutral, plus natural read speech (LibriSpeech)
    stressed   <- fearful, sad              (a person who sounds distressed or anxious)
    angry      <- angry
    noise      <- ESC-50 non-human sounds   (so TV/traffic/dogs are not mistaken for tone)
Round 2 adds (after laughter read as "tense" in a live test):
    happy      <- laughter (VocalSound, crowdsourced on people's own phones/laptops; ESC-50 "laughing")
    noise      <- coughs, sneezes, sniffs, throat clearing, sighs (VocalSound) and ESC-50 human non-speech
                  sounds (breathing, snoring, clapping...), so they never count as a tone. A sigh is left as
                  "not speech" on purpose: it is too ambiguous to call stressed.
Left out on purpose: disgust and surprise. They are ambiguous (could be good or bad) and a wrong
"angry" flag would worry a family for no reason.

Splits are by SPEAKER (or by ESC-50 fold), never by clip, so a person heard in training is never in
the test set. Otherwise scores look better than they would on a new voice.
"""

import csv
import os
import random
import re
from pathlib import Path

import soundfile as sf

from .config import ROUND

DATA = Path(os.environ.get('MZAZI_DATA', r'C:\mzazicare-data\voice'))
# Round 1 keeps its original file names; later rounds write beside them, never over them.
FEATURES = DATA / ('features.npz' if ROUND < 2 else f'features_v{ROUND}.npz')
STAGE = DATA / 'models' / f'v{ROUND}_stage'  # where round 2+ training writes its model (never the live artifacts/)

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
            cat = r['category']
            if cat in HUMAN_ESC:
                # Round 2: laughter is happy; other human non-speech is noise. A crying baby stays out (not the elder).
                if ROUND < 2 or cat == 'crying_baby':
                    continue
                label = 'happy' if cat == 'laughing' else 'noise'
            else:
                label = 'noise'
            fold = int(r['fold'])
            split = 'test' if fold == 5 else 'val' if fold == 4 else 'train'
            rows.append(dict(path=str(meta.parent.parent / 'audio' / r['filename']), label=label,
                             speaker=f"esc{r['filename']}", dataset='esc50' if label == 'noise' else 'esc50_laugh',
                             split=split))
    return rows


VS_NAME = re.compile(r'^([fm])(\d+)_(\d+)_([a-z]+)$')
VS_OTHER = {'cough', 'sneeze', 'sniff', 'throatclearing', 'sigh'}


def vocalsound(seed=7, train_laugh_cap=None):
    """VocalSound (Gong et al. 2022, CC BY-SA 4.0): 3,365 people recording laughter, sighs, coughs, throat
    clearing, sneezes and sniffs on their own devices. Split by SPEAKER. Every laughter clip is used (as happy);
    of the other five sounds one clip per speaker is used (as noise), so noise does not swamp the other classes."""
    by_speaker = {}
    for p in sorted((DATA / 'vocalsound').rglob('*.wav')):
        m = VS_NAME.match(p.stem)
        if not m:
            continue
        by_speaker.setdefault(m.group(1) + m.group(2), []).append((m.group(4), p))
    split_of = _split_by_order(by_speaker, n_test=round(len(by_speaker) * 0.15), n_val=round(len(by_speaker) * 0.10))
    rng = random.Random(seed)
    rows = []
    for spk, files in sorted(by_speaker.items()):
        split = split_of(spk)
        for kind, p in files:
            if kind == 'laughter':
                rows.append(dict(path=str(p), label='happy', speaker=f'vs{spk}', dataset='vs_laugh', split=split))
        other = [p for kind, p in files if kind in VS_OTHER]
        if other:
            rows.append(dict(path=str(rng.choice(other)), label='noise', speaker=f'vs{spk}', dataset='vs_other', split=split))
    if train_laugh_cap is not None:
        # Keep laughter from swamping "happy": without a cap it would be ~70 % of the happy training clips and
        # the model could learn "happy = laughing" and get worse on happy SPEECH. Validation and test keep all.
        laugh_tr = [i for i, r in enumerate(rows) if r['dataset'] == 'vs_laugh' and r['split'] == 'train']
        drop = set(rng.sample(laugh_tr, max(0, len(laugh_tr) - train_laugh_cap)))
        rows = [r for i, r in enumerate(rows) if i not in drop]
    return rows


def build_index():
    rows = ravdess() + cremad() + librispeech() + esc50()
    return rows + vocalsound(train_laugh_cap=1500) if ROUND >= 2 else rows


if __name__ == '__main__':
    from collections import Counter
    idx = build_index()
    print('total', len(idx))
    for ds in sorted({r['dataset'] for r in idx}):
        c = Counter((r['split'], r['label']) for r in idx if r['dataset'] == ds)
        print(ds, dict(sorted(c.items())))
