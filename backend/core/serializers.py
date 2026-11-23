from rest_framework import serializers

from core.constants import (
    ROLE_CAISSIER,
    ROLE_COMMERCIAL,
    ROLE_COMPTABLE,
    ROLE_DEVELOPER,
    ROLE_PROJECT_MANAGER,
    ROLE_RESPONSABLE_MARKETING_COM,
    ROLE_RESPONSABLE_ADMINISTRATIF,
    ROLE_SUPER_ADMIN,
    ROLE_RESPONSABLE_OPERATIONS,
    ROLE_RESPONSABLE_TECHNIQUE,
    ROLE_SOUS_TRAITANT_DEV,
    ROLE_SOUS_TRAITANT_COMMERCIAL,
    ROLE_SOUS_TRAITANT_DESIGNER,
    FUNCTIONAL_ROLES,
    MAX_FUNCTIONAL_ROLES,
)
from core.models import AuditLog, Department, Role, User


MEMBER_PREVIEW_LIMIT = 4


class DepartmentSerializer(serializers.ModelSerializer):
    """member_count/members power the avatar-stack card on the
    Départements screen (RH) — members is capped at MEMBER_PREVIEW_LIMIT,
    the frontend renders "+N" for the rest using member_count."""

    member_count = serializers.SerializerMethodField()
    members = serializers.SerializerMethodField()

    class Meta:
        model = Department
        fields = ['id', 'name', 'description', 'color', 'member_count', 'members']

    def get_member_count(self, obj):
        return obj.user_set.count()

    def get_members(self, obj):
        members = obj.user_set.order_by('first_name', 'last_name')[:MEMBER_PREVIEW_LIMIT]
        return UserBriefSerializer(members, many=True).data


class DepartmentDetailSerializer(DepartmentSerializer):
    """Same shape as DepartmentSerializer, but `members` is the full roster
    (no MEMBER_PREVIEW_LIMIT cap) — used on the department detail screen,
    which needs every member for the member-click side panel, not just an
    avatar-stack preview."""

    def get_members(self, obj):
        members = obj.user_set.order_by('first_name', 'last_name')
        return UserBriefSerializer(members, many=True).data


class UserBriefSerializer(serializers.ModelSerializer):
    """Minimal shape for picking a user elsewhere (HR/Finance/Projects) —
    no encrypted fields beyond email, no full department object/timestamps.
    department_name (just the string) is the one exception — needed to
    group employees by department client-side (org chart) without a
    second round-trip."""

    department_name = serializers.CharField(source='department.name', read_only=True, default=None)

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'department_name', 'is_gerant', 'is_rcf']
        read_only_fields = ['is_gerant', 'is_rcf']

    def to_representation(self, instance):
        data = super().to_representation(instance)
        # La désignation du gérant n'est visible que des Super-Admins.
        request = self.context.get('request')
        from core.constants import ROLE_SUPER_ADMIN
        from core.permissions import has_role
        if not (request and has_role(request.user, ROLE_SUPER_ADMIN)):
            data.pop('is_gerant', None)
            data.pop('is_rcf', None)
        return data


class UserSerializer(serializers.ModelSerializer):
    """Full profile of the authenticated user — read side of /auth/me/.

    Note: application role isn't included here — it lives in the Firestore
    profile doc (profiles/{uid}.role), not on this Django model. The
    frontend reads it from Firestore directly (see lib/auth/auth-context.tsx).
    """

    department = DepartmentSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'first_name',
            'last_name',
            'phone',
            'avatar_url',
            'is_active',
            'is_staff',
            'mfa_enabled',
            'is_gerant',
            'is_rcf',
            'department',
            'permission_overrides',
            'created_at',
            'updated_at',
            'last_login',
        ]
        read_only_fields = fields


class MeUpdateSerializer(serializers.ModelSerializer):
    """Write side of /auth/me/ — only the fields a user may self-edit."""

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'avatar_url']


# Nom applicatif (SNAKE_CASE, stocké dans le profil Firestore et utilisé
# par le front) -> nom du rôle Django vérifié par core.permissions.has_role().
APP_ROLE_TO_DJANGO_ROLE = {
    'SUPER_ADMIN': ROLE_SUPER_ADMIN,
    'RESPONSABLE_OPERATIONS': ROLE_RESPONSABLE_OPERATIONS,
    'RESPONSABLE_TECHNIQUE': ROLE_RESPONSABLE_TECHNIQUE,
    'RESPONSABLE_MARKETING_COM': ROLE_RESPONSABLE_MARKETING_COM,
    'RESPONSABLE_ADMINISTRATIF': ROLE_RESPONSABLE_ADMINISTRATIF,
    'CHEF_DE_PROJET': ROLE_PROJECT_MANAGER,
    'DEVELOPPEUR': ROLE_DEVELOPER,
    'COMMERCIAL': ROLE_COMMERCIAL,
    'COMPTABLE': ROLE_COMPTABLE,
    'CAISSIER': ROLE_CAISSIER,
    'SOUS_TRAITANT_DEV': ROLE_SOUS_TRAITANT_DEV,
    'SOUS_TRAITANT_COMMERCIAL': ROLE_SOUS_TRAITANT_COMMERCIAL,
    'SOUS_TRAITANT_DESIGNER': ROLE_SOUS_TRAITANT_DESIGNER,
}
APP_ROLE_CHOICES = list(APP_ROLE_TO_DJANGO_ROLE)

