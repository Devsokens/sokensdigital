from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.serializers import MeUpdateSerializer, UserSerializer


@extend_schema(
    summary='Liveness check',
    description='Unauthenticated endpoint used by Render (and uptime monitors) to check readiness.',
    responses={200: {'type': 'object', 'properties': {'status': {'type': 'string'}}}},
    examples=[OpenApiExample('OK', value={'status': 'ok'})],
)
@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    return Response({'status': 'ok'})


class MeView(APIView):
    """The authenticated user's own profile."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary='Get my profile',
        responses=UserSerializer,
    )
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(
        summary='Update my profile',
        description='Only self-editable fields (first_name, last_name, avatar_url). '
        'Everything else — email, roles, department, is_staff, etc. — is managed '
        'through the RH/Admin endpoints, not by the user themselves.',
        request=MeUpdateSerializer,
        responses=UserSerializer,
    )
    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)
