from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.firestore_client import create_profile
from core.models import Department, User, hash_email
from core.permissions import has_role
from core.serializers import (
    DepartmentSerializer,
    MeUpdateSerializer,
    ProvisionUserSerializer,
    UserBriefSerializer,
    UserSerializer,
)


@extend_schema(
    tags=['Système'],
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
        tags=['Authentification'],
        summary='Get my profile',
        responses=UserSerializer,
    )
    def get(self, request):
        return Response(UserSerializer(request.user).data)

    @extend_schema(
        tags=['Authentification'],
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
    list=extend_schema(tags=['Administration & RH'], summary='List departments'),
    create=extend_schema(tags=['Administration & RH'], summary='Create a department'),
    retrieve=extend_schema(tags=['Administration & RH'], summary='Get a department'),
    update=extend_schema(tags=['Administration & RH'], summary='Update a department'),
    partial_update=extend_schema(tags=['Administration & RH'], summary='Partially update a department'),
    destroy=extend_schema(tags=['Administration & RH'], summary='Delete a department'),
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
        tags=['Administration & RH'],
        summary='List Django-side user rows',
        description='Read-only. Used to pick a user when linking HR/Finance/Projects '
        'records — the actual account + role live in Firebase/Firestore, this is '
        'just the mirror row Django authenticates against.',
    ),
    retrieve=extend_schema(tags=['Administration & RH'], summary='Get a Django-side user row'),
)
class UserListView(viewsets.ReadOnlyModelViewSet):
    queryset = User.objects.all().order_by('first_name', 'last_name')
    serializer_class = UserBriefSerializer
    permission_classes = [IsSuperAdminOrRH]


class ProvisionUserView(APIView):
    """Creates a new employee's platform access in one call: Firebase Auth
    account + Firestore profile (role/department) + Django User row.

    Why this can't be done from the client SDK: `createUserWithEmailAndPassword`
    signs the *browser* in as the newly created user, which would kick the
    admin out of their own session. The Firebase Admin SDK (server-side,
    already initialized in core/apps.py) has no such side effect.
    """

    permission_classes = [IsSuperAdminOrRH]

    @extend_schema(
        tags=['Administration & RH'],
        summary="Provision a new employee's platform access",
        description='Creates the Firebase Auth account, the Firestore profile '
        '(role/department), and the Django-side User row together. Restricted '
        'to Super-Admin/Responsable RH (docs/backend-specifications.md §1.1).',
        request=ProvisionUserSerializer,
        responses={201: UserSerializer},
    )
    def post(self, request):
        serializer = ProvisionUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        department = data.get('department')

        from firebase_admin import auth as firebase_auth

        try:
            firebase_user = firebase_auth.create_user(
                email=data['email'],
                password=data['password'],
                display_name=f"{data['first_name']} {data['last_name']}",
            )
        except firebase_auth.EmailAlreadyExistsError:
            return Response(
                {'detail': 'Un compte existe déjà avec cet email.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            create_profile(firebase_user.uid, {
                'email': data['email'],
                'firstName': data['first_name'],
                'lastName': data['last_name'],
                'role': data['role'],
                'departmentId': str(department.id) if department else None,
            })

            django_user = User.objects.filter(email_hash=hash_email(data['email'])).first()
            if django_user:
                django_user.firebase_uid = firebase_user.uid
                django_user.department = department
                django_user.save(update_fields=['firebase_uid', 'department'])
            else:
                django_user = User.objects.create_user(
                    email=data['email'],
                    first_name=data['first_name'],
                    last_name=data['last_name'],
                )
                django_user.firebase_uid = firebase_user.uid
                django_user.department = department
                django_user.save(update_fields=['firebase_uid', 'department'])
        except Exception:
            # Roll back the Firebase account so a failed provisioning attempt
            # doesn't leave an orphaned Auth user with no profile/Django row.
            firebase_auth.delete_user(firebase_user.uid)
            raise

        return Response(UserSerializer(django_user).data, status=status.HTTP_201_CREATED)
