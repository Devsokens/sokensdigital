from django.core.exceptions import ValidationError
from django.db.models import Q
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.firestore_client import create_profile, invalidate_role_cache, update_profile_fields, upsert_chat_room
from core.models import AuditLog, Department, Role, User, hash_email
from core.permissions import has_role
from core.storage import upload_avatar, upload_file
from core.constants import (
    ROLE_SUPER_ADMIN, ROLE_RH_MANAGER, ROLE_COMMERCIAL,
    ROLE_PROJECT_MANAGER, ROLE_DIRECTEUR_FINANCIER,
    ROLE_COMPTABLE, ROLE_RESPONSABLE_MARKETING,
)
from core.serializers import (
    APP_ROLE_TO_DJANGO_ROLE,
    AuditLogSerializer,
    DepartmentSerializer,
    MeUpdateSerializer,
    ProvisionUserSerializer,
    SetUserRoleSerializer,
    UserBriefSerializer,
    UserSerializer,
)


def _sync_django_role(django_user, app_role):
    """Mirrors the Firestore-facing app role onto the Django-side RBAC
    table (core.permissions.has_role reads user.roles, not Firestore —
    see core.serializers.APP_ROLE_TO_DJANGO_ROLE for why this mapping
    exists). Replaces the user's roles entirely — a person has exactly one
    app role at a time, same as the Firestore profile field."""
    role_name = APP_ROLE_TO_DJANGO_ROLE.get(app_role)
    if role_name:
        role, _ = Role.objects.get_or_create(name=role_name)
        django_user.roles.set([role])
    else:
        django_user.roles.clear()


@extend_schema(
    tags=['Système'],
    summary='Liveness check',
    description='Unauthenticated endpoint used by Render (and uptime monitors) to check readiness.',
    responses={200: {'type': 'object', 'properties': {'status': {'type': 'string'}}}},
    examples=[OpenApiExample('OK', value={'status': 'ok'})],
)
@api_view(['GET'])
@permission_classes([AllowAny])
@throttle_classes([])
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


@extend_schema(
    tags=['Authentification'],
    summary='Upload my avatar photo',
    description='Any authenticated user. Resizes/recompresses and uploads to Cloudinary '
    '(core.storage) — kept off Supabase, which is already over its free-tier egress quota — '
    'returns its public URL. Caller still has to save that URL onto their profile '
    '(PATCH /auth/me/ and the Firestore profile doc).',
    request={'multipart/form-data': {'type': 'object', 'properties': {'file': {'type': 'string', 'format': 'binary'}}}},
    responses={201: {'type': 'object', 'properties': {'url': {'type': 'string'}}}},
)
class AvatarUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            url = upload_avatar(file)
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({'url': url}, status=status.HTTP_201_CREATED)


