"""The live tone view for the family: what the voices sound like right now, how the day has gone, and how
it compares with earlier days. Built from `ToneSample` rows (one per analysed clip), never from audio."""

from datetime import timedelta

from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User

from . import presence
from .models import TONE_EMOJI, Alert, Shift, Tone, ToneReading, ToneSample

BUCKET_MIN = 15  # one point on the day chart
LIVE_S = 180  # a clip this recent means the tone is "live"
NOW_WINDOW_MIN = 5  # "right now" averages the last few minutes of speech
TONES = ('happy', 'calm', 'neutral', 'stressed', 'angry')


def quality_of(negative_percent):
    """Rated on stressed + angry speech only: everyday talk is mostly neutral and that is fine."""
    return 'good' if negative_percent <= 15 else 'fair' if negative_percent <= 30 else 'needs_attention'


def _shares(samples):
    """Speech-seconds-weighted tone shares (percent, adding up to 100) over some samples, or None."""
    total = sum(s.speech_s for s in samples)
    if total <= 0:
        return None
    raw = {t: 100 * sum(getattr(s, t) * s.speech_s for s in samples) / total for t in TONES}
    pct = {t: int(v) for t, v in raw.items()}
    for t in sorted(raw, key=lambda t: raw[t] - pct[t], reverse=True)[: 100 - sum(pct.values())]:
        pct[t] += 1
    return pct


def _point(start, samples):
    pct = _shares(samples)
    return {
        'start': start.isoformat(),
        'speech_s': round(sum(s.speech_s for s in samples)),
        'shares': pct,
        'tension': pct['stressed'] + pct['angry'],
        'positive': pct['happy'] + pct['calm'],
        'dominant': max(pct, key=pct.get),
    }


def series_of(samples, minutes=BUCKET_MIN):
    """Group clips into fixed time buckets; empty buckets are left out (no speech, no point)."""
    buckets = {}
    for s in samples:
        local = timezone.localtime(s.at)
        start = local.replace(minute=local.minute - local.minute % minutes, second=0, microsecond=0)
        buckets.setdefault(start, []).append(s)
    return [_point(start, buckets[start]) for start in sorted(buckets)]


def _tone_card(pct):
    return [{'tone': t, 'emoji': TONE_EMOJI[t], 'label': Tone(t).label, 'percent': pct[t]}
            for t in sorted(TONES, key=lambda t: -pct[t])]


def _earlier_days(sponsor, now, days=7):
    """Daily tension and positive share for the days before today, from the shifts' running totals."""
    today = timezone.localdate(now)
    first = presence.day_start(now) - timedelta(days=days)
    by_day = {}
    qs = ToneReading.objects.filter(
        shift__caretaker__sponsor=sponsor, shift__start_time__gte=first, shift__start_time__lt=presence.day_start(now)
    ).select_related('shift')
    for r in qs:
        day = timezone.localtime(r.shift.start_time).date()
        by_day.setdefault(day, {t: 0.0 for t in TONES})[r.tone] += r.seconds or r.percent
    out = []
    for offset in range(days, 0, -1):
        day = today - timedelta(days=offset)
        w = by_day.get(day)
        total = sum(w.values()) if w else 0
        if total:
            out.append({
                'date': day.isoformat(),
                'tension': round(100 * (w['stressed'] + w['angry']) / total),
                'positive': round(100 * (w['happy'] + w['calm']) / total),
            })
    return out


def live_payload(sponsor, now=None):
    now = now or timezone.now()
    caretakers = list(User.objects.filter(sponsor=sponsor, role=Role.CARETAKER))
    listening, shift_ids, waiting_for = False, [], []
    for c in caretakers:
        shift = presence.evaluate(c, now)  # settle live shifts before reporting them
        if shift and presence.open_segment(shift):
            listening = True
            waiting_for += [u.name for u in (shift.caretaker, shift.elderly) if u.voice_consent_at is None]
        shift_ids += list(Shift.objects.filter(caretaker=c, start_time__gte=presence.day_start(now)).values_list('pk', flat=True))

    samples = list(ToneSample.objects.filter(shift_id__in=shift_ids, at__gte=presence.day_start(now)).order_by('at'))
    last = samples[-1] if samples else None
    live = listening and last is not None and (now - last.at).total_seconds() <= LIVE_S
    state = 'live' if live else 'needs_consent' if waiting_for else 'listening' if listening else 'idle'

    recent = [s for s in samples if (now - s.at).total_seconds() <= NOW_WINDOW_MIN * 60]
    current = None
    if recent:
        pct = _shares(recent)
        current = {'shares': pct, 'dominant': max(pct, key=pct.get), 'tension': pct['stressed'] + pct['angry']}
        current['by_source'] = {}  # what each phone heard: the caretaker's and the elderly person's
        for who in ('caretaker', 'elderly'):
            part = [s for s in recent if s.source == who]
            if part:
                p = _shares(part)
                current['by_source'][who] = {'dominant': max(p, key=p.get), 'tension': p['stressed'] + p['angry']}

    data = {
        'state': state,
        'waiting_for': sorted(set(waiting_for)),  # people who have not yet agreed to voice monitoring
        'last_heard': last.at.isoformat() if last else None,
        'current': current,
        'series': series_of(samples),
        'bucket_minutes': BUCKET_MIN,
        'earlier_days': _earlier_days(sponsor, now),
        'today': None,
    }
    if samples:
        pct = _shares(samples)
        points = data['series']
        calm = min(points, key=lambda p: p['tension'])
        tense = max(points, key=lambda p: p['tension'])
        negative = pct['stressed'] + pct['angry']
        earlier = data['earlier_days']
        usual = round(sum(d['tension'] for d in earlier) / len(earlier)) if earlier else None
        data['today'] = {
            'items': _tone_card(pct),
            'dominant': max(pct, key=pct.get),
            'quality': quality_of(negative),
            'positive_percent': pct['happy'] + pct['calm'],
            'negative_percent': negative,
            'speech_minutes': round(sum(s.speech_s for s in samples) / 60, 1),
            'clips': len(samples),
            'calmest': {'start': calm['start'], 'tension': calm['tension']},
            'tensest': {'start': tense['start'], 'tension': tense['tension']},
            'usual_tension': usual,  # the average of the previous days, to compare today with
            'raised_voice_clips': sum(s.distress for s in samples),
            'vocal_alerts': Alert.objects.filter(
                sponsor=sponsor, kind=Alert.Kind.VOCAL, created_at__gte=presence.day_start(now)
            ).count(),
        }
    return data


class LiveToneView(APIView):
    """GET /api/tone/live/ : the family's live tone view for today. Polled every few seconds."""

    def get(self, request):
        from .views import require_family

        require_family(request.user)
        return Response(live_payload(request.user))
