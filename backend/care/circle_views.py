"""Everyone in a care circle: who you can message, and emergencies ("I need help") that everyone must see."""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User

from . import push
from .models import Alert, Message
from .views import circle_of

EMERGENCY_WINDOW = timedelta(hours=12)  # an unanswered emergency older than this no longer takes over the screen
ROLE_ORDER = {Role.USER: 0, Role.ELDERLY: 1, Role.CARETAKER: 2}


def circle_members(user):
    """Everyone else in this user's care circle (family account first)."""
    circle = circle_of(user)
    if circle is None:
        return []
    people = list(User.objects.filter(pk=circle)) + list(User.objects.filter(sponsor_id=circle))
    people = [p for p in people if p.pk != user.pk and p.role in ROLE_ORDER]
    return sorted(people, key=lambda p: (ROLE_ORDER[p.role], (p.name or p.email).lower()))


class ContactsView(APIView):
    """GET: the people I can message, with how many of their messages I have not read yet."""

    def get(self, request):
        me = request.user
        out = []
        for p in circle_members(me):
            unread = Message.objects.filter(sender=p, recipient=me, read_at__isnull=True).count()
            out.append({'email': p.email, 'name': p.name or p.email, 'role': p.role, 'unread': unread})
        return Response(out)


def open_emergencies(user, now=None):
    """Open "I need help" alerts in this user's circle (an elderly person sees only their own)."""
    now = now or timezone.now()
    circle = circle_of(user)
    if circle is None:
        return Alert.objects.none()
    qs = Alert.objects.filter(
        sponsor_id=circle, kind=Alert.Kind.SOS, status=Alert.Status.OPEN, is_demo=False,
        created_at__gte=now - EMERGENCY_WINDOW,
    ).select_related('patient', 'handled_by')
    if user.role == Role.ELDERLY:
        qs = qs.filter(patient=user)
    return qs


def emergency_json(a, me):
    patient = a.patient
    return {
        'id': a.pk,
        'patient': {'name': patient.name, 'email': patient.email} if patient else None,
        'message': a.message,
        'at': a.created_at.isoformat(),
        'position': {'latitude': a.latitude, 'longitude': a.longitude, 'accuracy': a.accuracy}
        if a.latitude is not None else None,
        'handled_by': (a.handled_by.name or a.handled_by.email) if a.handled_by else None,
        'handled_by_me': a.handled_by_id == me.pk,
        'handled_at': a.handled_at.isoformat() if a.handled_at else None,
    }


class EmergencyListView(APIView):
    """GET: open emergencies the app must show full screen (family and caretakers) or confirm (the elder)."""

    def get(self, request):
        me = request.user
        return Response([emergency_json(a, me) for a in open_emergencies(me)])


class EmergencyHandleView(APIView):
    """POST: "I'm handling it". The first responder is recorded and everyone else is told."""

    def post(self, request, pk):
        me = request.user
        if me.role not in (Role.USER, Role.CARETAKER):
            raise PermissionDenied('Only family and caretakers can respond to an emergency.')
        with transaction.atomic():
            alert = open_emergencies(me).select_for_update(of=('self',)).filter(pk=pk).first()
            if not alert:
                raise ValidationError({'detail': 'This emergency is no longer open.'})
            if alert.handled_by_id is None:
                alert.handled_by = me
                alert.handled_at = timezone.now()
                alert.save(update_fields=['handled_by', 'handled_at'])
                who = me.name or me.email
                patient = alert.patient.name if alert.patient else 'them'
                others = [p for p in circle_members(me) if p.role != Role.ELDERLY]
                push.notify(others, f'{who} is handling it', f'{who} is responding to {patient}\'s call for help.',
                            {'type': 'alert', 'id': alert.pk, 'kind': 'sos_handled'}, 'alerts')
                if alert.patient:
                    push.notify([alert.patient], 'Help is coming', f'{who} has seen your call for help.',
                                {'type': 'alert', 'id': alert.pk, 'kind': 'sos_handled'}, 'alerts', urgent=True)
        return Response(emergency_json(alert, me))
