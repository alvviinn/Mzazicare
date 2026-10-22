"""Settings for automated tests and CI: no real secrets and no PostgreSQL needed.

    python manage.py test --settings=config.settings_test
"""

import os

# The normal settings read these at import time; harmless dummies for tests.
os.environ.setdefault('DJANGO_SECRET_KEY', 'test-only-not-a-real-secret-' + 'x' * 30)  # >= 32 bytes for JWT signing
os.environ.setdefault('DB_NAME', 'unused')
os.environ.setdefault('DB_USER', 'unused')
os.environ.setdefault('DB_PASSWORD', 'unused')

from .settings import *  # noqa: E402,F401,F403

DATABASES = {'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}}
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']  # fast; tests only
