"""Average several trained tone models into ONE ONNX file with the same interface as a single model.

    python -m voice.ensemble OUT_DIR MEMBER_DIR [MEMBER_DIR ...]          # build
    python -m voice.ensemble --test-metrics OUT_DIR                       # once, at the end: fill in test scores

Why: in round 2, two retrained models (one trained from scratch, one fine-tuned from the live model) each fixed
laughter but each lost a little on a different tone. Their average lost on neither (validation, unseen speakers).

How the app works does not change. The file takes the same input (MFCC normalised with the first member's
mean/std, as written in labels.json) and gives the same six outputs. Inside, it undoes that normalisation, applies
each member's own normalisation and temperature, averages the members' probabilities and returns their log. So
labels.json says temperature 1.0 and voice.infer's softmax gives back exactly the averaged probabilities.
"""

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from torch import nn

from .config import CLASSES, N_FRAMES, N_MFCC
from .model import ToneCNN


def _meta(directory):
    return json.loads((Path(directory) / 'labels.json').read_text(encoding='utf-8'))


class ToneEnsemble(nn.Module):
    def __init__(self, members, in_mean, in_std):
        super().__init__()
        self.members = nn.ModuleList()
        for directory in members:
            m = ToneCNN()
            m.load_state_dict(torch.load(Path(directory) / 'tone_cnn.pt', map_location='cpu'))
            self.members.append(m.eval())
        metas = [_meta(d) for d in members]
        as_t = lambda v: torch.tensor(np.asarray(v, np.float32))[None, None, :, None]
        self.register_buffer('in_mean', as_t(in_mean))
        self.register_buffer('in_std', as_t(in_std))
        self.register_buffer('mean', torch.cat([as_t(x['mean']) for x in metas]))
        self.register_buffer('std', torch.cat([as_t(x['std']) for x in metas]))
        self.register_buffer('temp', torch.tensor([float(x['temperature']) for x in metas]))

    def forward(self, x):  # x: (batch, 1, 40, 149), normalised with in_mean / in_std
        raw = x * self.in_std + self.in_mean
        probs = [torch.softmax(m((raw - self.mean[i:i + 1]) / self.std[i:i + 1]) / self.temp[i], dim=1)
                 for i, m in enumerate(self.members)]
        return torch.log(torch.stack(probs).mean(0).clamp_min(1e-12))


def build(out, members):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    first = _meta(members[0])
    model = ToneEnsemble(members, first['mean'], first['std']).eval()
    torch.save({'members': [str(m) for m in members], 'state': model.state_dict()}, out / 'tone_cnn.pt')
    torch.onnx.export(
        model, torch.zeros(1, 1, N_MFCC, N_FRAMES), str(out / 'tone_cnn.onnx'), input_names=['mfcc'],
        output_names=['logits'], dynamic_axes={'mfcc': {0: 'batch'}, 'logits': {0: 'batch'}}, opset_version=17,
        dynamo=False,
    )
    labels = {k: first[k] for k in ('classes', 'sample_rate', 'window_s', 'n_fft', 'hop', 'n_mels', 'n_mfcc', 'mean', 'std')}
    labels.update({
        'temperature': 1.0,
        'ensemble_of': [{'dir': Path(m).name, 'temperature': _meta(m)['temperature']} for m in members],
        'trained_on': sorted({t for m in members for t in _meta(m).get('trained_on', [])}),
        'metrics': {},  # filled by --test-metrics, once
    })
    (out / 'labels.json').write_text(json.dumps(labels, indent=2), encoding='utf-8')

    # the ONNX file must match the PyTorch ensemble
    import onnxruntime as ort
    x = torch.randn(16, 1, N_MFCC, N_FRAMES)
    onnx_out = ort.InferenceSession(str(out / 'tone_cnn.onnx'), providers=['CPUExecutionProvider']).run(None, {'mfcc': x.numpy()})[0]
    with torch.no_grad():
        diff = float(np.abs(onnx_out - model(x).numpy()).max())
    print('ONNX vs PyTorch max difference:', diff)
    assert diff < 1e-3
    print('saved', out, 'members:', [Path(m).name for m in members])


def test_metrics(out):
    """The same test scores train.py writes for a single model, so labels.json and report.txt describe the ensemble."""
    from sklearn.metrics import classification_report, confusion_matrix, f1_score
    from .data import FEATURES
    from .laugh_eval import probabilities
    out = Path(out)
    d = np.load(FEATURES)
    te = d['split'] == 'test'
    probs, _ = probabilities(out, d['X'][te])
    yt, pred, ds = d['y'][te], probs.argmax(1), d['dataset'][te]
    acc, macro = float((pred == yt).mean()), float(f1_score(yt, pred, average='macro'))
    lines = [f'ENSEMBLE of {", ".join(m["dir"] for m in _meta(out)["ensemble_of"])}',
             f'TEST accuracy {acc:.3f} | macro-F1 {macro:.3f} | n={len(yt)}',
             classification_report(yt, pred, target_names=CLASSES, digits=3),
             'confusion matrix (rows = truth, cols = predicted)', str(CLASSES), str(confusion_matrix(yt, pred))]
    for name in sorted(set(ds)):
        m = ds == name
        lines.append(f'  accuracy on {name}: {float((pred[m] == yt[m]).mean()):.3f} (n={int(m.sum())})')
    speech = yt < CLASSES.index('noise')
    lines.append(f'speech-only accuracy (5 tones, excluding noise windows): {float((pred[speech] == yt[speech]).mean()):.3f}')
    report = '\n'.join(lines)
    print(report)
    (out / 'report.txt').write_text(report, encoding='utf-8')
    per_class = classification_report(yt, pred, target_names=CLASSES, output_dict=True)
    meta = _meta(out)
    meta['metrics'] = {
        'test_accuracy': acc, 'test_macro_f1': macro, 'test_n': int(len(yt)),
        'per_class': {c: {k: round(per_class[c][k], 3) for k in ('precision', 'recall', 'f1-score', 'support')} for c in CLASSES},
    }
    (out / 'labels.json').write_text(json.dumps(meta, indent=2), encoding='utf-8')


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--test-metrics', action='store_true')
    ap.add_argument('out')
    ap.add_argument('members', nargs='*')
    a = ap.parse_args()
    test_metrics(a.out) if a.test_metrics else build(a.out, a.members)
