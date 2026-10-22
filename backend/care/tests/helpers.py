"""Shared fixtures for the API and engine tests."""

from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from accounts.models import Role, User
from care.models import Location

PASSWORD = 'pw12345'


def make_user(email, name, role=Role.USER, sponsor=None):
    return User.objects.create_user(email, PASSWORD, name=name, role=role, sponsor=sponsor)


def client_for(user):
    """An API client authenticated with a real JWT, the same way the mobile app calls the API."""
    c = APIClient()
    c.credentials(HTTP_AUTHORIZATION=f'Bearer {AccessToken.for_user(user)}')
    return c


# Latitude/longitude helpers: 0.000009 degrees of latitude is about 1 metre.
LAT, LON = -1.29210, 36.82190
METRE = 0.000009


def place(user, metres_north=0.0, at=None, accuracy=5.0, mocked=False):
    """Put a phone `metres_north` metres from the reference point (the elder's phone sits at 0)."""
    Location.objects.update_or_create(
        user=user,
        defaults=dict(latitude=LAT + metres_north * METRE, longitude=LON, accuracy=accuracy, mocked=mocked,
                      updated_at=at or timezone.now()),
    )


class FamilyTestCase(TestCase):
    """A family of three, each with an authenticated client: self.sponsor / self.caretaker / self.elder."""

    def setUp(self):
        self.sponsor = make_user('family@example.com', 'Pat Parent')
        self.caretaker = make_user('care@example.com', 'Cara Care', Role.CARETAKER, self.sponsor)
        self.elder = make_user('elder@example.com', 'Ella Elder', Role.ELDERLY, self.sponsor)
        self.sponsor_api = client_for(self.sponsor)
        self.caretaker_api = client_for(self.caretaker)
        self.elder_api = client_for(self.elder)

    def put_in_range(self, metres=5.0):
        """Both phones report now, the caretaker `metres` from the elder."""
        place(self.elder, 0)
        place(self.caretaker, metres)

    @staticmethod
    def minutes_ago(n):
        return timezone.now() - timedelta(minutes=n)
