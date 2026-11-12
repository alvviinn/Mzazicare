import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / '.env')

SECRET_KEY = os.environ['DJANGO_SECRET_KEY']
DEBUG = os.environ.get('DJANGO_DEBUG', '0') == '1'
ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost').split(',')

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'corsheaders',
    'rest_framework',
    'accounts',
    'care',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': os.environ['DB_NAME'],
        'USER': os.environ['DB_USER'],
        'PASSWORD': os.environ['DB_PASSWORD'],
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
        # Azure Database for PostgreSQL only accepts encrypted connections: DB_SSLMODE=require there.
        'OPTIONS': {'sslmode': os.environ['DB_SSLMODE']} if os.environ.get('DB_SSLMODE') else {},
        'CONN_MAX_AGE': 60,
    }
}

AUTH_USER_MODEL = 'accounts.User'

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 6}},
]

LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Africa/Nairobi'
USE_I18N = True
USE_TZ = True

STATIC_URL = 'static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': ['rest_framework_simplejwt.authentication.JWTAuthentication'],
    'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
}

# Users stay signed in for about 3 months (matches the mobile app's session).
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=90),
    'AUTH_HEADER_TYPES': ('Bearer',),
}

# ---- Sign-in: Google and the emailed code ----
# Client IDs from Google Cloud (OAuth): web, Android and iOS, comma-separated. Empty = Google sign-in is off.
GOOGLE_CLIENT_IDS = [c.strip() for c in os.environ.get('GOOGLE_CLIENT_IDS', '').split(',') if c.strip()]

# Email for the 6-digit sign-in codes, in order of preference:
# 1. Azure Communication Services Email (ACS_EMAIL_CONNECTION_STRING): Azure's own sending address, no mailbox needed.
# 2. Any SMTP server (EMAIL_HOST ...).
# 3. Neither: the codes are printed in the backend console (development).
ACS_EMAIL_CONNECTION_STRING = os.environ.get('ACS_EMAIL_CONNECTION_STRING', '')
EMAIL_HOST = os.environ.get('EMAIL_HOST', '')
if ACS_EMAIL_CONNECTION_STRING:
    EMAIL_BACKEND = 'accounts.azure_email.AzureEmailBackend'
elif EMAIL_HOST:
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', '587'))
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', '')
    EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
    EMAIL_USE_TLS = os.environ.get('EMAIL_USE_TLS', '1') == '1'
    EMAIL_TIMEOUT = 15
else:
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
DEFAULT_FROM_EMAIL = os.environ.get('EMAIL_FROM', 'MzaziCare <no-reply@mzazicare.local>')
# Development aid for scripts such as ml/voice/test_endpoint.py: also return the code in the API response.
# Only ever honoured while DEBUG is on and no real email server is configured.
TWO_FACTOR_ECHO_CODE = DEBUG and not (EMAIL_HOST or ACS_EMAIL_CONNECTION_STRING) and os.environ.get('MZAZI_2FA_ECHO_CODE', '0') == '1'

# ---- Acoustic tone AI ----
# The model code lives in <repo>/ml/voice. Audio sent for analysis is held in memory only: never saved.
VOICE_AI_ROOT = Path(os.environ.get('VOICE_AI_ROOT', BASE_DIR.parent / 'ml'))
VOICE_AUDIO_MAX_BYTES = 3_000_000  # ~90 s of 16 kHz mono; clips from the app are far shorter
FILE_UPLOAD_HANDLERS = ['django.core.files.uploadhandler.MemoryFileUploadHandler']  # never spool uploads to disk

# The sponsor web dashboard will call this API from the browser.
CORS_ALLOW_ALL_ORIGINS = DEBUG
# In production, the dashboard's address(es), e.g. https://<name>.azurestaticapps.net (comma-separated).
CORS_ALLOWED_ORIGINS = [o.strip() for o in os.environ.get('CORS_ALLOWED_ORIGINS', '').split(',') if o.strip()]

# ---- Production (Azure App Service) ----
STATIC_ROOT = BASE_DIR / 'staticfiles'
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')  # Azure ends HTTPS in front of the app
    CSRF_TRUSTED_ORIGINS = [f'https://{h}' for h in ALLOWED_HOSTS if h and h != '*']
    SESSION_COOKIE_SECURE = CSRF_COOKIE_SECURE = True
LOGGING = {  # errors (and, with no email service set, the sign-in codes) appear in the App Service log stream
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {'console': {'class': 'logging.StreamHandler'}},
    'root': {'handlers': ['console'], 'level': 'WARNING'},
}

