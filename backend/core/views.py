import logging
from datetime import date, datetime, timedelta
from decimal import Decimal

from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db.models import Count, F, Sum, Q
from django.utils import timezone
from drf_spectacular.utils import OpenApiExample, extend_schema, extend_schema_view
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.parsers import MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.accounts import AccountDeletionError, delete_platform_account
from core.emails import send_user_invitation_email
from core.firestore_client import create_profile, invalidate_role_cache, update_profile_fields, upsert_chat_room
from core.models import AuditLog, Department, PushDevice, Role, User, hash_email
from core.notifications import notify, notify_roles
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
    DepartmentDetailSerializer,
    DepartmentSerializer,
    MeUpdateSerializer,
    ProvisionUserSerializer,
    RoleSerializer,
    SetUserPasswordSerializer,
    SetUserPermissionsSerializer,
    SetUserRoleSerializer,
    UserBriefSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


def _sync_django_roles(django_user, app_roles):
    """Mirrors the Firestore-facing app roles onto the Django-side RBAC
    table (core.permissions.has_role reads user.roles, not Firestore —
    see core.serializers.APP_ROLE_TO_DJANGO_ROLE for why this mapping
    exists). Replaces the user's role set entirely with the given list —
    a person can cumulate several app roles (décision du 10/09/2026), so
    `app_roles` is the full set to end up with, not one to add. 'AUTRE' and
    any other unmapped value contribute no Django role, same as before."""
    role_names = {APP_ROLE_TO_DJANGO_ROLE[r] for r in app_roles if r in APP_ROLE_TO_DJANGO_ROLE}
    role_objs = [Role.objects.get_or_create(name=name)[0] for name in role_names]
    django_user.roles.set(role_objs)


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

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return DepartmentDetailSerializer
        return DepartmentSerializer

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

    def destroy(self, request, *args, **kwargs):
        department = self.get_object()
        member_count = department.user_set.count()
        if member_count:
            return Response(
                {'detail': f"Impossible de supprimer un département avec des employés ({member_count})."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().destroy(request, *args, **kwargs)


class IsSuperAdminOrRH(permissions.BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, ROLE_SUPER_ADMIN, ROLE_RH_MANAGER)


class CanListUsers(permissions.BasePermission):
    """Broader than IsSuperAdminOrRH: read-only (name/email only, no salary
    or other sensitive data), so it's also safe for Responsable Marketing —
    who needs it to reassign leads to a Commercial (docs/backend-specifications.md §2.1).
    Super-Admin included too — "accès complet à l'ensemble du système"
    (cahier des charges §4.8) means never narrower than every other role."""

    def has_permission(self, request, view):
        return has_role(request.user, ROLE_SUPER_ADMIN, ROLE_RH_MANAGER, ROLE_RESPONSABLE_MARKETING)


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
    # Comptes supprimés exclus : la ligne reste pour la fiche employé et
    # l'historique, mais ce n'est plus un utilisateur (core.accounts).
    queryset = User.objects.filter(account_deleted_at__isnull=True).order_by('first_name', 'last_name')
    serializer_class = UserBriefSerializer
    permission_classes = [CanListUsers]


def _existing_account_response(email):
    """Explique pourquoi un compte de connexion existe déjà pour `email`.

    Cas récupérable (409 + `user_id`) : le compte a bien été créé lors d'un
    essai précédent, mais la fiche employé a échoué ensuite. Sans ça, chaque
    nouvel essai bute sur « un compte existe déjà » ; le formulaire propose
    alors de créer la fiche pour ce compte."""
    user = User.objects.filter(email_hash=hash_email(email)).select_related('employee_profile').first()
    if user is None or user.account_deleted_at or not user.firebase_uid:
        return Response(
            {'detail': (
                "Un compte de connexion existe déjà pour cet email dans Firebase, mais il n'est "
                "rattaché à aucun utilisateur de la plateforme. Supprimez-le dans la console "
                "Firebase (Authentication), puis réessayez."
            )},
            status=status.HTTP_400_BAD_REQUEST,
        )
    name = f'{user.first_name} {user.last_name}'.strip() or email
    if hasattr(user, 'employee_profile'):
        return Response(
            {'detail': f"Cet email appartient déjà à l'employé {name}."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response(
        {
            'detail': f"Un compte utilisateur existe déjà pour cet email ({name}), sans fiche employé.",
            'user_id': str(user.pk),
        },
        status=status.HTTP_409_CONFLICT,
    )


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
        # (docs/backend-specifications.md §1.1/§1.2). Checked against the
        # whole list: cumulating SUPER_ADMIN with anything else is still
        # granting SUPER_ADMIN.
        if 'SUPER_ADMIN' in data['roles'] and not has_role(request.user, ROLE_SUPER_ADMIN):
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
            return _existing_account_response(data['email'])

        avatar_url = data.get('avatar_url') or None

        try:
            create_profile(firebase_user.uid, {
                'email': data['email'],
                'firstName': data['first_name'],
                'lastName': data['last_name'],
                'avatarUrl': avatar_url,
                'roles': data['roles'],
                'departmentId': str(department.id) if department else None,
            })

            django_user = User.objects.filter(email_hash=hash_email(data['email'])).first()
            if django_user:
                django_user.firebase_uid = firebase_user.uid
                django_user.department = department
                django_user.avatar_url = avatar_url
                # Re-provisionner une personne dont le compte avait été
                # supprimé lui rend un compte actif.
                django_user.account_deleted_at = None
                django_user.is_active = True
                django_user.save(update_fields=[
                    'firebase_uid', 'department', 'avatar_url', 'account_deleted_at', 'is_active',
                ])
            else:
                django_user = User.objects.create_user(
                    email=data['email'],
                    first_name=data['first_name'],
                    last_name=data['last_name'],
                )
                django_user.firebase_uid = firebase_user.uid
                django_user.department = department
                django_user.avatar_url = avatar_url
                django_user.save(update_fields=['firebase_uid', 'department', 'avatar_url'])
            _sync_django_roles(django_user, data['roles'])
        except Exception:
            # Roll back the Firebase account so a failed provisioning attempt
            # doesn't leave an orphaned Auth user with no profile/Django row.
            firebase_auth.delete_user(firebase_user.uid)
            raise

        # Notifications systématiques (décision du 10/09/2026) : toute
        # création de compte prévient le RH — Super-Admin en plus, par
        # e-mail, quand le rôle accordé est lui-même SUPER_ADMIN (action
        # très critique, voir docs/ROADMAP_TECHNIQUE.md).
        notify_roles(
            (ROLE_RH_MANAGER,),
            title='Nouveau compte créé',
            message=f"{data['first_name']} {data['last_name']} ({data['email']}) vient d'être provisionné(e).",
            notification_type='GENERAL',
            link='/admin/rh/utilisateurs',
            exclude=request.user,
        )
        if 'SUPER_ADMIN' in data['roles']:
            notify_roles(
                (ROLE_SUPER_ADMIN,),
                title='Rôle Super-Admin accordé',
                message=f"{data['first_name']} {data['last_name']} ({data['email']}) a été créé(e) avec le rôle Super-Admin.",
                notification_type='GENERAL',
                link='/admin/rh/utilisateurs',
                email=True,
                exclude=request.user,
            )

        # E-mail d'invitation dès que le compte existe (demande explicite) :
        # identifiants + bouton "Se connecter". Best-effort — la création du
        # compte reste acquise même si l'envoi échoue (comme les autres
        # accusés de réception e-mail de l'appli) ; un échec silencieux
        # laisserait juste le nouvel employé sans son mot de passe par mail,
        # donc on prévient RH si ça arrive.
        if not send_user_invitation_email(django_user, data['password']):
            notify_roles(
                (ROLE_RH_MANAGER,),
                title="E-mail d'invitation non envoyé",
                message=(
                    f"Le compte de {data['first_name']} {data['last_name']} est bien créé, "
                    f"mais l'e-mail d'invitation n'a pas pu partir vers {data['email']}. "
                    'Ses identifiants doivent lui être communiqués manuellement.'
                ),
                notification_type='GENERAL',
                link='/admin/rh/utilisateurs',
            )

        return Response(UserSerializer(django_user).data, status=status.HTTP_201_CREATED)


class SetUserPermissionsView(APIView):
    """Surcharge les permissions d'UN utilisateur précis
    (User.permission_overrides) — indépendamment des autres personnes
    ayant le même rôle. Même niveau de restriction que SetUserRoleView :
    modifier ce qu'une personne peut voir/faire est aussi sensible que
    modifier son rôle.

    Le GET existe à part de UserListView/UserBriefSerializer (qui sert
    aussi HR/Finance/Projects pour "choisir un utilisateur" — pas de raison
    d'y exposer les permissions de tout le monde) : seul celui qui a le
    droit d'écrire peut lire, restriction identique des deux côtés."""

    permission_classes = [IsSuperAdmin]

    @extend_schema(
        tags=['Administration & RH'],
        summary="Permissions surchargées d'un utilisateur",
        responses={200: SetUserPermissionsSerializer},
    )
    def get(self, request, pk):
        django_user = User.objects.filter(pk=pk).first()
        if not django_user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        return Response({'permissions': django_user.permission_overrides})

    @extend_schema(
        tags=['Administration & RH'],
        summary="Surcharge les permissions d'un utilisateur",
        request=SetUserPermissionsSerializer,
        responses={200: UserSerializer},
    )
    def patch(self, request, pk):
        django_user = User.objects.filter(pk=pk).first()
        if not django_user:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = SetUserPermissionsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        django_user.permission_overrides = serializer.validated_data['permissions']
        django_user.save(update_fields=['permission_overrides'])
        return Response(UserSerializer(django_user).data)


class SetUserPasswordView(APIView):
    """Définit/réinitialise le mot de passe Firebase Auth d'un utilisateur
    existant, pour n'importe qui — jusqu'ici, seule la console Firebase le
    permettait (aucun resetPassword/updatePassword n'existait dans
    l'application). Même restriction que SetUserRoleView : action très
    sensible, Super-Admin uniquement."""

    permission_classes = [IsSuperAdmin]

    @extend_schema(
        tags=['Administration & RH'],
        summary="Définit le mot de passe d'un utilisateur",
        request=SetUserPasswordSerializer,
        responses={200: None},
    )
    def post(self, request, pk):
        django_user = User.objects.filter(pk=pk).first()
        if not django_user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not django_user.firebase_uid:
            return Response(
                {'detail': "Cet utilisateur n'a pas encore de compte Firebase associé."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SetUserPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from firebase_admin import auth as firebase_auth
        try:
            firebase_auth.update_user(django_user.firebase_uid, password=serializer.validated_data['password'])
        except Exception:
            logger.exception('Changement de mot de passe Firebase impossible pour %s', django_user.firebase_uid)
            return Response(
                {'detail': 'Impossible de mettre à jour le mot de passe.'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # Action très critique (même convention que le reste du module) —
        # e-mail aux Super-Admins, pas à la personne elle-même (elle sait
        # déjà que son mot de passe vient d'être changé si c'est elle qui
        # l'a demandé ; sinon c'est justement ce que cette notification sert
        # à détecter).
        notify_roles(
            (ROLE_SUPER_ADMIN,),
            title='Mot de passe modifié',
            message=f'Le mot de passe de {django_user.first_name} {django_user.last_name} a été réinitialisé.',
            notification_type='GENERAL',
            link='/admin/rh/utilisateurs',
            email=True,
            exclude=request.user,
        )
        return Response(status=status.HTTP_200_OK)


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

        had_super_admin = has_role(django_user, ROLE_SUPER_ADMIN)

        update_profile_fields(django_user.firebase_uid, {
            'roles': data['roles'],
            'departmentId': str(department.id) if department else None,
        })
        invalidate_role_cache(django_user.firebase_uid)
        django_user.department = department
        django_user.save(update_fields=['department'])
        _sync_django_roles(django_user, data['roles'])

        # Attribution ou retrait du rôle Super-Admin : action très critique
        # (décision du 10/09/2026) — e-mail aux Super-Admins en plus du push.
        has_super_admin_now = 'SUPER_ADMIN' in data['roles']
        if has_super_admin_now != had_super_admin:
            verb = 'accordé' if has_super_admin_now else 'retiré'
            notify_roles(
                (ROLE_SUPER_ADMIN,),
                title=f'Rôle Super-Admin {verb}',
                message=f'Le rôle Super-Admin a été {verb} à {django_user.first_name} {django_user.last_name}.',
                notification_type='GENERAL',
                link='/admin/rh/utilisateurs',
                email=True,
                exclude=request.user,
            )

        return Response(UserSerializer(django_user).data)


class SetGerantView(APIView):
    """Désigne (ou retire) le gérant de l'entreprise — Super-Admin
    uniquement. Un seul gérant à la fois : en désigner un nouveau retire le
    titre au précédent, dans la même transaction. Tracé dans le journal
    d'audit et notifié aux Super-Admins (changement de droits de validation
    financière). Authentification obligatoire (401 sinon), compte actif et
    rôle Super-Admin (403 sinon) ; l'unicité est en plus garantie en base
    (contrainte single_gerant)."""

    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        tags=['Administration & RH'],
        summary='Designate or remove the company manager (Gérant)',
        responses={200: UserSerializer},
    )
    def post(self, request, pk):
        from django.db import transaction

        if not request.user.is_active:
            return Response(status=status.HTTP_403_FORBIDDEN)
        value = request.data.get('is_gerant')
        if not isinstance(value, bool):
            return Response({'detail': 'is_gerant (booléen) est requis.'}, status=status.HTTP_400_BAD_REQUEST)
        target = User.objects.filter(pk=pk).first()
        if not target:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if value and not target.is_active:
            return Response({'detail': 'Un compte désactivé ne peut pas être désigné gérant.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            previous = list(User.objects.select_for_update().filter(is_gerant=True).exclude(pk=target.pk))
            if value:
                User.objects.filter(pk__in=[u.pk for u in previous]).update(is_gerant=False)
            target.is_gerant = value
            target.save(update_fields=['is_gerant'])

        AuditLog.objects.log_action(
            request.user, 'GERANT_DESIGNE' if value else 'GERANT_RETIRE', 'User', target.pk,
            details={'previous': [str(u.pk) for u in previous] if value else []},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        name = f'{target.first_name} {target.last_name}'.strip() or target.email
        notify_roles(
            (ROLE_SUPER_ADMIN,),
            title='Gérant désigné' if value else 'Gérant retiré',
            message=f'{name} ' + ('est désormais le gérant.' if value else "n'est plus le gérant."),
            notification_type='GENERAL', link='/admin/rh/utilisateurs', email=True,
            exclude=request.user,
        )
        if value:
            notify(
                user=target, title='Vous êtes désigné gérant',
                message='Vous validez désormais les besoins, demandes d’achat et devis fournisseur au palier Gérant.',
                notification_type='GENERAL', link='/admin/technique/decaissements',
            )
        return Response(UserSerializer(target).data)


class DeactivateUserView(APIView):
    """Révoque l'accès plateforme d'un employé — Super-Admin only, comme
    SetUserRoleView. Pas de suppression Firebase/Django réelle (perdrait
    l'historique — audit log, décaissements approuvés, timesheets validés,
    tous rattachés à ce user_id) : désactivation des deux côtés à la place
    (`is_active=False` côté Django, `disabled=True` côté Firebase Auth),
    ce qui coupe la connexion sans casser les FK existantes."""

    permission_classes = [IsSuperAdmin]

    @extend_schema(
        tags=['Administration & RH'],
        summary="Deactivate an employee's platform access",
        responses={200: UserSerializer},
    )
    def post(self, request, pk):
        django_user = User.objects.filter(pk=pk).first()
        if not django_user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if django_user.pk == request.user.pk:
            return Response(
                {'detail': 'Vous ne pouvez pas désactiver votre propre compte.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if django_user.firebase_uid:
            from firebase_admin import auth as firebase_auth
            try:
                firebase_auth.update_user(django_user.firebase_uid, disabled=True)
            except Exception:
                logger.exception('Désactivation Firebase impossible pour %s', django_user.firebase_uid)

        django_user.is_active = False
        # Un compte désactivé ne garde pas le titre de gérant : le palier
        # retombe sur les Super-Admins (voir core.permissions.is_gerant).
        django_user.is_gerant = False
        django_user.save(update_fields=['is_active', 'is_gerant'])

        # Suppression d'un utilisateur = action très critique (décision du
        # 10/09/2026) — e-mail aux Super-Admins en plus du push.
        notify_roles(
            (ROLE_SUPER_ADMIN,),
            title='Utilisateur désactivé',
            message=f'{django_user.first_name} {django_user.last_name} ({django_user.email}) a été désactivé(e).',
            notification_type='GENERAL',
            link='/admin/rh/utilisateurs',
            email=True,
            exclude=request.user,
        )

        return Response(UserSerializer(django_user).data)


class DeleteUserAccountView(APIView):
    """Supprime le compte plateforme d'un utilisateur — Super-Admin only,
    comme DeactivateUserView. La fiche employé n'est PAS touchée : seul le
    compte (connexion Firebase, profil Firestore, rôles) disparaît, voir
    core.accounts.delete_platform_account."""

    permission_classes = [IsSuperAdmin]

    @extend_schema(
        tags=['Administration & RH'],
        summary="Delete a user's platform account (employee record kept)",
        responses={204: None},
    )
    def delete(self, request, pk):
        django_user = User.objects.filter(pk=pk, account_deleted_at__isnull=True).first()
        if not django_user:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if django_user.pk == request.user.pk:
            return Response(
                {'detail': 'Vous ne pouvez pas supprimer votre propre compte.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            delete_platform_account(django_user, actor=request.user, ip_address=request.META.get('REMOTE_ADDR'))
        except AccountDeletionError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        notify_roles(
            (ROLE_SUPER_ADMIN,),
            title='Compte utilisateur supprimé',
            message=f'Le compte de {django_user.first_name} {django_user.last_name} a été supprimé.',
            notification_type='GENERAL',
            link='/admin/rh/utilisateurs',
            email=True,
            exclude=request.user,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


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


@extend_schema_view(
    list=extend_schema(
        tags=['Administration & RH'],
        summary='List roles and their module/action permissions',
        description='Any authenticated user can read — the frontend uses this to know '
        "which nav items/pages its own role can see (see frontend/lib/admin/use-permissions.ts). "
        'Only Super-Admin can edit (partial_update). Note: this does NOT gate the actual '
        'API — that stays on has_role() by role name — so it stays possible for a role to '
        'declare more/less here than what the backend actually enforces; keep them in sync '
        'by hand when either changes.',
    ),
    retrieve=extend_schema(tags=['Administration & RH'], summary='Get a role'),
    partial_update=extend_schema(tags=['Administration & RH'], summary="Update a role's module/action permissions"),
)
class RoleViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    queryset = Role.objects.all().order_by('name')
    serializer_class = RoleSerializer

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return [IsSuperAdmin()]


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
            # L'entreprise d'abord, comme sur les cartes du tunnel — et un
            # lead issu d'un client créé directement n'a parfois pas de nom.
            person = f'{lead.first_name} {lead.last_name}'.strip()
            results.append({
                'category': 'Leads', 'label': lead.company_name or person,
                'sublabel': person if lead.company_name else '', 'href': '/admin/marketing/leads',
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


GLOBAL_DASHBOARD_CACHE_KEY = 'core:dashboard:v2'
# Same TTL as finance_dashboard (finance/views.py) — an aggregate spanning
# 5 apps is worth caching, and nothing here needs to-the-second freshness.
GLOBAL_DASHBOARD_CACHE_TTL = 300

WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
MONTH_LABELS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']
# Au-delà, les catégories de projet restantes sont regroupées sous « Autres »
# pour que l'anneau du tableau de bord reste lisible.
MAX_DASHBOARD_CATEGORIES = 6


def _shift_month(day, delta):
    """Premier jour du mois situé `delta` mois avant/après celui de `day`."""
    index = day.month - 1 + delta
    return day.replace(year=day.year + index // 12, month=index % 12 + 1, day=1)


def _counts_by_period(querysets, trunc, since):
    """Nombre d'enregistrements créés par période (jour ou mois), tous
    querysets confondus, depuis `since` (une date)."""
    totals = {}
    for qs in querysets:
        rows = (
            qs.filter(created_at__date__gte=since)
            .annotate(period=trunc('created_at'))
            .values('period')
            .annotate(n=Count('id'))
            .order_by()
        )
        for row in rows:
            period = row['period']
            if isinstance(period, datetime):
                period = period.date()
            totals[period] = totals.get(period, 0) + row['n']
    return totals


def _rate(part, whole):
    return round(part * 100 / whole, 1) if whole else None


@extend_schema(
    tags=['Général'],
    summary='Global cross-department dashboard (§4.1/4.2)',
    description="Authenticated — every role sees the exact same figures (no per-role "
    "filtering, unlike the department dashboards). One flat snapshot per "
    'department, not a detailed drill-down — that stays in each department\'s '
    'own dashboard.',
    responses={200: {'type': 'object'}},
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def global_dashboard(request):
    cached = cache.get(GLOBAL_DASHBOARD_CACHE_KEY)
    if cached is not None:
        return Response(cached)

    # Local imports, same reasoning as global_search above and
    # send_quote_and_invoice_reminders.py — avoids core importing every
    # other app's models at module load time.
    from django.db.models.functions import TruncDate, TruncMonth

    from hr.models import EmployeeProfile
    from marketing.models import Lead, Quote, SocialPost
    from finance.models import Account, DisbursementRequest, Invoice, TransactionLine
    from projects.models import Project, ProjectTask
    from support.models import SupportTicket

    today = timezone.now().date()
    month_start = today.replace(day=1)
    # Les 12 derniers mois, mois courant inclus — base des mini-courbes.
    months = [_shift_month(month_start, offset) for offset in range(-11, 1)]

    # RH
    active_employees = EmployeeProfile.objects.filter(status=EmployeeProfile.Status.ACTIF).count()
    new_hires_this_month = EmployeeProfile.objects.filter(hire_date__gte=month_start).count()

    # Marketing — same weighted-pipeline formula as marketing_dashboard
    # (marketing/views.py), just company-wide instead of role-scoped.
    active_lead_statuses = [Lead.Status.NOUVEAU, Lead.Status.QUALIFIE, Lead.Status.PROPOSITION_EN_COURS]
    active_leads = Lead.objects.filter(status__in=active_lead_statuses, estimated_value__isnull=False)
    weighted_pipeline = (active_leads.aggregate(
        total=Sum(F('estimated_value') * F('qualification_score'))
    )['total'] or Decimal('0')) / Decimal(100)
    total_leads = Lead.objects.count()
    social_posts_published_this_month = SocialPost.objects.filter(
        status=SocialPost.Status.PUBLIE, published_at__date__gte=month_start,
    ).count()

    # Finance — same accounting aggregates as finance_dashboard
    # (finance/views.py), duplicated in compact form rather than importing
    # that view (this endpoint is deliberately role-independent, that one
    # isn't).
    bank_totals = TransactionLine.objects.filter(account__code='512').aggregate(
        debit_total=Sum('debit'), credit_total=Sum('credit'),
    )
    cash_balance = (bank_totals['debit_total'] or Decimal('0')) - (bank_totals['credit_total'] or Decimal('0'))
    total_charges = TransactionLine.objects.filter(
        account__account_class=Account.AccountClass.CHARGE
    ).aggregate(total=Sum('debit'))['total'] or Decimal('0')
    total_produits = TransactionLine.objects.filter(
        account__account_class=Account.AccountClass.PRODUIT
    ).aggregate(total=Sum('credit'))['total'] or Decimal('0')

    # Technique
    active_projects = Project.objects.filter(status=Project.Status.EN_COURS).count()
    pending_disbursements = DisbursementRequest.objects.filter(status__in=DisbursementRequest.PENDING_STATUSES).count()

    # Support
    open_tickets = SupportTicket.objects.filter(
        status__in=[SupportTicket.Status.OUVERT, SupportTicket.Status.EN_COURS]
    ).count()
    ticket_resolution_rate = _rate(
        SupportTicket.objects.filter(status=SupportTicket.Status.FERME).count(),
        SupportTicket.objects.count(),
    )

    # Évolutions mensuelles (12 derniers mois)
    leads_by_month = _counts_by_period([Lead.objects.all()], TruncMonth, months[0])
    projects_by_month = _counts_by_period([Project.objects.all()], TruncMonth, months[0])

    # Solde bancaire en fin de chaque mois, reconstitué à rebours depuis le
    # solde actuel en retirant les flux des mois suivants.
    cash_flows = {
        row['period']: (row['debit'] or Decimal('0')) - (row['credit'] or Decimal('0'))
        for row in TransactionLine.objects.filter(account__code='512', entry__date__gte=months[0])
        .annotate(period=TruncMonth('entry__date'))
        .values('period')
        .annotate(debit=Sum('debit'), credit=Sum('credit'))
        .order_by()
    }
    month_end_balances = []
    running = cash_balance
    for month in reversed(months):
        month_end_balances.append(running)
        running -= cash_flows.get(month, Decimal('0'))
    month_end_balances.reverse()

    # Délai de livraison : projets terminés dont les deux dates sont connues.
    delivered = list(
        Project.objects.filter(
            status=Project.Status.TERMINE, start_date__isnull=False, end_date__isnull=False,
        ).values_list('start_date', 'end_date')
    )
    durations = [(end - start).days for start, end in delivered if end >= start]
    avg_delivery_days = round(sum(durations) / len(durations), 1) if durations else None
    delivery_by_month = {}
    for start, end in delivered:
        if end >= start and end >= months[0]:
            delivery_by_month.setdefault(end.replace(day=1), []).append((end - start).days)

    closed_projects = Project.objects.filter(status__in=[Project.Status.TERMINE, Project.Status.ANNULE])
    delivery_rate = _rate(
        closed_projects.filter(status=Project.Status.TERMINE).count(), closed_projects.count(),
    )

    # Devis et tâches — anneau « objectifs ».
    quote_counts = dict(Quote.objects.values_list('status').annotate(n=Count('id')).order_by())
    task_counts = dict(ProjectTask.objects.values_list('status').annotate(n=Count('id')).order_by())

    # Activité opérationnelle : volume d'éléments métier créés (demandes,
    # devis, projets, tâches, factures, tickets, besoins).
    activity_sources = [
        Lead.objects.all(), Quote.objects.all(), Project.objects.all(), ProjectTask.objects.all(),
        Invoice.objects.all(), SupportTicket.objects.all(), DisbursementRequest.objects.all(),
    ]
    week_start = today - timedelta(days=today.weekday())
    previous_week_start = week_start - timedelta(days=7)
    daily_activity = _counts_by_period(activity_sources, TruncDate, previous_week_start)
    monthly_activity = _counts_by_period(activity_sources, TruncMonth, date(today.year - 1, 1, 1))

    # Répartition des projets par catégorie (pôle d'expertise).
    categories = {}
    for row in (
        Project.objects.exclude(status=Project.Status.ANNULE)
        .values('category')
        .annotate(count=Count('id'), budget=Sum('budget'))
        .order_by()
    ):
        name = (row['category'] or '').strip() or 'Non catégorisé'
        entry = categories.setdefault(name, {'name': name, 'count': 0, 'budget': Decimal('0')})
        entry['count'] += row['count']
        entry['budget'] += row['budget'] or Decimal('0')
    ranked = sorted(categories.values(), key=lambda c: c['count'], reverse=True)
    if len(ranked) > MAX_DASHBOARD_CATEGORIES:
        rest = ranked[MAX_DASHBOARD_CATEGORIES - 1:]
        ranked = ranked[:MAX_DASHBOARD_CATEGORIES - 1] + [{
            'name': 'Autres',
            'count': sum(c['count'] for c in rest),
            'budget': sum((c['budget'] for c in rest), Decimal('0')),
        }]

    payload = {
        'active_employees': active_employees,
        'new_hires_this_month': new_hires_this_month,
        'weighted_pipeline': str(weighted_pipeline.quantize(Decimal('0.01'))),
        'total_leads': total_leads,
        'social_posts_published_this_month': social_posts_published_this_month,
        'cash_balance': str(cash_balance),
        'gross_result': str(total_produits - total_charges),
        'active_projects': active_projects,
        'pending_disbursements': pending_disbursements,
        'open_tickets': open_tickets,
        'ticket_resolution_rate': ticket_resolution_rate,
        'leads_this_month': leads_by_month.get(month_start, 0),
        'leads_previous_month': leads_by_month.get(months[-2], 0),
        'projects_created_this_month': projects_by_month.get(month_start, 0),
        'cash_balance_previous_month_end': str(month_end_balances[-2]),
        'avg_delivery_days': avg_delivery_days,
        'delivered_projects': len(durations),
        'delivery_rate': delivery_rate,
        'quotes': {
            'signed': quote_counts.get(Quote.Status.ACCEPTE, 0),
            'pending': quote_counts.get(Quote.Status.ENVOYE, 0) + quote_counts.get(Quote.Status.BROUILLON, 0),
            'refused': quote_counts.get(Quote.Status.REFUSE, 0),
        },
        'tasks': {
            'done': task_counts.get(ProjectTask.Status.TERMINE, 0),
            'pending': sum(n for s, n in task_counts.items() if s != ProjectTask.Status.TERMINE),
        },
        'trends': {
            'months': [m.strftime('%Y-%m') for m in months],
            'leads': [leads_by_month.get(m, 0) for m in months],
            'projects_created': [projects_by_month.get(m, 0) for m in months],
            'cash_balance': [str(b) for b in month_end_balances],
            'avg_delivery_days': [
                round(sum(d) / len(d), 1) if (d := delivery_by_month.get(m)) else None for m in months
            ],
        },
        'activity_weekly': [
            {
                'label': WEEKDAY_LABELS[i],
                'current': daily_activity.get(week_start + timedelta(days=i), 0),
                'previous': daily_activity.get(previous_week_start + timedelta(days=i), 0),
            }
            for i in range(7)
        ],
        'activity_monthly': [
            {
                'label': MONTH_LABELS[m - 1],
                'current': monthly_activity.get(date(today.year, m, 1), 0),
                'previous': monthly_activity.get(date(today.year - 1, m, 1), 0),
            }
            for m in range(1, 13)
        ],
        'project_categories': [
            {'name': c['name'], 'count': c['count'], 'budget': str(c['budget'])} for c in ranked
        ],
    }
    cache.set(GLOBAL_DASHBOARD_CACHE_KEY, payload, GLOBAL_DASHBOARD_CACHE_TTL)
    return Response(payload)


class PushDeviceView(APIView):
    """Enregistre ou retire l'appareil courant des destinataires push.

    POST — idempotent : le même jeton renvoyé au prochain démarrage met à jour
    `last_seen_at` au lieu de créer un doublon. Firebase peut réattribuer un
    jeton d'un compte à un autre sur un appareil partagé, d'où la mise à jour
    du propriétaire plutôt qu'un simple `get_or_create`.

    DELETE — quand l'utilisateur retire l'autorisation. Sans cela, son ancien
    appareil continuerait de recevoir des notifications le concernant.
    """

    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = (request.data.get('token') or '').strip()
        if not token:
            return Response({'token': 'Jeton requis.'}, status=status.HTTP_400_BAD_REQUEST)
        if len(token) > 512:
            return Response({'token': 'Jeton trop long.'}, status=status.HTTP_400_BAD_REQUEST)

        platform = request.data.get('platform') or PushDevice.Platform.WEB
        if platform not in PushDevice.Platform.values:
            platform = PushDevice.Platform.WEB

        PushDevice.objects.update_or_create(
            token=token,
            defaults={
                'user': request.user,
                'platform': platform,
                'label': (request.data.get('label') or '')[:255],
                'last_seen_at': timezone.now(),
            },
        )
        return Response(status=status.HTTP_204_NO_CONTENT)

    def delete(self, request):
        token = (request.data.get('token') or '').strip()
        if not token:
            return Response({'token': 'Jeton requis.'}, status=status.HTTP_400_BAD_REQUEST)
        # Restreint à l'utilisateur courant : sans ce filtre, connaître un
        # jeton suffirait à couper les notifications de quelqu'un d'autre.
        PushDevice.objects.filter(token=token, user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TestNotificationView(APIView):
    """S'envoyer une notification de test sur les trois canaux (cloche,
    push, e-mail) et savoir lesquels sont partis — pour vérifier sa propre
    configuration sans attendre un vrai événement."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        from django.conf import settings

        from core import firestore_client, mailer, push

        user = request.user
        title = 'Notification de test'
        message = 'Si vous lisez ceci, ce canal de notification fonctionne.'

        in_app = False
        if user.firebase_uid:
            firestore_client.create_notification(user.firebase_uid, title, message, 'GENERAL', '/admin')
            in_app = True
        devices = PushDevice.objects.filter(user=user).count()
        pushed = push.send_to_user(user, title, message, link='/admin') if devices else 0
        email_sent = mailer.send_mail(
            user.email, title, message, action_url=f'{settings.PUBLIC_SITE_URL}/admin', action_label='Ouvrir la plateforme',
        ) if user.email else False

        return Response({
            'in_app': in_app,
            'push_devices': devices,
            'push_sent': pushed,
            'email': email_sent,
            'email_backend': settings.EMAIL_BACKEND.rsplit('.', 1)[-1],
        })
