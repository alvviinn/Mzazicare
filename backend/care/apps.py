from django.apps import AppConfig


class CareConfig(AppConfig):
    name = 'care'

    def ready(self):
        from . import signals  # noqa: F401  (push notifications for new alerts and messages)
