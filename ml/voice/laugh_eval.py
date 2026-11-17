"""Round 2 check, scored once on TEST: is each tone recognised at least as well, and does laughter stop reading as tense?

    python -m voice.laugh_eval val     # while developing: validation speakers only
    python -m voice.laugh_eval test    # once, at the end

Why: in a live test, people telling jokes and laughing came out 34 % tense. Measured on ESC-50 laughter, the round-1
model gave laughter 65 % stressed+angry. Round 2 only retrains the model, adding laughter (as happy) and other human
sounds (as noise) to the training data. How the app works does not change: the same classes, the same live path
(voice.infer) and the same alert rule. This script measures through that same live path.

The gates below were fixed BEFORE the test set was scored.

Tone and accuracy gates (changed 2026-11-17, on the user's choice, before the test set was scored): a fixed
3-point limit was smaller than chance alone (about 170-340 validation windows per tone, so about 3-4 points of
sampling error). A tone or the speech accuracy now fails only if it is CLEARLY worse than round 1: the 95 % interval
of the change, from a paired bootstrap that resamples whole speakers, lies entirely below zero. Macro-F1 must still
not drop, and the laughter and alert gates are unchanged.
"""

import json
import sys
from pathlib import Path

import numpy as np
import onnxruntime as ort
from sklearn.metrics import f1_score, recall_score

from .config import CLASSES, TONES
from .data import DATA, FEATURES, STAGE
from .infer import MAX_NOISE_PROB

LIVE_BACKUP = DATA / 'models' / 'v1_live_backup'  # the round-1 model as it was live (copied before round 2)
OLD = ('ravdess', 'cremad', 'librispeech')  # the round-1 speech datasets: the same unseen speakers as round 1
LAUGH = ('vs_laugh', 'esc50_laugh')
NOISE_I, STRESSED_I, ANGRY_I = CLASSES.index('noise'), TONES.index('stressed'), TONES.index('angry')
LINE = 0.30  # the dashboard's "needs a look" line for stressed + angry

GATES = {
    'clearly_worse_if_upper_95_below': 0.0,  # per tone recall and speech accuracy, paired speaker bootstrap
    'old_macro_f1_drop_max': 0.0,  # balanced score over the 5 tones must not drop
    'laughter_tense_share_max': 0.15,  # stressed+angry share a laughter window adds on the dashboard
    'jokes_recordings_over_line_max': 0.10,  # simulated joking/laughing visits shown above the 30 % line
    'argument_recordings_over_line_min': 0.90,  # simulated arguments still shown above the 30 % line
    'alert_false_alarm_max': 0.005,  # from voice.operating_point (round 1: 0.4 %)
    'alert_heated_min': 0.90,  # (round 1: 94.7 %)
}


def probabilities(model_dir, X):
    meta = json.loads((Path(model_dir) / 'labels.json').read_text(encoding='utf-8'))
    mean = np.array(meta['mean'], np.float32)[None, :, None]
    std = np.array(meta['std'], np.float32)[None, :, None]
    sess = ort.InferenceSession(str(Path(model_dir) / 'tone_cnn.onnx'), providers=['CPUExecutionProvider'])
    out = []
    for i in range(0, len(X), 512):
        x = ((X[i:i + 512].astype(np.float32) - mean) / std)[:, None]
        out.append(sess.run(None, {'mfcc': x})[0] / meta['temperature'])
    logits = np.concatenate(out)
    e = np.exp(logits - logits.max(1, keepdims=True))
    return e / e.sum(1, keepdims=True), meta


def window_view(probs):
    """Exactly what voice.infer does with each window: is it speech, and its shares of the five tones."""
    speech = (probs[:, NOISE_I] < MAX_NOISE_PROB) & (probs.argmax(1) != NOISE_I)
    return speech, probs[:, :len(TONES)] / probs[:, :len(TONES)].sum(1, keepdims=True)


def tension(idx, speech, tone_p):
    s = idx[speech[idx]]
    return float((tone_p[s, STRESSED_I] + tone_p[s, ANGRY_I]).mean()) if len(s) else 0.0


def simulate(y, dataset, speech, tone_p, rng, trials=3000):
    """Share of simulated 10-window visits the dashboard would show above the 30 % line."""
    pool = lambda m: np.where(m)[0]
    old = np.isin(dataset, OLD)
    laugh = pool(np.isin(dataset, LAUGH))
    talk = pool(old & np.isin(y, [CLASSES.index('happy'), CLASSES.index('neutral'), CLASSES.index('calm')]))
    angry, stressed = pool(old & (y == CLASSES.index('angry'))), pool(old & (y == CLASSES.index('stressed')))
    everyday = pool(old & (y != CLASSES.index('angry')))
    kinds = {
        'jokes': lambda: np.r_[rng.choice(laugh, 4), rng.choice(talk, 6)],  # telling jokes and laughing
        'everyday': lambda: rng.choice(everyday, 10),
        'argument': lambda: np.r_[rng.choice(angry, 4), rng.choice(stressed, 2), rng.choice(everyday, 4)],
    }
    return {k: float(np.mean([tension(make(), speech, tone_p) > LINE for _ in range(trials)])) for k, make in kinds.items()}


