"""Train alternative tone models and compare them with the deployed CNN, each in the setting that suits it best.

    python -m voice.compare train --model svm       # RBF support vector machine on MFCC functionals
    python -m voice.compare train --model rf        # random forest on MFCC functionals
    python -m voice.compare train --model bilstm    # bidirectional LSTM + attention on the MFCC sequence
    python -m voice.compare report                  # compare all of them with the deployed CNN

What makes the comparison fair:
  * Same data: one speaker-independent train / validation / test split from features.npz. Everything is tuned on the
    validation speakers only; the test speakers are scored once.
  * Each model gets the input it is designed for. The CNN and BiLSTM read the MFCC frames directly, so they can follow
    how the voice changes over time. The SVM and random forest cannot read sequences, so they get the standard
    speech-emotion feature set for classical models: MFCC, delta and delta-delta tracks summarised by statistical
    functionals (percentiles, trend, skew...) and by beginning / middle / end segments, which carries the change over
    time into fixed numbers (as openSMILE's ComParE / eGeMAPS functionals do).
  * Each model's own settings are searched on the validation set (SVM: PCA size and C; forest: features per split
    and leaf size). The neural networks get the same training budget (30 epochs, early stop after 7 without gain).
  * Same probability calibration for all: one temperature fitted on the validation set.
  * Each model gets its own anger-alert rule (probability threshold and number of windows), chosen on the validation
    set under the same false-alarm limit, instead of inheriting the CNN's rule.

Trained models and their probabilities go to <MZAZI_DATA>/comparison (outside Git, some are large); the table goes to
artifacts/comparison.md and artifacts/comparison.json.
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import onnxruntime as ort
from sklearn.metrics import f1_score, precision_score, recall_score

from .config import CLASSES, N_FRAMES, N_MFCC, TONES
from .data import DATA
from .infer import MAX_NOISE_PROB

ART = Path(__file__).parent / 'artifacts'
OUT = DATA / 'comparison'
NOISE = CLASSES.index('noise')
ANGRY = CLASSES.index('angry')
LIVE_RULE = (0.6, 3)  # the rule used live with the CNN: >= 3 windows of a clip with angry probability >= 0.6
MAX_FALSE_ALARMS = 0.01  # an alert rule may fire wrongly on at most 1 % of recordings without anger
EPOCHS, PATIENCE = 30, 7  # the deployed CNN's training budget, given to the BiLSTM too


def load_split():
    d = np.load(DATA / 'features.npz')
    X, y, split = d['X'].astype(np.float32), d['y'], d['split']
    return {name: (X[split == name], y[split == name]) for name in ('train', 'val', 'test')}, d['dataset'][split == 'test']


# ---------- features for the classical models ----------

def deltas(X, width=2):
    """Regression deltas over +-width frames (the usual speech-processing definition), same length as X."""
    pad = np.pad(X, ((0, 0), (0, 0), (width, width)), mode='edge')
    n = X.shape[2]
    num = sum(k * (pad[:, :, width + k:width + k + n] - pad[:, :, width - k:width - k + n]) for k in range(1, width + 1))
    return num / (2 * sum(k * k for k in range(1, width + 1)))


def functionals(X):
    """Turn each 3 s window of MFCC frames into 1,680 fixed numbers that still describe how the voice moves.

    Tracks: 40 MFCC + 40 delta (speed of change) + 40 delta-delta (acceleration) = 120.
    Per track (10): mean, spread, min, max, 10th / 50th / 90th percentile, linear trend, skew, kurtosis -> 1,200.
    Beginning / middle / end thirds (MFCC and delta, mean and spread): 80 tracks x 2 x 3 -> 480.
    """
    if len(X) > 1000:  # in chunks: the intermediate arrays for all windows at once would need several GB
        return np.concatenate([functionals(X[i:i + 1000]) for i in range(0, len(X), 1000)])
    d1 = deltas(X)
    tracks = np.concatenate([X, d1, deltas(d1)], axis=1)  # (n, 120, frames)
    mean = tracks.mean(2, keepdims=True)
    std = tracks.std(2, keepdims=True) + 1e-6
    z = (tracks - mean) / std
    t = np.linspace(-1, 1, tracks.shape[2])
    parts = [
        mean[..., 0], std[..., 0], tracks.min(2), tracks.max(2),
        *np.percentile(tracks, [10, 50, 90], axis=2),
        (tracks * t).sum(2) / (t * t).sum(),  # least-squares slope over the window
        (z ** 3).mean(2), (z ** 4).mean(2),
    ]
    for third in np.array_split(np.concatenate([X, d1], axis=1), 3, axis=2):
        parts += [third.mean(2), third.std(2)]
    return np.concatenate(parts, axis=1).astype(np.float32)


# ---------- calibration and the alert rule (the same procedure for every model) ----------

def fit_temperature_np(probs, y):
    """One temperature T so that softmax(log p / T) gives honest probabilities on the validation set."""
    from scipy.optimize import minimize_scalar

    logp = np.log(np.clip(probs, 1e-6, 1.0))

    def nll(T):
        z = logp / T
        z = z - z.max(1, keepdims=True)
        return float(-(z[np.arange(len(y)), y] - np.log(np.exp(z).sum(1))).mean())

    return float(minimize_scalar(nll, bounds=(0.05, 20.0), method='bounded').x)


def apply_temperature(probs, T):
    z = np.log(np.clip(probs, 1e-6, 1.0)) / T
    e = np.exp(z - z.max(1, keepdims=True))
    return e / e.sum(1, keepdims=True)


def angry_scores(probs):
    """The angry probability the alert rule sees: shares among the five tones, 0 for non-speech windows."""
    speech = (probs[:, NOISE] < MAX_NOISE_PROB) & (probs.argmax(1) != NOISE)
    tone_p = probs[:, :len(TONES)] / probs[:, :len(TONES)].sum(1, keepdims=True)
    return np.where(speech, tone_p[:, ANGRY], 0.0)


def alert_simulation(p_angry, y, rule, trials=4000):
    """Replay held-out windows as 10-window recordings, like voice.operating_point (same seed for every model)."""
    rng = np.random.default_rng(0)
    pools = {c: np.where(y == CLASSES.index(c))[0] for c in CLASSES}
    names, mix = zip(*{'neutral': .45, 'happy': .20, 'calm': .05, 'stressed': .10, 'noise': .20}.items())
    thr, k = rule

    def rate(n_angry):
        hits = 0
        for _ in range(trials):
            idx = list(rng.choice(pools['angry'], n_angry)) + [rng.choice(pools[c]) for c in rng.choice(names, 10 - n_angry, p=mix)]
            hits += int((p_angry[np.array(idx, dtype=int)] >= thr).sum() >= k)
        return hits / trials

    return {'false_alarm': rate(0), 'mild_3_of_10': rate(3), 'heated_6_of_10': rate(6)}


def choose_rule(p_angry_val, y_val):
    """The alert rule that catches the most anger while false-alarming on at most 1 % of calm recordings (validation)."""
    best, fallback = None, None
    for thr in (0.5, 0.6, 0.7, 0.8, 0.9):
        for k in (2, 3, 4):
            sim = alert_simulation(p_angry_val, y_val, (thr, k), trials=1500)
            caught = sim['mild_3_of_10'] + sim['heated_6_of_10']
            if sim['false_alarm'] <= MAX_FALSE_ALARMS and (best is None or caught > best[0]):
                best = (caught, (thr, k))
            if fallback is None or sim['false_alarm'] < fallback[0]:
                fallback = (sim['false_alarm'], (thr, k))
    return (best or fallback)[1]


# ---------- the classical models ----------

def train_sklearn(kind, data):
    import joblib
    from sklearn.decomposition import PCA
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.svm import SVC

    (Xtr, ytr), (Xva, yva) = data['train'], data['val']
    t0 = time.time()
    Ftr, Fva = functionals(Xtr), functionals(Xva)
    print('features per window', Ftr.shape[1], flush=True)

    def make(params, final=False):
        if kind == 'svm':
            n_pca, C = params
            # probability outputs need an extra internal cross-validation, so only the chosen setting gets them
            clf = SVC(C=C, kernel='rbf', gamma='scale', class_weight='balanced', probability=final, random_state=0)
            return make_pipeline(StandardScaler(), PCA(n_pca, whiten=True, random_state=0), clf)
        max_features, leaf = params
        return RandomForestClassifier(
            n_estimators=500, max_features=max_features, min_samples_leaf=leaf, class_weight='balanced_subsample',
            n_jobs=-1, random_state=0,
        )

    grid = [(n, C) for n in (128, 256) for C in (1.0, 4.0, 16.0)] if kind == 'svm' else \
        [(f, leaf) for f in ('sqrt', 0.05) for leaf in (1, 3)]
    best = None
    for params in grid:  # searched on the validation speakers only
        model = make(params).fit(Ftr, ytr)
        f1 = f1_score(yva, model.predict(Fva), average='macro')
        print(f'{kind} {params}: val macro-F1 {f1:.3f} ({(time.time() - t0) / 60:.0f} min so far)', flush=True)
        if best is None or f1 > best[0]:
            best = (f1, params, model)
    model = make(best[1], final=True).fit(Ftr, ytr) if kind == 'svm' else best[2]
    temperature = fit_temperature_np(model.predict_proba(Fva), yva)
    train_s = time.time() - t0

    path = OUT / kind / 'model.joblib'
    joblib.dump({'model': model, 'temperature': temperature}, path, compress=3)
    return sklearn_predictor(model, temperature), {
        'chosen': str(best[1]), 'temperature': round(temperature, 3), 'train_s': round(train_s),
        'size_bytes': path.stat().st_size, 'parameters': describe(kind, model)}


def sklearn_predictor(model, temperature):
    return lambda X: apply_temperature(model.predict_proba(functionals(X)), temperature)


def describe(kind, model):
    if kind == 'svm':
        return f'{int(model[-1].n_support_.sum())} support vectors'
    return f'{len(model.estimators_)} trees, {sum(t.tree_.node_count for t in model.estimators_):,} nodes'


# ---------- the recurrent model ----------

def train_bilstm(data, epochs):
    import torch

    from .model import ToneBiLSTM
    from .train import fit, fit_temperature, logits_for

    torch.manual_seed(0)
    torch.set_num_threads(4)
    gen = torch.Generator().manual_seed(0)
    (Xtr, ytr), (Xva, yva) = data['train'], data['val']
    mean, std = Xtr.mean(axis=(0, 2)), Xtr.std(axis=(0, 2)) + 1e-5

    def norm(X):
        return torch.from_numpy(((X - mean[None, :, None]) / std[None, :, None])[:, None]).float()

    counts = np.bincount(ytr, minlength=len(CLASSES)).astype(float)
    weights = torch.tensor((counts.sum() / (len(CLASSES) * counts)) ** 0.5, dtype=torch.float32)
    model = ToneBiLSTM()
    n_params = sum(p.numel() for p in model.parameters())
    print('parameters', n_params, flush=True)
    t0 = time.time()
    state = fit(model, norm(Xtr), torch.from_numpy(ytr).long(), norm(Xva), torch.from_numpy(yva).long(),
                weights, epochs, 64, gen, patience=PATIENCE, clip=5.0)
    train_s = time.time() - t0
    model.load_state_dict(state)
    temperature = fit_temperature(logits_for(model, norm(Xva)), torch.from_numpy(yva).long())

    model.eval()
    path = OUT / 'bilstm' / 'model.onnx'
    torch.onnx.export(
        model, torch.zeros(1, 1, N_MFCC, N_FRAMES), str(path), input_names=['mfcc'], output_names=['logits'],
        dynamic_axes={'mfcc': {0: 'batch'}, 'logits': {0: 'batch'}}, opset_version=17, dynamo=False,
    )
    torch.save(state, OUT / 'bilstm' / 'model.pt')
    (OUT / 'bilstm' / 'norm.json').write_text(json.dumps(
        {'mean': mean.tolist(), 'std': std.tolist(), 'temperature': temperature}), encoding='utf-8')
    return onnx_predictor(path, mean, std, temperature), {
        'train_s': round(train_s), 'size_bytes': path.stat().st_size, 'parameters': f'{n_params:,} weights',
        'temperature': round(temperature, 3)}


def onnx_predictor(path, mean, std, temperature):
    sess = ort.InferenceSession(str(path), providers=['CPUExecutionProvider'])
    mean = np.asarray(mean, np.float32)[None, :, None]
    std = np.asarray(std, np.float32)[None, :, None]

    def predict(X):
        out = []
        for i in range(0, len(X), 256):
            logits = sess.run(None, {'mfcc': ((X[i:i + 256] - mean) / std)[:, None].astype(np.float32)})[0] / temperature
            e = np.exp(logits - logits.max(1, keepdims=True))
            out.append(e / e.sum(1, keepdims=True))
        return np.concatenate(out)

    return predict


def deployed_cnn():
    meta = json.loads((ART / 'labels.json').read_text(encoding='utf-8'))
    path = ART / 'tone_cnn.onnx'
    return onnx_predictor(path, meta['mean'], meta['std'], meta['temperature']), {
        'train_s': 3884, 'size_bytes': path.stat().st_size, 'parameters': '125,750 weights'}  # 30 epochs, from train.log


def load_predictor(name):
    """A saved model, ready to judge single windows the way the server would (one thread, no parallel workers)."""
    if name == 'cnn':
        return deployed_cnn()[0]
    if name == 'bilstm':
        meta = json.loads((OUT / name / 'norm.json').read_text(encoding='utf-8'))
        return onnx_predictor(OUT / name / 'model.onnx', meta['mean'], meta['std'], meta['temperature'])
    import joblib

    saved = joblib.load(OUT / name / 'model.joblib')
    if hasattr(saved['model'], 'n_jobs'):
        saved['model'].n_jobs = 1  # starting a worker pool for one window would only add delay
    return sklearn_predictor(saved['model'], saved['temperature'])


# ---------- scoring ----------

def latency_ms(predict, X, reps=200):
    """Median time to judge ONE 3-second window, as the server does for each clip window (CPU, features included)."""
    for _ in range(10):
        predict(X[:1])
    times = []
    for i in range(reps):
        t0 = time.perf_counter()
        predict(X[i % len(X):i % len(X) + 1])
        times.append(time.perf_counter() - t0)
    return 1000 * float(np.median(times))


def expected_calibration_error(probs, y, bins=15):
    conf, pred = probs.max(1), probs.argmax(1)
    edges = np.linspace(0, 1, bins + 1)
    ece = 0.0
    for lo, hi in zip(edges[:-1], edges[1:]):
        m = (conf > lo) & (conf <= hi)
        if m.any():
            ece += m.mean() * abs(float((pred[m] == y[m]).mean()) - float(conf[m].mean()))
    return ece


def score(probs, y, datasets, rule):
    pred = probs.argmax(1)
    speech = y != NOISE
    p_angry = angry_scores(probs)
    flagged = p_angry >= rule[0]
    return {
        'accuracy': float((pred == y).mean()),
        'macro_f1': float(f1_score(y, pred, average='macro')),
        'speech_accuracy': float((pred[speech] == y[speech]).mean()),
        'speech_macro_f1': float(f1_score(y[speech], pred[speech], labels=list(range(len(TONES))), average='macro')),
        'per_class_f1': dict(zip(CLASSES, (round(float(v), 3) for v in f1_score(y, pred, average=None, labels=list(range(len(CLASSES))))))),
        'ece': float(expected_calibration_error(probs, y)),
        'per_dataset_accuracy': {str(n): round(float((pred[datasets == n] == y[datasets == n]).mean()), 3) for n in sorted(set(datasets))},
        'alert_rule': {'angry_prob': rule[0], 'min_windows': rule[1]},
        'angry_precision': float(precision_score(y == ANGRY, flagged, zero_division=0)),
        'angry_recall': float(recall_score(y == ANGRY, flagged, zero_division=0)),
        'alert': alert_simulation(p_angry, y, rule),
        'alert_with_live_rule': alert_simulation(p_angry, y, LIVE_RULE),
    }


# ---------- commands ----------

def cmd_train(model, epochs):
    data, _ = load_split()
    (OUT / model).mkdir(parents=True, exist_ok=True)
    print(f'train {len(data["train"][1])} | val {len(data["val"][1])} | test {len(data["test"][1])}', flush=True)
    if model == 'bilstm':
        predict, info = train_bilstm(data, epochs)
    else:
        predict, info = train_sklearn(model, data)
    for split in ('val', 'test'):
        np.save(OUT / model / f'{split}_probs.npy', predict(data[split][0]).astype(np.float32))
    (OUT / model / 'info.json').write_text(json.dumps(info, indent=2), encoding='utf-8')
    probs = np.load(OUT / model / 'test_probs.npy')
    print(model, 'test accuracy', round(float((probs.argmax(1) == data['test'][1]).mean()), 3), info, flush=True)


NAMES = {
    'cnn': 'CNN on the MFCC image (deployed)',
    'bilstm': 'BiLSTM + attention on the MFCC sequence',
    'svm': 'SVM (RBF) on MFCC functionals',
    'rf': 'Random forest on MFCC functionals',
}


def cmd_report():
    data, datasets = load_split()
    (Xva, yva), (Xte, yte) = data['val'], data['test']
    results = {}
    for name in ('cnn', 'bilstm', 'svm', 'rf'):
        if name == 'cnn':
            predict, info = deployed_cnn()
            val_probs, test_probs = predict(Xva), predict(Xte)
        else:
            folder = OUT / name
            if not (folder / 'val_probs.npy').exists():
                print(f'(skipping {name}: run "python -m voice.compare train --model {name}" first)')
                continue
            info = json.loads((folder / 'info.json').read_text(encoding='utf-8'))
            val_probs, test_probs = np.load(folder / 'val_probs.npy'), np.load(folder / 'test_probs.npy')
        rule = choose_rule(angry_scores(val_probs), yva)  # each model's own alert rule, from validation only
        info['latency_ms'] = round(latency_ms(load_predictor(name), Xte), 2)
        results[name] = {**info, **score(test_probs, yte, datasets, rule)}
        print(f'{name}: scored (alert rule p>={rule[0]}, {rule[1]} windows)', flush=True)

    (ART / 'comparison.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    md = render(results, len(yte))
    (ART / 'comparison.md').write_text(md, encoding='utf-8')
    print(md)


def pct(v):
    return f'{100 * v:.1f} %'


def render(r, n):
    order = sorted(r, key=lambda k: -r[k]['speech_macro_f1'])
    rows = [
        ('Input', lambda m, k: 'MFCC frames (40 x 149)' if k in ('cnn', 'bilstm') else '1,680 MFCC functionals'),
        ('Overall accuracy (6 classes)', lambda m, k: pct(m['accuracy'])),
        ('Macro-F1 (6 classes)', lambda m, k: f"{m['macro_f1']:.3f}"),
        ('**Speech-only accuracy (5 tones)**', lambda m, k: pct(m['speech_accuracy'])),
        ('**Speech-only macro-F1**', lambda m, k: f"{m['speech_macro_f1']:.3f}"),
        *[(f'F1 {c}', (lambda c: lambda m, k: f"{m['per_class_f1'][c]:.3f}")(c)) for c in CLASSES],
        ('Own alert rule (chosen on validation)', lambda m, k: f"p >= {m['alert_rule']['angry_prob']}, {m['alert_rule']['min_windows']} windows"),
        ('Angry precision at that probability', lambda m, k: pct(m['angry_precision'])),
        ('Angry recall at that probability', lambda m, k: pct(m['angry_recall'])),
        ('Alert: false alarms (no anger)', lambda m, k: pct(m['alert']['false_alarm'])),
        ('Alert: catches mild (3 of 10)', lambda m, k: pct(m['alert']['mild_3_of_10'])),
        ('Alert: catches heated (6 of 10)', lambda m, k: pct(m['alert']['heated_6_of_10'])),
        ('Calibration error (ECE, lower is better)', lambda m, k: f"{m['ece']:.3f}"),
        ('Accuracy on CREMA-D speakers', lambda m, k: pct(m['per_dataset_accuracy'].get('cremad', float('nan')))),
        ('Accuracy on RAVDESS speakers', lambda m, k: pct(m['per_dataset_accuracy'].get('ravdess', float('nan')))),
        ('Time per 3 s window (CPU, incl. features)', lambda m, k: f"{m['latency_ms']:.1f} ms"),
        ('Model file size', lambda m, k: f"{m['size_bytes'] / 1e6:.2f} MB"),
        ('Size of the model', lambda m, k: m['parameters']),
        ('Settings chosen on validation', lambda m, k: m.get('chosen', '–')),
        ('Training time', lambda m, k: f"{m['train_s'] / 60:.0f} min"),
    ]
    out = [
        '# Tone model comparison',
        '',
        f'Same speaker-independent split; test set of {n} windows from speakers none of the models heard. Each model gets the '
        'input that suits it, its own settings search on the validation speakers, the same calibration, and its own anger-alert '
        f'rule chosen on validation (at most {MAX_FALSE_ALARMS:.0%} false alarms). Ordered by speech-only macro-F1. '
        'Generated by `python -m voice.compare report`.',
        '',
        '| Metric | ' + ' | '.join(NAMES[k] for k in order) + ' |',
        '|---|' + '---|' * len(order),
    ]
    for label, f in rows:
        out.append(f'| {label} | ' + ' | '.join(f(r[k], k) for k in order) + ' |')
    return '\n'.join(out) + '\n'


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    t = sub.add_parser('train')
    t.add_argument('--model', choices=['svm', 'rf', 'bilstm'], required=True)
    t.add_argument('--epochs', type=int, default=EPOCHS)
    sub.add_parser('report')
    args = ap.parse_args()
    if args.cmd == 'train':
        cmd_train(args.model, args.epochs)
    else:
        cmd_report()


if __name__ == '__main__':
    main()
