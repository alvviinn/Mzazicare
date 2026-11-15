"""Push a notification when something the family (or caretaker) should see right away is created."""

from django.db.models.signals import post_save
from django.dispatch import receiver

from accounts.models import Role, User

from . import push
from .models import Alert, Message

ALERT_TITLE = {
    'sos': 'Emergency',
    'unwell': 'Not feeling well',
    'vocal_distress': 'Raised voices',
    'geofence': 'Location check',
    'missed_chore': 'Missed task',
    'short_visit': 'Short visit',
}


@receiver(post_save, sender=Alert)
def alert_created(sender, instance, created, **kwargs):
    if not created or instance.is_demo:
        return
    people = [instance.sponsor]
    sos = instance.kind == Alert.Kind.SOS
    if sos:  # an emergency also reaches the caretakers in the circle, on the alarm-style channel
        people += list(User.objects.filter(sponsor_id=instance.sponsor_id, role=Role.CARETAKER))
    who = instance.patient.name if instance.patient else None
    push.notify(
        people,
        f'EMERGENCY: {who} needs help' if sos and who else ALERT_TITLE.get(instance.kind, 'Alert'),
        instance.message,
        {'type': 'alert', 'id': instance.pk, 'kind': instance.kind},
        'emergency' if sos else 'alerts',
        urgent=sos or instance.severity >= 2,
    )


@receiver(post_save, sender=Message)
def message_created(sender, instance, created, **kwargs):
    if not created:
        return
    who = instance.sender
    push.notify(
        [instance.recipient],
        who.name or who.email,
        instance.body,
        {'type': 'chat', 'from': who.email},
        'messages',
    )
