import re
from datetime import datetime, time, timedelta

from django.utils import timezone
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.models import Role, User

from . import presence
from .models import Alert, CheckIn, Medication, MedicationLog, Message, Mood, Shift

MAX_MEDICINES_PER_ELDER = 20
MISSED_AFTER = timedelta(hours=2)


def require_elder(user):
    if user.role != Role.ELDERLY:
        raise PermissionDenied('This is only available to elderly accounts.')


def require_family(user):
    if user.role != Role.USER:
        raise PermissionDenied('Only family accounts can manage medicines.')


def local_midnight(day):
    return timezone.make_aware(datetime.combine(day, time.min))


def medicines_json(elder, now):
    """Today's medicines for one elderly person, with taken/due state."""
    today = timezone.localdate(now)
    taken = {l.medication_id: l for l in MedicationLog.objects.filter(medication__elderly=elder, date=today)}
    out = []
    for m in Medication.objects.filter(elderly=elder):
        log = taken.get(m.pk)
        due_at = timezone.make_aware(datetime.combine(today, m.time))
        if log:
            state = 'taken'
        elif now >= due_at + MISSED_AFTER:
            state = 'missed'
        elif now >= due_at:
            state = 'due'
        else:
            state = 'later'
        out.append(
            {
                'id': m.pk,
                'elderly': elder.name,
                'elderly_email': elder.email,
                'name': m.name,
                'dose': m.dose,
                'time': m.time.strftime('%H:%M'),
                'taken': bool(log),
                'taken_at': log.taken_at.isoformat() if log else None,
                'state': state,
            }
        )
    return out


def mood_today(user, now):
    c = CheckIn.objects.filter(user=user, created_at__gte=local_midnight(timezone.localdate(now))).first()
    return {'mood': c.mood, 'at': c.created_at.isoformat()} if c else None


class ElderHomeView(APIView):
    """Everything the elderly person's home screen needs, in plain terms."""

    def get(self, request):
        me = request.user
        require_elder(me)
        now = timezone.now()

        caretakers = list(User.objects.filter(sponsor_id=me.sponsor_id, role=Role.CARETAKER))
        for c in caretakers:
            presence.evaluate(c, now)

        shifts = list(
            Shift.objects.filter(elderly=me, is_demo=False, start_time__gte=local_midnight(timezone.localdate(now)))
            .select_related('caretaker')
            .prefetch_related('segments')
        )
        live = next((s for s in shifts if s.end_time is None and presence.open_segment(s)), None)
        paused = next((s for s in shifts if s.end_time is None), None)
        if not caretakers:
            caretaker = {'status': 'none', 'name': None}
        elif live:
            caretaker = {'status': 'here', 'name': live.caretaker.name}
        elif paused:
            caretaker = {'status': 'away', 'name': paused.caretaker.name}
        elif shifts:
            caretaker = {'status': 'left', 'name': shifts[0].caretaker.name}
        else:
            caretaker = {'status': 'not_arrived', 'name': caretakers[0].name}

        return Response(
            {
                'caretaker': caretaker,
                'mood_today': mood_today(me, now),
                'medicines': medicines_json(me, now),
            }
        )


class CheckInView(APIView):
    def post(self, request):
        me = request.user
        require_elder(me)
        mood = request.data.get('mood')
        if mood not in Mood.values:
            raise ValidationError({'detail': 'Choose how you are feeling.'})
        CheckIn.objects.create(user=me, mood=mood)

        if mood == Mood.UNWELL and me.sponsor_id:
            recent = Alert.objects.filter(
                sponsor_id=me.sponsor_id, kind=Alert.Kind.UNWELL, created_at__gte=timezone.now() - timedelta(hours=3)
            )
            if not recent.exists():
                Alert.objects.create(
                    sponsor_id=me.sponsor_id,
                    kind=Alert.Kind.UNWELL,
                    message=f'{me.name} says they are not feeling well today.',
                )
        return Response({'detail': 'ok'}, status=201)


class SosView(APIView):
    """The big red button. Alerts the family and sends them a chat message."""

    def post(self, request):
        me = request.user
        require_elder(me)
        if not me.sponsor_id:
            raise ValidationError({'detail': 'No family account is linked to you yet.'})
        now = timezone.now()
        recent = Alert.objects.filter(
            sponsor_id=me.sponsor_id, kind=Alert.Kind.SOS, status=Alert.Status.OPEN, created_at__gte=now - timedelta(minutes=2)
        )
        if not recent.exists():  # a double tap must not flood the family
            Alert.objects.create(
                sponsor_id=me.sponsor_id,
                kind=Alert.Kind.SOS,
                message=f'{me.name} pressed the emergency button and needs help.',
            )
            Message.objects.create(sender=me, recipient_id=me.sponsor_id, body='🆘 I need help. Please call me now.')
        return Response({'detail': 'ok'}, status=201)


class MedicineTakeView(APIView):
    def post(self, request, pk):
        me = request.user
        require_elder(me)
        med = Medication.objects.filter(pk=pk, elderly=me).first()
        if not med:
            raise ValidationError({'detail': 'Medicine not found.'})
        MedicationLog.objects.get_or_create(medication=med, date=timezone.localdate())
        return Response({'detail': 'ok'}, status=201)


# ---- Family manages the medicine reminders ----


class MedicineListView(APIView):
    def post(self, request):
        me = request.user
        require_family(me)
        elder = User.objects.filter(
            email=(request.data.get('elderly_email') or '').strip().lower(), sponsor=me, role=Role.ELDERLY
        ).first()
        if not elder:
            raise ValidationError({'detail': 'Choose one of your elderly people.'})
        name = (request.data.get('name') or '').strip()
        dose = (request.data.get('dose') or '').strip()
        if not name:
            raise ValidationError({'detail': 'Enter the medicine name.'})
        if len(name) > 100 or len(dose) > 100:
            raise ValidationError({'detail': 'Name or dose is too long.'})
        raw = (request.data.get('time') or '').strip()
        if not re.fullmatch(r'\d{1,2}:\d{2}', raw):
            raise ValidationError({'detail': 'Enter the time like 08:00 or 20:30.'})
        try:
            at = datetime.strptime(raw, '%H:%M').time()
        except ValueError:
            raise ValidationError({'detail': 'Enter a real time, like 08:00 or 20:30.'})
        if Medication.objects.filter(elderly=elder).count() >= MAX_MEDICINES_PER_ELDER:
            raise ValidationError({'detail': 'Too many medicines. Remove ones no longer needed.'})
        m = Medication.objects.create(elderly=elder, name=name, dose=dose, time=at)
        return Response({'id': m.pk}, status=201)


class MedicineDetailView(APIView):
    def delete(self, request, pk):
        require_family(request.user)
        m = Medication.objects.filter(pk=pk, elderly__sponsor=request.user).first()
        if not m:
            raise ValidationError({'detail': 'Medicine not found.'})
        m.delete()
        return Response(status=204)