def metrics(probs, y, dataset):
    speech, tone_p = window_view(probs)
    pred = probs.argmax(1)
    old_speech = np.isin(dataset, OLD) & (y < NOISE_I)
    yt, pt = y[old_speech], pred[old_speech]
    recalls = recall_score(yt, pt, labels=range(len(TONES)), average=None, zero_division=0)
    laugh = np.isin(dataset, LAUGH)
    tense_w = np.where(speech, tone_p[:, STRESSED_I] + tone_p[:, ANGRY_I], 0.0)  # non-speech adds nothing
    other = dataset == 'vs_other'
    out = {'old_speech_accuracy': float((pt == yt).mean()),
           'old_macro_f1': float(f1_score(yt, pt, labels=range(len(TONES)), average='macro', zero_division=0))}
    out.update({f'recall_{t}': float(r) for t, r in zip(TONES, recalls)})
    noise = y == NOISE_I
    out.update({
        'noise_kept_out': float((~speech[noise]).mean()),
        'laughter_windows': int(laugh.sum()),
        'laughter_tense_share': float(tense_w[laugh].mean()),
        'laughter_called_happy': float((pred[laugh] == TONES.index('happy')).mean()),
        'laughter_called_tense': float(np.isin(pred[laugh], [STRESSED_I, ANGRY_I]).mean()),
        'coughs_etc_tense_share': float(tense_w[other].mean()) if other.any() else None,
    })
    out.update({f'{k}_over_line': v for k, v in simulate(y, dataset, speech, tone_p, np.random.default_rng(0)).items()})
    return out


def paired_bootstrap(y, dataset, speaker, pred_live, pred_new, n=2000, seed=0):
    """95 % intervals of (round 2 - round 1) for each tone's recall and for speech accuracy, resampling speakers."""
    m = np.isin(dataset, OLD) & (y < NOISE_I)
    y, spk, a, b = y[m], speaker[m], pred_live[m], pred_new[m]
    speakers = np.unique(spk)
    rows = [np.where(spk == s)[0] for s in speakers]
    rng = np.random.default_rng(seed)
    diffs = {k: [] for k in [f'recall_{t}' for t in TONES] + ['old_speech_accuracy']}
    for _ in range(n):
        idx = np.concatenate([rows[i] for i in rng.integers(0, len(rows), len(rows))])
        yy, aa, bb = y[idx], a[idx], b[idx]
        diffs['old_speech_accuracy'].append((bb == yy).mean() - (aa == yy).mean())
        for i, t in enumerate(TONES):
            k = yy == i
            if k.any():
                diffs[f'recall_{t}'].append((bb[k] == i).mean() - (aa[k] == i).mean())
    return {k: (float(np.percentile(v, 2.5)), float(np.percentile(v, 97.5))) for k, v in diffs.items()}


def main(split):
    d = np.load(FEATURES)
    m = d['split'] == split
    X, y, dataset, speaker = d['X'][m], d['y'][m], d['dataset'][m], d['speaker'][m]
    stage_probs, stage_meta = probabilities(STAGE, X)
    live_probs = probabilities(LIVE_BACKUP, X)[0]
    live = metrics(live_probs, y, dataset)
    ci = paired_bootstrap(y, dataset, speaker, live_probs.argmax(1), stage_probs.argmax(1))
    new = metrics(stage_probs, y, dataset)
    op = stage_meta.get('operating_point', {})
    new['alert_false_alarm'] = op.get('false_alarm_rate_no_anger_per_10_windows')
    new['alert_heated'] = op.get('detect_heated_6_of_10')
    live['alert_false_alarm'], live['alert_heated'] = 0.004, 0.947  # round-1 figures from its own run (README)
    g = GATES
    checks = {k: hi >= g['clearly_worse_if_upper_95_below'] for k, (lo, hi) in ci.items()}
    checks.update({
        'old_macro_f1': new['old_macro_f1'] >= live['old_macro_f1'] - g['old_macro_f1_drop_max'],
        'laughter_tense_share': new['laughter_tense_share'] <= g['laughter_tense_share_max'],
        'jokes_over_line': new['jokes_over_line'] <= g['jokes_recordings_over_line_max'],
        'argument_over_line': new['argument_over_line'] >= g['argument_recordings_over_line_min'],
        'alert_false_alarm': new['alert_false_alarm'] is not None and new['alert_false_alarm'] <= g['alert_false_alarm_max'],
        'alert_heated': new['alert_heated'] is not None and new['alert_heated'] >= g['alert_heated_min'],
    })
    fmt = lambda v: '-' if v is None else (f'{v:.1%}' if isinstance(v, float) else str(v))
    lines = [f'{split.upper()} (speakers never trained on), measured through the unchanged live path',
             f"{'':28}{'live (round 1)':>16}{'round 2':>12}"]
    lines += [f'{k:28}{fmt(live.get(k)):>16}{fmt(new[k]):>12}' for k in new]
    lines.append('change vs round 1, 95 % interval (speaker bootstrap): ' + ', '.join(
        f'{k} {lo:+.1%}..{hi:+.1%}' for k, (lo, hi) in ci.items()))
    lines.append('gates: ' + ', '.join(f"{k} {'PASS' if v else 'FAIL'}" for k, v in checks.items()))
    lines.append('ALL GATES PASS' if all(checks.values()) else 'SOME GATES FAIL')
    report = '\n'.join(lines)
    print(report)
    (STAGE / f'laugh_report_{split}.txt').write_text(report, encoding='utf-8')
    (STAGE / f'laugh_report_{split}.json').write_text(
        json.dumps({'live': live, 'round2': new, 'interval_95': ci, 'gates': GATES, 'checks': checks}, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'val')
