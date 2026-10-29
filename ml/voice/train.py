"""Train, evaluate and export the tone model.

    python -m voice.train [--epochs 30]

Outputs go to artifacts/: tone_cnn.pt, tone_cnn.onnx, labels.json (class names, normalisation, calibration,
metrics) and report.txt. Target from the project spec: >= 80 % accuracy, precision prioritised.
"""

import argparse
import json
import time
from pathlib import Path

import numpy as np
import torch
from sklearn.metrics import classification_report, confusion_matrix, f1_score
from torch import nn

from .config import CLASSES, HOP, N_FFT, N_FRAMES, N_MELS, N_MFCC, SR, WINDOW_S
from .data import DATA
from .model import ToneCNN

ART = Path(__file__).parent / 'artifacts'
torch.set_num_threads(4)


def load():
    d = np.load(DATA / 'features.npz')
    return {k: d[k] for k in d.files}


def augment_batch(x, gen):
    """SpecAugment-style: random time shift, one time mask, light noise (on normalised features)."""
    b = x.shape[0]
    shifts = torch.randint(-12, 13, (b,), generator=gen)
    x = torch.stack([torch.roll(x[i], int(shifts[i]), dims=-1) for i in range(b)])
    for i in range(b):
        w = int(torch.randint(0, 21, (1,), generator=gen))
        s = int(torch.randint(0, max(1, N_FRAMES - w), (1,), generator=gen))
        x[i, :, :, s:s + w] = 0
    return x + 0.03 * torch.randn(x.shape, generator=gen)


@torch.no_grad()
def logits_for(model, X, batch=256):
    model.eval()
    return torch.cat([model(X[i:i + batch]) for i in range(0, len(X), batch)])


def fit_temperature(logits, y):
    """Scale logits so predicted probabilities are honest (matters for 'confident enough to flag')."""
    t = torch.nn.Parameter(torch.ones(1))
    opt = torch.optim.LBFGS([t], lr=0.1, max_iter=60)
    ce = nn.CrossEntropyLoss()

    def closure():
        opt.zero_grad()
        loss = ce(logits / t.clamp(min=0.05), y)
        loss.backward()
        return loss

    opt.step(closure)
    return float(t.clamp(min=0.05))


