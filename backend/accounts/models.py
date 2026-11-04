from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class Role(models.TextChoices):
    USER = 'user', 'Family account'
    CARETAKER = 'caretaker', 'Caretaker'
    ELDERLY = 'elderly', 'Elderly'


class UserManager(BaseUserManager):
    use_in_migrations = True

    def create_user(self, email, password=None, **extra):
        if not email:
            raise ValueError('Email is required')
        user = self.model(email=self.normalize_email(email).lower(), **extra)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra):
        extra.setdefault('is_staff', True)
        extra.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra)


class User(AbstractUser):
    """Email-based account. Everyone registers as 'user'; a family account converts others."""

    username = None
    email = models.EmailField(unique=True)
    name = models.CharField(max_length=150)
    role = models.CharField(max_length=20, choices=Role.choices, default=Role.USER)
    # The family account that linked this caretaker/elderly person (null for family accounts).
    sponsor = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='members')
    # When this person agreed to their voice tone being analysed during care visits (null = has not agreed).
    voice_consent_at = models.DateTimeField(null=True, blank=True)
    # Accounts created from now on confirm a password sign-in with an emailed code. Accounts that existed before
    # this was added keep False and sign in as they always did (see accounts/two_factor.py).
    two_factor_required = models.BooleanField(default=False)
    # The Google account linked to this one (its stable "sub" id), once they have signed in with Google.
    google_sub = models.CharField(max_length=255, unique=True, null=True, blank=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['name']
    objects = UserManager()

    def __str__(self):
        return f'{self.email} ({self.role})'


class Invite(models.Model):
    """A caretaker/elderly email added before that person has registered."""

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=[(Role.CARETAKER, 'Caretaker'), (Role.ELDERLY, 'Elderly')])
    sponsor = models.ForeignKey(User, on_delete=models.CASCADE, related_name='invites')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.email} -> {self.role} (by {self.sponsor.email})'


class LoginChallenge(models.Model):
    """A password sign-in waiting for its emailed code. Only hashes are stored; it is deleted once used."""

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='login_challenges')
    token_hash = models.CharField(max_length=64, unique=True)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)  # wrong codes so far
    sends = models.PositiveSmallIntegerField(default=0)  # codes emailed so far
    last_sent_at = models.DateTimeField()
