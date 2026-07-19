from drf_spectacular.utils import OpenApiExample, extend_schema
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


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
