from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User

from .models import POSITIVE_TONES, TONE_EMOJI, Alert, Message, Shift, Tone, ToneReading


def require_family(user):
    if user.role != Role.USER:
        raise PermissionDenied('Only family accounts can view the dashboard.')


def minutes_between(start, end):
    return max(1, int(((end or timezone.now()) - start).total_seconds() // 60))


def tone_summary(shifts):
    """Duration-weighted share of each tone across the given shifts."""
    totals = {t: 0.0 for t in Tone.values}
    weight = 0
    for s in shifts:
        readings = list(s.tones.all())
        if not readings:
            continue
        w = minutes_between(s.start_time, s.end_time)
        weight += w
        for r in readings:
            totals[r.tone] += r.percent * w
    if not weight:
        return {'items': [], 'dominant': None, 'quality': None, 'positive_percent': None}

    percents = {t: round(v / weight) for t, v in totals.items()}
    dominant = max(percents, key=percents.get)
    percents[dominant] += 100 - sum(percents.values())  # keep the total at exactly 100
    items = [
        {'tone': t, 'emoji': TONE_EMOJI[t], 'label': Tone(t).label, 'percent': percents[t]}
        for t in Tone.values
    ]
    items.sort(key=lambda i: -i['percent'])
    positive = sum(percents[t] for t in POSITIVE_TONES)
    quality = 'good' if positive >= 70 else 'fair' if positive >= 50 else 'needs_attention'
    return {'items': items, 'dominant': dominant, 'quality': quality, 'positive_percent': positive}


def shift_json(s):
    chores = list(s.chores.all())
    readings = list(s.tones.all())
    top = max(readings, key=lambda r: r.percent).tone if readings else None
    return {
        'id': s.pk,
        'caretaker': s.caretaker.name,
        'elderly': s.elderly.name,
        'start': s.start_time.isoformat(),
        'end': s.end_time.isoformat() if s.end_time else None,
        'minutes': minutes_between(s.start_time, s.end_time),
        'chores_done': sum(c.is_done for c in chores),
        'chores_total': len(chores),
        'dominant_emoji': TONE_EMOJI[top] if top else None,
    }


def can_chat(a, b):
    """Chats exist only between a family account and the people it linked."""
    return (a.role == Role.USER and b.sponsor_id == a.pk) or (b.role == Role.USER and a.sponsor_id == b.pk)


class DashboardView(APIView):
    def get(self, request):
        me = request.user
        require_family(me)

        people = User.objects.filter(sponsor=me)
        caretakers = people.filter(role=Role.CARETAKER).order_by('date_joined')
        elderly = people.filter(role=Role.ELDERLY).order_by('date_joined')

        def person(u):
            unread = Message.objects.filter(sender=u, recipient=me, read_at__isnull=True).count()
            return {'email': u.email, 'name': u.name, 'unread': unread}

        now = timezone.now()
        shifts_qs = (
            Shift.objects.filter(Q(caretaker__sponsor=me) | Q(elderly__sponsor=me))
            .select_related('caretaker', 'elderly')
            .prefetch_related('chores', 'tones')
        )
        week = list(shifts_qs.filter(start_time__gte=now - timedelta(days=7)))
        today = [s for s in week if timezone.localtime(s.start_time).date() == timezone.localdate()]

        month_done = shifts_qs.filter(start_time__gte=now - timedelta(days=30), end_time__isnull=False)
        durations = [minutes_between(s.start_time, s.end_time) for s in month_done]
        chores_week = [c for s in week for c in s.chores.all()]

        if any(s.end_time is None for s in today):
            status = 'on_shift'
        elif today:
            status = 'completed'
        else:
            status = 'none'

        return Response(
            {
                'demo': shifts_qs.filter(is_demo=True).exists(),
                'matched': caretakers.exists() and elderly.exists(),
                'caretakers': [person(u) for u in caretakers],
                'elderly': [person(u) for u in elderly],
                'today': {
                    'status': status,
                    'shifts': [shift_json(s) for s in today],
                    'chores': [
                        {'description': c.description, 'is_done': c.is_done,
                         'done_at': c.done_at.isoformat() if c.done_at else None}
                        for s in today for c in s.chores.all()
                    ],
                },
                'stats': {
                    'avg_visit_minutes': round(sum(durations) / len(durations)) if durations else None,
                    'visits_7d': len(week),
                    'chore_rate_7d': round(100 * sum(c.is_done for c in chores_week) / len(chores_week))
                    if chores_week else None,
                },
                'tones': tone_summary(week),
                'recent_shifts': [shift_json(s) for s in week[:8]],
                'alerts': [
                    {'id': a.pk, 'kind': a.kind, 'label': Alert.Kind(a.kind).label, 'message': a.message,
                     'status': a.status, 'created_at': a.created_at.isoformat()}
                    # open flags first, then the most recent resolved ones
                    for a in sorted(
                        Alert.objects.filter(sponsor=me)[:20],
                        key=lambda a: a.status != Alert.Status.OPEN,
                    )[:10]
                ],
            }
        )


class AlertView(APIView):
    """The family confirms or dismisses a flag; these decisions become labels for retraining later."""

    def post(self, request, pk):
        require_family(request.user)
        status = request.data.get('status')
        if status not in (Alert.Status.CONFIRMED, Alert.Status.DISMISSED):
            raise ValidationError({'detail': 'Status must be confirmed or dismissed.'})
        alert = Alert.objects.filter(pk=pk, sponsor=request.user).first()
        if not alert:
            raise ValidationError({'detail': 'Alert not found.'})
        alert.status = status
        alert.save(update_fields=['status'])
        return Response({'detail': 'ok'})


class ChatView(APIView):
    def _peer(self, request, email):
        peer = User.objects.filter(email=(email or '').strip().lower()).first()
        if not peer or not can_chat(request.user, peer):
            raise PermissionDenied('You can only chat with people in your care circle.')
        return peer

    def get(self, request):
        me, peer = request.user, self._peer(request, request.query_params.get('with'))
        thread = Message.objects.filter(
            Q(sender=me, recipient=peer) | Q(sender=peer, recipient=me)
        ).order_by('-created_at')[:200]
        Message.objects.filter(sender=peer, recipient=me, read_at__isnull=True).update(read_at=timezone.now())
        return Response(
            [
                {'id': m.pk, 'mine': m.sender_id == me.pk, 'body': m.body, 'created_at': m.created_at.isoformat()}
                for m in reversed(list(thread))
            ]
        )

    def post(self, request):
        peer = self._peer(request, request.data.get('to'))
        body = (request.data.get('body') or '').strip()
        if not body:
            raise ValidationError({'detail': 'Message is empty.'})
        if len(body) > 2000:
            raise ValidationError({'detail': 'Message is too long.'})
        m = Message.objects.create(sender=request.user, recipient=peer, body=body)
        return Response(
            {'id': m.pk, 'mine': True, 'body': m.body, 'created_at': m.created_at.isoformat()}, status=201
        )
