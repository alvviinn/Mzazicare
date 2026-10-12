from django.contrib.auth import authenticate
from django.db import transaction
from django.db.models import Q
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import AccessToken

from .models import Invite, Role, User


def auth_payload(user):
    return {'token': str(AccessToken.for_user(user)), 'name': user.name, 'role': user.role}


def check_email(value):
    value = (value or '').strip().lower()
    if '@' not in value or ' ' in value:
        raise ValidationError({'detail': 'Enter a valid email address.'})
    return value


class RegisterView(APIView):
    permission_classes = [AllowAny]

    @transaction.atomic
    def post(self, request):
        name = (request.data.get('name') or '').strip()
        email = check_email(request.data.get('email'))
        password = request.data.get('password') or ''
        if len(name) < 2:
            raise ValidationError({'detail': 'Enter your full name.'})
        if len(password) < 6:
            raise ValidationError({'detail': 'Password must be at least 6 characters.'})
        if User.objects.filter(email=email).exists():
            raise ValidationError({'detail': 'An account with this email already exists.'})

        # If a family already added this email, the account starts with that role.
        invite = Invite.objects.filter(email=email).select_related('sponsor').first()
        user = User.objects.create_user(
            email,
            password,
            name=name,
            role=invite.role if invite else Role.USER,
            sponsor=invite.sponsor if invite else None,
        )
        if invite:
            invite.delete()
        return Response(auth_payload(user), status=201)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = (request.data.get('email') or '').strip().lower()
        user = authenticate(request, username=email, password=request.data.get('password') or '')
        if not user:
            raise ValidationError({'detail': 'Incorrect email or password.'})
        return Response(auth_payload(user))


class MeView(APIView):
    def get(self, request):
        me = request.user
        sponsor = me if me.role == Role.USER else me.sponsor

        def active(role):
            if not sponsor:
                return []
            return [
                {'email': u.email, 'name': u.name, 'status': 'active'}
                for u in User.objects.filter(sponsor=sponsor, role=role).order_by('date_joined')
            ]

        def pending(role):
            if me.role != Role.USER:
                return []
            return [
                {'email': i.email, 'name': None, 'status': 'pending'}
                for i in Invite.objects.filter(sponsor=me, role=role).order_by('created_at')
            ]

        return Response(
            {
                'id': str(me.pk),
                'name': me.name,
                'email': me.email,
                'role': me.role,
                'sponsor': {'name': sponsor.name, 'email': sponsor.email} if sponsor and sponsor != me else None,
                'caretakers': active(Role.CARETAKER) + pending(Role.CARETAKER),
                'elderly': active(Role.ELDERLY) + pending(Role.ELDERLY),
            }
        )


class TeamView(APIView):
    """A family account adds a caretaker or elderly person by email."""

    @transaction.atomic
    def post(self, request):
        sponsor = request.user
        role = request.data.get('role')
        email = check_email(request.data.get('email'))
        if sponsor.role != Role.USER:
            raise ValidationError({'detail': 'Only family accounts can add people.'})
        if role not in (Role.CARETAKER, Role.ELDERLY):
            raise ValidationError({'detail': 'Role must be caretaker or elderly.'})
        if email == sponsor.email:
            raise ValidationError({'detail': 'You cannot add your own email.'})

        existing = User.objects.select_for_update().filter(email=email).first()
        if existing:
            if existing.sponsor_id == sponsor.pk:
                raise ValidationError({'detail': 'This person is already in your care circle.'})
            owns_family = User.objects.filter(sponsor=existing).exists() or Invite.objects.filter(sponsor=existing).exists()
            if existing.role != Role.USER or owns_family:
                raise ValidationError({'detail': 'This account is already linked to another family.'})
            existing.role = role  # convert the existing account
            existing.sponsor = sponsor
            existing.save(update_fields=['role', 'sponsor'])
        else:
            if Invite.objects.filter(email=email).exists():
                raise ValidationError({'detail': 'This email has already been invited.'})
            Invite.objects.create(email=email, role=role, sponsor=sponsor)
        return Response({'detail': 'ok'}, status=201)