# Anciens noms applicatifs (profils Firestore d'avant le référentiel) ->
# nouveau nom ; 'AUTRE' n'a pas d'équivalent et est simplement retiré.
LEGACY_APP_ROLE_MAPPING = {
    'RESPONSABLE_MARKETING': 'RESPONSABLE_MARKETING_COM',
    'RESPONSABLE_RH': 'RESPONSABLE_ADMINISTRATIF',
    'ADMINISTRATEUR': 'RESPONSABLE_ADMINISTRATIF',
    'DIRECTEUR_FINANCIER': 'COMPTABLE',
    'SUPPORT_CLIENT': 'RESPONSABLE_TECHNIQUE',
    'CONSULTANT': 'RESPONSABLE_TECHNIQUE',
}


def normalize_app_roles(roles) -> list[str]:
    """Reclasse d'anciens noms, retire les inconnus et les doublons, puis
    applique le plafond : Super-Admin + 2 rôles fonctionnels au plus (les
    plus élevés, selon l'ordre de FUNCTIONAL_ROLES)."""
    priority = {app: i for i, app in enumerate(
        app for django_name in FUNCTIONAL_ROLES
        for app, mapped in APP_ROLE_TO_DJANGO_ROLE.items() if mapped == django_name
    )}
    seen = []
    for role in roles or []:
        role = LEGACY_APP_ROLE_MAPPING.get(role, role)
        if role in APP_ROLE_TO_DJANGO_ROLE and role not in seen:
            seen.append(role)
    functional = sorted((r for r in seen if r != 'SUPER_ADMIN'), key=lambda r: priority.get(r, 99))
    return (['SUPER_ADMIN'] if 'SUPER_ADMIN' in seen else []) + functional[:MAX_FUNCTIONAL_ROLES]


def validate_role_set(roles):
    """Plafond de cumul : 2 rôles fonctionnels au plus, le privilège
    Super-Admin en plus ; pas de doublon."""
    if len(set(roles)) != len(roles):
        raise serializers.ValidationError('Un même rôle est sélectionné plusieurs fois.')
    functional = [r for r in roles if r != 'SUPER_ADMIN']
    if len(functional) > MAX_FUNCTIONAL_ROLES:
        raise serializers.ValidationError(
            f'Au plus {MAX_FUNCTIONAL_ROLES} rôles fonctionnels par utilisateur '
            '(le privilège Super-Administrateur ne compte pas dans ce plafond).'
        )
    if not functional and 'SUPER_ADMIN' not in roles:
        raise serializers.ValidationError('Au moins un rôle est requis.')
    return roles


class ProvisionUserSerializer(serializers.Serializer):
    """Input for core.views.ProvisionUserView — creates a Firebase Auth
    account + Firestore profile + Django User row in one call. Not a
    ModelSerializer: no single model backs "platform access".

    `roles` is a list, not a single choice (décision du 10/09/2026) — un
    employé peut cumuler plusieurs rôles applicatifs dès sa création
    (ex: Comptable + Caissier). Au moins un rôle est requis."""

    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=255)
    last_name = serializers.CharField(max_length=255)
    avatar_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=APP_ROLE_CHOICES), allow_empty=False,
    )
    department_id = serializers.PrimaryKeyRelatedField(
        source='department', queryset=Department.objects.all(), required=False, allow_null=True,
    )

    def validate_roles(self, value):
        return validate_role_set(value)


class SetUserPermissionsSerializer(serializers.Serializer):
    """Input for core.views.SetUserPermissionsView — surcharge les
    permissions d'UNE personne (User.permission_overrides), indépendamment
    des autres personnes ayant le même rôle. Même forme que Role.permissions."""

    permissions = serializers.DictField(child=serializers.ListField(child=serializers.CharField()))


class SetUserPasswordSerializer(serializers.Serializer):
    """Input for core.views.SetUserPasswordView — définit/réinitialise le
    mot de passe Firebase Auth d'un utilisateur existant, pour n'importe qui
    (demande explicite : un Super-Admin doit pouvoir le faire sans passer
    par la console Firebase)."""

    password = serializers.CharField(min_length=8, write_only=True)


class SetUserRoleSerializer(serializers.Serializer):
    """Input for core.views.SetUserRoleView — changes an *existing* user's
    roles/department. Super-Admin only (docs/backend-specifications.md §1.1).

    `roles` (plural) replaces the whole set, same idempotent-replace
    semantics as before — just no longer capped at one value."""

    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=APP_ROLE_CHOICES), allow_empty=False,
    )
    department_id = serializers.PrimaryKeyRelatedField(
        source='department', queryset=Department.objects.all(), required=False, allow_null=True,
    )

    def validate_roles(self, value):
        return validate_role_set(value)


class AuditLogSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)

    class Meta:
        model = AuditLog
        fields = ['id', 'user', 'action', 'entity_type', 'entity_id', 'details', 'ip_address', 'created_at']
        read_only_fields = fields


class RoleSerializer(serializers.ModelSerializer):
    """Powers the module/action permission editor on Utilisateurs & Rôles.
    name/description are read-only — the set of role names is fixed
    (APP_ROLE_TO_DJANGO_ROLE above), only `permissions` is editable here."""

    class Meta:
        model = Role
        fields = ['id', 'name', 'description', 'permissions']
        read_only_fields = ['id', 'name', 'description']

    def validate_permissions(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError('permissions doit être un objet JSON.')
        for module_key, actions in value.items():
            if not isinstance(actions, list) or not all(isinstance(a, str) for a in actions):
                raise serializers.ValidationError(f'permissions["{module_key}"] doit être une liste de chaînes.')
        return value
