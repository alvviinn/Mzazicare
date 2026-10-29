import torch
from torch import nn

from .config import CLASSES


def block(cin, cout, convs=2):
    layers = []
    for i in range(convs):
        layers += [nn.Conv2d(cin if i == 0 else cout, cout, 3, padding=1, bias=False), nn.BatchNorm2d(cout), nn.ReLU(inplace=True)]
    layers.append(nn.MaxPool2d(2))
    return nn.Sequential(*layers)


class ToneCNN(nn.Module):
    """Small 2D CNN over a (1 x 40 MFCC x 149 frames) image. About 0.1 M parameters, runs in real time on a CPU."""

    def __init__(self, n_classes=len(CLASSES)):
        super().__init__()
        self.features = nn.Sequential(
            block(1, 16, convs=1),
            block(16, 32),
            block(32, 64),
            block(64, 96, convs=1),
        )
        self.head = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(0.3), nn.Linear(96, n_classes))

    def forward(self, x):  # x: (batch, 1, 40, 149), already normalised
        return self.head(self.features(x))


class ToneBiLSTM(nn.Module):
    """Bidirectional LSTM over the MFCC frames, with attention pooling over time.

    Neighbouring frames are averaged in pairs first (149 -> 74 steps of 40 ms), which keeps it fast enough to train on a
    CPU. Takes the same (batch, 1, 40, 149) input as ToneCNN, so it can be swapped in behind the same ONNX interface.
    """

    def __init__(self, n_classes=len(CLASSES), n_mfcc=40, hidden=64):
        super().__init__()
        self.pool = nn.AvgPool1d(2)
        self.lstm = nn.LSTM(n_mfcc, hidden, num_layers=2, batch_first=True, bidirectional=True, dropout=0.3)
        self.attn = nn.Linear(2 * hidden, 1)
        self.head = nn.Sequential(nn.Dropout(0.3), nn.Linear(2 * hidden, n_classes))

    def forward(self, x):  # x: (batch, 1, 40, 149), already normalised
        seq, _ = self.lstm(self.pool(x[:, 0]).transpose(1, 2))  # (batch, 74, 2*hidden)
        weights = torch.softmax(self.attn(seq), dim=1)  # which moments matter most
        return self.head((weights * seq).sum(dim=1))