def fit(model, Xtr, ytr, Xva, yva, weights, epochs, batch, gen, patience=7, clip=None):
    """Train with augmentation and keep the weights with the best validation macro-F1. Returns that state."""
    opt = torch.optim.AdamW(model.parameters(), lr=2e-3, weight_decay=1e-2)
    steps = epochs * int(np.ceil(len(ytr) / batch))
    sched = torch.optim.lr_scheduler.OneCycleLR(opt, max_lr=3e-3, total_steps=steps)
    loss_fn = nn.CrossEntropyLoss(weight=weights, label_smoothing=0.05)

    best_f1, best_state, bad = -1.0, None, 0
    for epoch in range(1, epochs + 1):
        model.train()
        t0 = time.time()
        order = torch.randperm(len(ytr), generator=gen)
        total = 0.0
        for i in range(0, len(order), batch):
            idx = order[i:i + batch]
            xb = augment_batch(Xtr[idx].clone(), gen)
            opt.zero_grad()
            loss = loss_fn(model(xb), ytr[idx])
            loss.backward()
            if clip:
                nn.utils.clip_grad_norm_(model.parameters(), clip)  # recurrent models need this
            opt.step()
            sched.step()
            total += float(loss) * len(idx)
        pred = logits_for(model, Xva).argmax(1).numpy()
        f1 = f1_score(yva.numpy(), pred, average='macro')
        acc = float((pred == yva.numpy()).mean())
        print(f'epoch {epoch:2d} loss {total / len(ytr):.3f} | val acc {acc:.3f} macro-F1 {f1:.3f} | {time.time() - t0:.0f}s', flush=True)
        if f1 > best_f1:
            best_f1, bad = f1, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            bad += 1
            if bad >= patience:
                print('early stop', flush=True)
                break
    return best_state


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--epochs', type=int, default=30)
    ap.add_argument('--batch', type=int, default=64)
    args = ap.parse_args()
    ART.mkdir(exist_ok=True)
    torch.manual_seed(0)
    np.random.seed(0)
    gen = torch.Generator().manual_seed(0)

    d = load()
    split, y_all = d['split'], d['y']
    X_all = d['X'].astype(np.float32)
    tr, va, te = (split == 'train'), (split == 'val'), (split == 'test')

    # per-coefficient normalisation from training data only
    mean = X_all[tr].mean(axis=(0, 2))
    std = X_all[tr].std(axis=(0, 2)) + 1e-5
    norm = lambda X: torch.from_numpy(((X - mean[None, :, None]) / std[None, :, None])[:, None]).float()
    Xtr, Xva, Xte = norm(X_all[tr]), norm(X_all[va]), norm(X_all[te])
    ytr, yva, yte = (torch.from_numpy(y_all[m]).long() for m in (tr, va, te))
    print(f'train {len(ytr)} | val {len(yva)} | test {len(yte)}', flush=True)

    counts = np.bincount(ytr.numpy(), minlength=len(CLASSES)).astype(float)
    weights = torch.tensor((counts.sum() / (len(CLASSES) * counts)) ** 0.5, dtype=torch.float32)
    print('class counts', dict(zip(CLASSES, counts.astype(int).tolist())), flush=True)

    model = ToneCNN()
    print('parameters', sum(p.numel() for p in model.parameters()), flush=True)
    best_state = fit(model, Xtr, ytr, Xva, yva, weights, args.epochs, args.batch, gen)

    model.load_state_dict(best_state)
    temperature = fit_temperature(logits_for(model, Xva), yva)
    print(f'temperature {temperature:.2f}', flush=True)

    # ---- final, untouched test set (unseen speakers / unseen ESC-50 fold) ----
    probs = torch.softmax(logits_for(model, Xte) / temperature, dim=1).numpy()
    pred = probs.argmax(1)
    yt = yte.numpy()
    acc = float((pred == yt).mean())
    macro = f1_score(yt, pred, average='macro')
    lines = [
        f'TEST accuracy {acc:.3f} | macro-F1 {macro:.3f} | n={len(yt)}',
        classification_report(yt, pred, target_names=CLASSES, digits=3),
        'confusion matrix (rows = truth, cols = predicted)',
        str(CLASSES),
        str(confusion_matrix(yt, pred)),
    ]
    ds_te = d['dataset'][te]
    for name in sorted(set(ds_te)):
        m = ds_te == name
        lines.append(f'  accuracy on {name}: {float((pred[m] == yt[m]).mean()):.3f} (n={int(m.sum())})')
    speech = yt < CLASSES.index('noise')
    lines.append(f'speech-only accuracy (5 tones, excluding noise windows): {float((pred[speech] == yt[speech]).mean()):.3f}')
    report = '\n'.join(lines)
    print(report, flush=True)
    (ART / 'report.txt').write_text(report, encoding='utf-8')

    # ---- save + export ----
    torch.save(best_state, ART / 'tone_cnn.pt')
    model.eval()
    dummy = torch.zeros(1, 1, N_MFCC, N_FRAMES)
    torch.onnx.export(
        model, dummy, str(ART / 'tone_cnn.onnx'), input_names=['mfcc'], output_names=['logits'],
        dynamic_axes={'mfcc': {0: 'batch'}, 'logits': {0: 'batch'}}, opset_version=17, dynamo=False,
    )
    per_class = classification_report(yt, pred, target_names=CLASSES, output_dict=True, digits=3)
    labels = {
        'classes': CLASSES,
        'sample_rate': SR, 'window_s': WINDOW_S, 'n_fft': N_FFT, 'hop': HOP, 'n_mels': N_MELS, 'n_mfcc': N_MFCC,
        'mean': mean.tolist(), 'std': std.tolist(), 'temperature': temperature,
        'metrics': {
            'test_accuracy': acc, 'test_macro_f1': macro, 'test_n': int(len(yt)),
            'per_class': {c: {k: round(per_class[c][k], 3) for k in ('precision', 'recall', 'f1-score', 'support')} for c in CLASSES},
        },
        'trained_on': sorted(set(d['dataset'].tolist())),
    }
    (ART / 'labels.json').write_text(json.dumps(labels, indent=2), encoding='utf-8')

    # the ONNX file must give the same answers as the PyTorch model
    import onnxruntime as ort
    sess = ort.InferenceSession(str(ART / 'tone_cnn.onnx'), providers=['CPUExecutionProvider'])
    sample = Xte[:64]
    onnx_out = sess.run(None, {'mfcc': sample.numpy()})[0]
    torch_out = logits_for(model, sample).numpy()
    print('ONNX vs PyTorch max difference:', float(np.abs(onnx_out - torch_out).max()), flush=True)
    print('saved to', ART, flush=True)


if __name__ == '__main__':
    main()
