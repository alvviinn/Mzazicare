"""Bridge between the Django API and the acoustic tone model in <repo>/ml/voice.

Audio arrives as bytes, is analysed in memory, and is dropped. Only the tone totals are kept.
"""

import sys
import threading
from pathlib import Path

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import ToneReading, ToneSample

_lock = threading.Lock()
_analyzer = None


def get_analyzer():
    """Load the model once per server process. Raises FileNotFoundError until the model is trained."""
    global _analyzer
    if _analyzer is None:
        with _lock:
            if _analyzer is None:
                root = str(Path(settings.VOICE_AI_ROOT))
                if root not in sys.path:
                    sys.path.insert(0, root)
                from voice.infer import ToneAnalyzer

                _analyzer = ToneAnalyzer()
    return _analyzer


def add_to_shift(shift, result, at=None):
    """Record one analysed clip: a point on the live chart, and part of the shift's running tone totals."""
    secs = result['speech_s']
    if secs <= 0:
        return
    ToneSample.objects.create(
        shift=shift, at=at or timezone.now(), speech_s=secs, distress=bool(result.get('distress')),
        **{t: float(result['tones'].get(t, 0)) for t in ('happy', 'calm', 'neutral', 'stressed', 'angry')},
    )
    with transaction.atomic():
        rows = {r.tone: r for r in ToneReading.objects.select_for_update().filter(shift=shift)}
        for tone, share in result['tones'].items():
            row = rows.get(tone) or ToneReading(shift=shift, tone=tone, percent=0, seconds=0)
            row.seconds += secs * share
            rows[tone] = row

        total = sum(r.seconds for r in rows.values())
        if total <= 0:
            return
        raw = {t: 100 * r.seconds / total for t, r in rows.items()}
        pct = {t: int(v) for t, v in raw.items()}
        for t in sorted(raw, key=lambda t: raw[t] - pct[t], reverse=True)[: 100 - sum(pct.values())]:
            pct[t] += 1  # largest-remainder rounding so the five tones add up to exactly 100
        for t, row in rows.items():
            row.percent = pct[t]
            row.save()
