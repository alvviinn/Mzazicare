"""Train alternative tone models and compare them with the deployed CNN on exactly the same data.

    python -m voice.compare train --model svm       # RBF support vector machine on MFCC statistics
    python -m voice.compare train --model rf        # random forest on MFCC statistics
    python -m voice.compare train --model bilstm    # bidirectional LSTM + attention on the MFCC sequence
    python -m voice.compare report                  # compare all of them with the deployed CNN

Every model sees the same speaker-independent train / validation / test split from features.npz, is tuned on the
validation set only, and is scored once on the untouched test set (speakers it never heard). The trained models and
their test probabilities go to <MZAZI_DATA>/comparison (outside Git, some are large); the comparison table goes to
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
ALERT_RULE = (0.6, 3)  # the rule used live: >= 3 windows of a clip with angry probability >= 0.6


def load_split():
    d = np.load(DATA / 'features.npz')
    X, y, split = d['X'].astype(np.float32), d['y'], d['split']
    return {name: (X[split == name], y[split == name]) for name in ('train', 'val', 'test')}, d['dataset'][split == 'test']


# ---------- hand-made features for the classical models ----------

def stats(X):
    """Summarise each 3 s window as 240 numbers: per MFCC coefficient the mean, spread, range and how fast it changes."""
    delta = np.diff(X, axis=2)
    return np.concatenate(
        [X.mean(2), X.std(2), X.min(2), X.max(2), np.abs(delta).mean(2), delta.std(2)], axis=1
    ).astype(np.float32)


def train_sklearn(kind, data):
    import joblib
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.pipeline import make_pipeline
    from sklearn.preprocessing import StandardScaler
    from sklearn.svm import SVC

    (Xtr, ytr), (Xva, yva) = data['train'], data['val']
    Ftr, Fva = stats(Xtr), stats(Xva)

    def make(param):
        if kind == 'svm':
            clf = SVC(C=param, kernel='rbf', gamma='scale', class_weight='balanced', probability=True, random_state=0)
        else:
            clf = RandomForestClassifier(
                n_estimators=400, max_features=param, min_samples_leaf=2, class_weight='balanced_subsample',
                n_jobs=-1, random_state=0,
            )
        return make_pipeline(StandardScaler(), clf)

    grid = [1.0, 4.0, 16.0] if kind == 'svm' else ['sqrt', 0.2]
    best = None
    t0 = time.time()
    for param in grid:  # tuned on the validation speakers only
        model = make(param).fit(Ftr, ytr)
        f1 = f1_score(yva, model.predict(Fva), average='macro')
        print(f'{kind} {param}: val macro-F1 {f1:.3f}', flush=True)
        if best is None or f1 > best[0]:
            best = (f1, param, model)
    train_s = time.time() - t0
    model = best[2]
    path = OUT / kind / 'model.joblib'
    joblib.dump(model, path, compress=3)

    def predict(X):
        return model.predict_proba(stats(X))

    return predict, {'chosen': str(best[1]), 'train_s': round(train_s), 'size_bytes': path.stat().st_size,
                     'parameters': describe(kind, model)}


def describe(kind, model):
    clf = model[-1]
    if kind == 'svm':
        return f'{int(clf.n_support_.sum())} support vectors'
    return f'{len(clf.estimators_)} trees, {sum(t.tree_.node_count for t in clf.estimators_):,} nodes'


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
                weights, epochs, 64, gen, patience=5, clip=5.0)
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


# ---------- scoring ----------

def latency_ms(predict, X, reps=200):
    """Median time to judge ONE 3-second window, as the server does for each clip window (CPU)."""
    one = X[:1]
    for _ in range(10):
        predict(one)
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


def angry_scores(probs):
    """The angry probability the live alert rule sees: shares among the five tones, 0 for non-speech windows."""
    speech = (probs[:, NOISE] < MAX_NOISE_PROB) & (probs.argmax(1) != NOISE)
    tone_p = probs[:, :len(TONES)] / probs[:, :len(TONES)].sum(1, keepdims=True)
    return np.where(speech, tone_p[:, ANGRY], 0.0)


def alert_simulation(p_angry, y, trials=4000):
    """Replay held-out windows as 10-window recordings, like voice.operating_point (same seed for every model)."""
    rng = np.random.default_rng(0)
    pools = {c: np.where(y == CLASSES.index(c))[0] for c in CLASSES}
    names, mix = zip(*{'neutral': .45, 'happy': .20, 'calm': .05, 'stressed': .10, 'noise': .20}.items())
    thr, k = ALERT_RULE

    def rate(n_angry):
        hits = 0
        for _ in range(trials):
            idx = list(rng.choice(pools['angry'], n_angry)) + [rng.choice(pools[c]) for c in rng.choice(names, 10 - n_angry, p=mix)]
            hits += int((p_angry[np.array(idx, dtype=int)] >= thr).sum() >= k)
        return hits / trials

    return {'false_alarm': rate(0), 'mild_3_of_10': rate(3), 'heated_6_of_10': rate(6)}


def score(probs, y, datasets):
    pred = probs.argmax(1)
    speech = y != NOISE
    p_angry = angry_scores(probs)
    flagged = p_angry >= ALERT_RULE[0]
    return {
        'accuracy': float((pred == y).mean()),
        'macro_f1': float(f1_score(y, pred, average='macro')),
        'speech_accuracy': float((pred[speech] == y[speech]).mean()),
        'speech_macro_f1': float(f1_score(y[speech], pred[speech], labels=list(range(len(TONES))), average='macro')),
        'per_class_f1': dict(zip(CLASSES, (round(float(v), 3) for v in f1_score(y, pred, average=None, labels=list(range(len(CLASSES))))))),
        'angry_precision_p60': float(precision_score(y == ANGRY, flagged, zero_division=0)),
        'angry_recall_p60': float(recall_score(y == ANGRY, flagged, zero_division=0)),
        'ece': float(expected_calibration_error(probs, y)),
        'per_dataset_accuracy': {str(n): round(float((pred[datasets == n] == y[datasets == n]).mean()), 3) for n in sorted(set(datasets))},
        'alert': alert_simulation(p_angry, y),
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
    Xte, yte = data['test']
    probs = predict(Xte)
    np.save(OUT / model / 'test_probs.npy', probs.astype(np.float32))
    info['latency_ms'] = round(latency_ms(predict, Xte), 2)
    (OUT / model / 'info.json').write_text(json.dumps(info, indent=2), encoding='utf-8')
    print(model, 'test accuracy', round(float((probs.argmax(1) == yte).mean()), 3), info, flush=True)


NAMES = {
    'cnn': 'CNN on the MFCC image (deployed)',
    'bilstm': 'BiLSTM + attention on the MFCC sequence',
    'svm': 'SVM (RBF) on MFCC statistics',
    'rf': 'Random forest on MFCC statistics',
}


def load_predictor(name):
    """A saved model, ready to judge single windows the way the server would (one thread, no parallel workers)."""
    if name == 'bilstm':
        meta = json.loads((OUT / name / 'norm.json').read_text(encoding='utf-8'))
        return onnx_predictor(OUT / name / 'model.onnx', meta['mean'], meta['std'], meta['temperature'])
    import joblib

    model = joblib.load(OUT / name / 'model.joblib')
    if hasattr(model[-1], 'n_jobs'):
        model[-1].n_jobs = 1  # starting a worker pool for one window would only add delay
    return lambda X: model.predict_proba(stats(X))


def cmd_report():
    data, datasets = load_split()
    Xte, yte = data['test']
    results = {}
    predict, info = deployed_cnn()
    info['latency_ms'] = round(latency_ms(predict, Xte), 2)
    results['cnn'] = {**info, **score(predict(Xte), yte, datasets)}
    for name in ('bilstm', 'svm', 'rf'):
        folder = OUT / name
        if not (folder / 'test_probs.npy').exists():
            print(f'(skipping {name}: run "python -m voice.compare train --model {name}" first)')
            continue
        info = json.loads((folder / 'info.json').read_text(encoding='utf-8'))
        info['latency_ms'] = round(latency_ms(load_predictor(name), Xte), 2)
        results[name] = {**info, **score(np.load(folder / 'test_probs.npy'), yte, datasets)}

    (ART / 'comparison.json').write_text(json.dumps(results, indent=2), encoding='utf-8')
    md = render(results, len(yte))
    (ART / 'comparison.md').write_text(md, encoding='utf-8')
    print(md)


def pct(v):
    return f'{100 * v:.1f} %'


def render(r, n):
    order = sorted(r, key=lambda k: -r[k]['speech_macro_f1'])
    rows = [
        ('Overall accuracy (6 classes)', lambda m: pct(m['accuracy'])),
        ('Macro-F1 (6 classes)', lambda m: f"{m['macro_f1']:.3f}"),
        ('**Speech-only accuracy (5 tones)**', lambda m: pct(m['speech_accuracy'])),
        ('**Speech-only macro-F1**', lambda m: f"{m['speech_macro_f1']:.3f}"),
        *[(f'F1 {c}', (lambda c: lambda m: f"{m['per_class_f1'][c]:.3f}")(c)) for c in CLASSES],
        ('Angry precision at p >= 0.6', lambda m: pct(m['angry_precision_p60'])),
        ('Angry recall at p >= 0.6', lambda m: pct(m['angry_recall_p60'])),
        ('Alert: false alarms (no anger)', lambda m: pct(m['alert']['false_alarm'])),
        ('Alert: catches mild (3 of 10)', lambda m: pct(m['alert']['mild_3_of_10'])),
        ('Alert: catches heated (6 of 10)', lambda m: pct(m['alert']['heated_6_of_10'])),
        ('Calibration error (ECE, lower is better)', lambda m: f"{m['ece']:.3f}"),
        ('Accuracy on CREMA-D speakers', lambda m: pct(m['per_dataset_accuracy'].get('cremad', float('nan')))),
        ('Accuracy on RAVDESS speakers', lambda m: pct(m['per_dataset_accuracy'].get('ravdess', float('nan')))),
        ('Time per 3 s window (CPU)', lambda m: f"{m['latency_ms']:.1f} ms"),
        ('Model file size', lambda m: f"{m['size_bytes'] / 1e6:.2f} MB"),
        ('Size of the model', lambda m: m['parameters']),
        ('Training time', lambda m: '–' if m['train_s'] is None else f"{m['train_s'] / 60:.0f} min"),
    ]
    out = [
        '# Tone model comparison',
        '',
        f'Same features (40 MFCC x 149 frames per 3 s window), same speaker-independent split, test set of {n} windows from '
        'speakers none of the models heard. Models are ordered by speech-only macro-F1. Generated by `python -m voice.compare report`.',
        '',
        '| Metric | ' + ' | '.join(NAMES[k] for k in order) + ' |',
        '|---|' + '---|' * len(order),
    ]
    for label, f in rows:
        out.append(f'| {label} | ' + ' | '.join(f(r[k]) for k in order) + ' |')
    return '\n'.join(out) + '\n'


def main():
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest='cmd', required=True)
    t = sub.add_parser('train')
    t.add_argument('--model', choices=['svm', 'rf', 'bilstm'], required=True)
    t.add_argument('--epochs', type=int, default=20)
    sub.add_parser('report')
    args = ap.parse_args()
    if args.cmd == 'train':
        cmd_train(args.model, args.epochs)
    else:
        cmd_report()


if __name__ == '__main__':
    main()
