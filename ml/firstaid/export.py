"""Exports the fine-tuned question model for the backend: ONNX, 8-bit weights, plus the tokenizer and settings.

    python -m firstaid.export

Writes firstaid/artifacts/intent.onnx, tokenizer.json and intent.json, then checks that the exported model gives
the same answers as the PyTorch one.
"""
import json

import numpy as np

from .config import ARTIFACTS, MAX_TOKENS
from .train import MODELS, FineTuned, load, prep
from .evaluate import choose_threshold


def main():
    import torch
    from onnxruntime.quantization import QuantType, quantize_dynamic

    ft = FineTuned()
    model = ft.model.eval()
    ARTIFACTS.mkdir(exist_ok=True)

    class Wrapper(torch.nn.Module):
        def __init__(self, m):
            super().__init__()
            self.m = m

        def forward(self, input_ids, attention_mask):
            return self.m(input_ids, attention_mask)

    x = model.tok(prep(['bibi ameanguka bafuni', 'he is choking']), padding=True, return_tensors='pt')
    full = MODELS / 'intent_fp32.onnx'
    torch.onnx.export(Wrapper(model), (x['input_ids'], x['attention_mask']), str(full),
                      input_names=['input_ids', 'attention_mask'], output_names=['logits'],
                      dynamic_axes={'input_ids': {0: 'batch', 1: 'tokens'}, 'attention_mask': {0: 'batch', 1: 'tokens'},
                                    'logits': {0: 'batch'}}, opset_version=17, dynamo=False)
    quantize_dynamic(str(full), str(ARTIFACTS / 'intent.onnx'), weight_type=QuantType.QInt8)
    model.tok.backend_tokenizer.save(str(ARTIFACTS / 'tokenizer.json'))

    # the confidence threshold is chosen on validation with the exported (8-bit) model
    from .assistant import FirstAidAssistant
    meta = {'labels': ft.labels, 'temperature': ft.temperature, 'threshold': 0.5, 'base_model': ft.meta['base_model'],
            'max_tokens': MAX_TOKENS}
    (ARTIFACTS / 'intent.json').write_text(json.dumps(meta, indent=1), encoding='utf-8')
    assistant = FirstAidAssistant()
    Xva, yva, _ = load('val')
    pva = np.concatenate([assistant.probabilities(Xva[i:i + 256]) for i in range(0, len(Xva), 256)])
    idx = {l: i for i, l in enumerate(ft.labels)}
    meta['threshold'] = choose_threshold(pva, np.array([idx[l] for l in yva]), ft.labels)
    (ARTIFACTS / 'intent.json').write_text(json.dumps(meta, indent=1), encoding='utf-8')

    # does the 8-bit model agree with the original?
    Xte, _, _ = load('test')
    a = ft.logits(Xte).argmax(1)
    b = assistant.probabilities(Xte).argmax(1)
    agree = float(np.mean(a == b))
    size = (ARTIFACTS / 'intent.onnx').stat().st_size / 1e6
    print(f'exported: {size:.0f} MB, threshold {meta["threshold"]:.2f}, agreement with PyTorch on test {agree:.1%}')


if __name__ == '__main__':
    main()
