"""Everyone in a care circle: who you can message, and emergencies ("I need help") that everyone must see."""

from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User

from . import push
from .models import Alert, Message
from .views import circle_of

EMERGENCY_WINDOW = timedelta(hours=12)  # an unanswered emergency older than this no longer takes over the screen
# After someone handles (or dismisses) an emergency it is closed for everyone at once. For this long the phones still
# get it back, closed, so the others see who handled it and the elder sees that help is coming.
JUST_RESOLVED = timedelta(minutes=10)
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


def circle_emergencies(user, now=None):
    """Recent "I need help" alerts in this user's circle (an elderly person sees only their own)."""
    now = now or timezone.now()
    circle = circle_of(user)
    if circle is None:
        return Alert.objects.none()
    qs = Alert.objects.filter(
        sponsor_id=circle, kind=Alert.Kind.SOS, is_demo=False, created_at__gte=now - EMERGENCY_WINDOW,
    ).select_related('patient', 'handled_by')
    if user.role == Role.ELDERLY:
        qs = qs.filter(patient=user)
    return qs


def open_emergencies(user, now=None):
    """Open emergencies, plus ones closed in the last few minutes (shown closed: who handled it and when).
    An elder is not shown one that was marked a false alarm."""
    now = now or timezone.now()
    just = Q(handled_at__gte=now - JUST_RESOLVED) & ~Q(status=Alert.Status.OPEN)
    if user.role == Role.ELDERLY:
        just &= Q(status=Alert.Status.CONFIRMED)
    return circle_emergencies(user, now).filter(Q(status=Alert.Status.OPEN) | just)


def resolve_emergency(alert, me, status):
    """Close an emergency for EVERYONE: the family dashboard, every phone in the circle and the elder.
    The first person to act is recorded; the others are told by push."""
    if alert.status != Alert.Status.OPEN:
        return False  # someone else got there first; their answer stands
    alert.status = status
    alert.handled_by = me
    alert.handled_at = timezone.now()
    alert.save(update_fields=['status', 'handled_by', 'handled_at'])
    who = me.name or me.email
    patient = alert.patient.name if alert.patient else 'them'
    others = [p for p in circle_members(me) if p.role != Role.ELDERLY]
    data = {'type': 'alert', 'id': alert.pk, 'kind': 'sos_handled'}
    if status == Alert.Status.CONFIRMED:
        push.notify(others, f'{who} is handling it', f"{who} is responding to {patient}'s call for help.", data, 'alerts')
        if alert.patient:
            push.notify([alert.patient], 'Help is coming', f'{who} has seen your call for help.', data, 'alerts', urgent=True)
    else:
        push.notify(others, 'False alarm', f"{who} marked {patient}'s call for help as a false alarm.", data, 'alerts')
    return True


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
        'status': a.status,  # open | confirmed (handled) | dismissed (false alarm)
    }


class EmergencyListView(APIView):
    """GET: open emergencies the app must show full screen (family and caretakers) or confirm (the elder), and
    ones closed in the last few minutes, so everyone sees who handled them."""

    def get(self, request):
        me = request.user
        return Response([emergency_json(a, me) for a in open_emergencies(me)])


class EmergencyHandleView(APIView):
    """POST: "I'm handling it". Closes the emergency for everyone; the first responder is recorded and the others
    are told. If someone already closed it, their answer is returned (no error)."""

    def post(self, request, pk):
        me = request.user
        if me.role not in (Role.USER, Role.CARETAKER):
            raise PermissionDenied('Only family and caretakers can respond to an emergency.')
        with transaction.atomic():
            alert = circle_emergencies(me).select_for_update(of=('self',)).filter(pk=pk).first()
            if not alert:
                raise ValidationError({'detail': 'This emergency is no longer open.'})
            resolve_emergency(alert, me, Alert.Status.CONFIRMED)
        return Response(emergency_json(alert, me))