@extend_schema(
    tags=['Système'],
    summary='Upload a chat attachment',
    description='Any authenticated user — messaging rooms live in Firestore, which has '
    'no server-side view of room membership, so this mirrors the old storage.rules trust '
    'level (any signed-in user). Uploads to Cloudinary (core.storage) — kept off '
    'Supabase, already over its free-tier egress quota — returns its public URL. Caller '
    "still has to attach it to the Firestore message (see lib/firebase/chat's "
    'sendMessage). 20 Mo max, any file type.',
    request={'multipart/form-data': {'type': 'object', 'properties': {'file': {'type': 'string', 'format': 'binary'}}}},
    responses={201: {'type': 'object', 'properties': {'url': {'type': 'string'}}}},
)
class ChatAttachmentUploadView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser]

    def post(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            url = upload_file(file, folder='chat-attachments')
        except ValidationError as exc:
            return Response({'detail': exc.message}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({'url': url}, status=status.HTTP_201_CREATED)


class IsSuperAdmin(permissions.BasePermission):
    """Département Administration/RH §1.1 — "Seul rôle autorisé à ...
    modifier les départements". Everything here is Super-Admin-only,
    including read: department list/detail isn't sensitive, but there's no
    screen for anyone else to use it from yet either."""

    def has_permission(self, request, view):
        return has_role(request.user, ROLE_SUPER_ADMIN)


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

    def perform_create(self, serializer):
        department = serializer.save()
        # Mirrors into Firestore's chat system — firestore.rules only lets
        # SUPER_ADMIN write chatRooms directly, so every department needs
        # its room pushed from here, not created client-side.
        upsert_chat_room(f'dept-{department.id}', {
            'name': f'Salon {department.name}',
            'roomType': 'DEPARTMENT',
            'departmentId': str(department.id),
        })


class IsSuperAdminOrRH(permissions.BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, ROLE_SUPER_ADMIN, ROLE_RH_MANAGER)


class CanListUsers(permissions.BasePermission):
    """Broader than IsSuperAdminOrRH: read-only (name/email only, no salary
    or other sensitive data), so it's also safe for Responsable Marketing —
    who needs it to reassign leads to a Commercial (docs/backend-specifications.md §2.1)."""

    def has_permission(self, request, view):
        return has_role(request.user, ROLE_RH_MANAGER, ROLE_RESPONSABLE_MARKETING)


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
    permission_classes = [CanListUsers]


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

        # RH does the day-to-day hiring, so it can assign any operational
        # role — but only a Super-Admin can grant SUPER_ADMIN itself
        # (docs/backend-specifications.md §1.1/§1.2).
        if data['role'] == 'SUPER_ADMIN' and not has_role(request.user, ROLE_SUPER_ADMIN):
            return Response(
                {'detail': "Seul un Super-Admin peut attribuer le rôle Super-Admin."},
                status=status.HTTP_403_FORBIDDEN,
            )

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
            _sync_django_role(django_user, data['role'])
        except Exception:
            # Roll back the Firebase account so a failed provisioning attempt
            # doesn't leave an orphaned Auth user with no profile/Django row.
            firebase_auth.delete_user(firebase_user.uid)
            raise

        return Response(UserSerializer(django_user).data, status=status.HTTP_201_CREATED)


class SetUserRoleView(APIView):
    """Changes an *existing* user's role/department — Super-Admin only.
    docs/backend-specifications.md §1.1: "Seul rôle autorisé à ... attribuer
    ou révoquer des rôles applicatifs." Distinct from ProvisionUserView,
    which sets the *initial* role for a brand-new account and is also
    reachable by RH."""

    permission_classes = [IsSuperAdmin]

    @extend_schema(
        tags=['Administration & RH'],
        summary="Change an existing user's role/department",
        request=SetUserRoleSerializer,
        responses={200: UserSerializer},
    )
    def patch(self, request, pk):
        django_user = User.objects.filter(pk=pk).first()
        if not django_user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not django_user.firebase_uid:
            return Response(
                {'detail': "Cet utilisateur n'a pas encore de compte Firebase associé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SetUserRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        department = data.get('department')

        update_profile_fields(django_user.firebase_uid, {
            'role': data['role'],
            'departmentId': str(department.id) if department else None,
        })
        invalidate_role_cache(django_user.firebase_uid)
        django_user.department = department
        django_user.save(update_fields=['department'])
        _sync_django_role(django_user, data['role'])

        return Response(UserSerializer(django_user).data)


@extend_schema_view(
    list=extend_schema(
        tags=['Administration & RH'],
        summary='List audit log entries',
        description='Read-only, immutable (docs/backend-specifications.md §1.1 — '
        '"table immuable AuditLog"). Populated automatically on deletion of any '
        'LoggedModel instance; there is no write endpoint by design.',
    ),
    retrieve=extend_schema(tags=['Administration & RH'], summary='Get an audit log entry'),
)
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('user').order_by('-created_at')
    serializer_class = AuditLogSerializer
    permission_classes = [IsSuperAdmin]


SEARCH_RESULT_LIMIT_PER_CATEGORY = 5


@extend_schema(
    tags=['Système'],
    summary='Global search across every module the user can access',
    description='?q=... (min 2 chars). Each category is only searched if the user\'s '
    'role can actually see that data — same scoping as the category\'s own list '
    'endpoint. Results link to the screen that owns the record, not a deep link to '
    'the record itself (most list screens don\'t support that yet).',
    responses={200: {'type': 'array', 'items': {'type': 'object', 'properties': {
        'category': {'type': 'string'}, 'label': {'type': 'string'},
        'sublabel': {'type': 'string'}, 'href': {'type': 'string'},
    }}}},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_search(request):
    query = (request.query_params.get('q') or '').strip()
    if len(query) < 2:
        return Response([])

    user = request.user
    results = []

    # Employees — Administration & RH / RH read access.
    if has_role(user, ROLE_RH_MANAGER, ROLE_SUPER_ADMIN):
        matches = User.objects.filter(
            Q(first_name__icontains=query) | Q(last_name__icontains=query)
        )[:SEARCH_RESULT_LIMIT_PER_CATEGORY]
        for u in matches:
            results.append({
                'category': 'Employés', 'label': f'{u.first_name} {u.last_name}'.strip(),
                'sublabel': '', 'href': '/admin/rh',
            })

    # Leads — Marketing/Commercial.
    if has_role(user, ROLE_RESPONSABLE_MARKETING, ROLE_COMMERCIAL, ROLE_SUPER_ADMIN):
        from marketing.models import BlogPost, Lead, Quote

        leads = Lead.objects.all()
        if not has_role(user, ROLE_RESPONSABLE_MARKETING, ROLE_SUPER_ADMIN):
            leads = leads.filter(assigned_to=user)
        matches = leads.filter(
            Q(first_name__icontains=query) | Q(last_name__icontains=query) | Q(company_name__icontains=query)
        )[:SEARCH_RESULT_LIMIT_PER_CATEGORY]
        for lead in matches:
            results.append({
                'category': 'Leads', 'label': f'{lead.first_name} {lead.last_name}'.strip(),
                'sublabel': lead.company_name, 'href': '/admin/marketing/leads',
            })

        quotes = Quote.objects.select_related('lead')
        if has_role(user, ROLE_COMMERCIAL) and not has_role(user, ROLE_RESPONSABLE_MARKETING, ROLE_SUPER_ADMIN):
            quotes = quotes.filter(created_by=user)
        matches = quotes.filter(quote_number__icontains=query)[:SEARCH_RESULT_LIMIT_PER_CATEGORY]
        for quote in matches:
            results.append({
                'category': 'Devis', 'label': quote.quote_number,
                'sublabel': quote.lead.company_name if quote.lead else '', 'href': '/admin/marketing/devis',
            })

        if has_role(user, ROLE_RESPONSABLE_MARKETING, ROLE_SUPER_ADMIN):
            matches = BlogPost.objects.filter(title__icontains=query)[:SEARCH_RESULT_LIMIT_PER_CATEGORY]
            for post in matches:
                results.append({
                    'category': 'Contenu', 'label': post.title,
                    'sublabel': post.get_status_display(), 'href': '/admin/marketing/blog',
                })

    # Projects — anyone leading/member of one, or wide-read roles.
    from projects.models import Project

    projects = Project.objects.select_related('lead_project_manager')
    if not has_role(user, ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN):
        projects = projects.filter(Q(lead_project_manager=user) | Q(memberships__user=user)).distinct()
    matches = projects.filter(name__icontains=query)[:SEARCH_RESULT_LIMIT_PER_CATEGORY]
    for project in matches:
        results.append({
            'category': 'Projets', 'label': project.name,
            'sublabel': project.get_status_display(), 'href': '/admin/technique/projets',
        })

    # Décaissements — Chef de Projet (their own), Finance roles (all).
    if has_role(user, ROLE_PROJECT_MANAGER, ROLE_DIRECTEUR_FINANCIER, ROLE_COMPTABLE, ROLE_SUPER_ADMIN):
        from finance.models import DisbursementRequest

        disbursements = DisbursementRequest.objects.select_related('project')
        if not has_role(user, ROLE_DIRECTEUR_FINANCIER, ROLE_COMPTABLE, ROLE_SUPER_ADMIN):
            disbursements = disbursements.filter(
                Q(project__lead_project_manager=user) | Q(requested_by=user)
            ).distinct()
        matches = disbursements.filter(beneficiary__icontains=query)[:SEARCH_RESULT_LIMIT_PER_CATEGORY]
        for d in matches:
            results.append({
                'category': 'Décaissements', 'label': d.beneficiary,
                'sublabel': str(d.amount), 'href': '/admin/technique/decaissements',
            })

    return Response(results)
