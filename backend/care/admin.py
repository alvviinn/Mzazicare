from django.contrib import admin

from .models import Alert, Chore, Message, Shift, ToneReading

admin.site.register([Shift, Chore, ToneReading, Alert, Message])
