from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import PushDevice
from .push import valid_token


class PushDeviceView(APIView):
    """POST {token}: this phone wants notifications for the signed-in account. DELETE {token}: stop (sign out)."""

    def _token(self, request):
        token = (request.data.get('token') or '').strip()
        if not valid_token(token):
            raise ValidationError({'detail': 'Not a push token.'})
        return token

    def post(self, request):
        token = self._token(request)
        # One phone, one account: a token moves to whoever signed in on it last.
        PushDevice.objects.update_or_create(token=token, defaults={'user': request.user})
        return Response({'ok': True}, status=201)

    def delete(self, request):
        PushDevice.objects.filter(token=self._token(request), user=request.user).delete()
        return Response(status=204)
