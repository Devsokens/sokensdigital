from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import Department, User
from core.permissions import has_role
from core.serializers import (
    DepartmentSerializer,
    MeUpdateSerializer,
    UserBriefSerializer,
    UserSerializer,
)


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
        'Everything else — email, department, is_staff, etc. — is managed '
        'through the RH/Admin endpoints, not by the user themselves.',
        request=MeUpdateSerializer,
        responses=UserSerializer,
    )
    def patch(self, request):
        serializer = MeUpdateSerializer(request.user, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user).data)


class IsSuperAdmin(permissions.BasePermission):
    """Département Administration/RH §1.1 — "Seul rôle autorisé à ...
    modifier les départements". Everything here is Super-Admin-only,
    including read: department list/detail isn't sensitive, but there's no
    screen for anyone else to use it from yet either."""

    def has_permission(self, request, view):
        return has_role(request.user, 'SUPER_ADMIN')


@extend_schema_view(
    list=extend_schema(summary='List departments'),
    create=extend_schema(summary='Create a department'),
    retrieve=extend_schema(summary='Get a department'),
    update=extend_schema(summary='Update a department'),
    partial_update=extend_schema(summary='Partially update a department'),
    destroy=extend_schema(summary='Delete a department'),
)
class DepartmentViewSet(viewsets.ModelViewSet):
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    permission_classes = [IsSuperAdmin]


class IsSuperAdminOrRH(permissions.BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, 'RESPONSABLE_RH')


@extend_schema_view(
    list=extend_schema(
        summary='List Django-side user rows',
        description='Read-only. Used to pick a user when linking HR/Finance/Projects '
        'records — the actual account + role live in Firebase/Firestore, this is '
        'just the mirror row Django authenticates against.',
    ),
)
class UserListView(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by('first_name', 'last_name')
    serializer_class = UserBriefSerializer
    permission_classes = [IsSuperAdminOrRH]
