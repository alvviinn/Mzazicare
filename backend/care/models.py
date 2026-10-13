from django.conf import settings
from django.db import models


class Tone(models.TextChoices):
    HAPPY = 'happy', 'Happy'
    CALM = 'calm', 'Calm'
    NEUTRAL = 'neutral', 'Neutral'
    STRESSED = 'stressed', 'Stressed'
    ANGRY = 'angry', 'Angry'


# Emoji shown on the family dashboard for each tone. Happy and calm count as "good" service.
TONE_EMOJI = {'happy': '😊', 'calm': '😌', 'neutral': '😐', 'stressed': '😟', 'angry': '😠'}
POSITIVE_TONES = ('happy', 'calm')


class Shift(models.Model):
    """One caretaker visit to one elderly person."""

    caretaker = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='shifts')
    elderly = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='care_visits')
    start_time = models.DateTimeField()
    end_time = models.DateTimeField(null=True, blank=True)  # null while the shift is still running
    is_demo = models.BooleanField(default=False)  # sample data created by seed_demo

    class Meta:
        ordering = ['-start_time']

    def __str__(self):
        return f'{self.caretaker.email} -> {self.elderly.email} @ {self.start_time:%Y-%m-%d %H:%M}'


class Chore(models.Model):
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='chores')
    description = models.CharField(max_length=200)
    is_done = models.BooleanField(default=False)
    done_at = models.DateTimeField(null=True, blank=True)


class ToneReading(models.Model):
    """Share of a shift's audio classified under each tone. Filled by the acoustic AI later."""

    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='tones')
    tone = models.CharField(max_length=20, choices=Tone.choices)
    percent = models.PositiveSmallIntegerField()

    class Meta:
        unique_together = ('shift', 'tone')


class Alert(models.Model):
    """A flag for the family to confirm or dismiss (human in the loop)."""

    class Kind(models.TextChoices):
        VOCAL = 'vocal_distress', 'Vocal distress'
        GEOFENCE = 'geofence', 'Left the home area'
        CHORE = 'missed_chore', 'Missed chore'
        SHORT = 'short_visit', 'Short visit'

    class Status(models.TextChoices):
        OPEN = 'open', 'Open'
        CONFIRMED = 'confirmed', 'Confirmed'
        DISMISSED = 'dismissed', 'Dismissed'

    sponsor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='alerts')
    shift = models.ForeignKey(Shift, null=True, blank=True, on_delete=models.CASCADE, related_name='alerts')
    kind = models.CharField(max_length=30, choices=Kind.choices)
    message = models.CharField(max_length=300)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    created_at = models.DateTimeField(auto_now_add=True)
    is_demo = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at']


class Message(models.Model):
    """Direct chat between a family account and one of its caretakers/elderly people."""

    sender = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_messages')
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='received_messages')
    body = models.TextField(max_length=2000)
    created_at = models.DateTimeField(auto_now_add=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
