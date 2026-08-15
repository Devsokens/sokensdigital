from rest_framework import serializers

from core.constants import (
    ROLE_COMMERCIAL, ROLE_COMPTABLE, ROLE_DEVELOPER, ROLE_DIRECTEUR_FINANCIER,
    ROLE_PROJECT_MANAGER, ROLE_RESPONSABLE_MARKETING, ROLE_RH_MANAGER, ROLE_SUPER_ADMIN,
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
        fields = ['id', 'first_name', 'last_name', 'email', 'avatar_url', 'department_name']


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
            'department',
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


APP_ROLE_CHOICES = [
    'SUPER_ADMIN', 'RESPONSABLE_MARKETING', 'RESPONSABLE_RH', 'COMMERCIAL',
    'CHEF_DE_PROJET', 'DEVELOPPEUR', 'COMPTABLE', 'DIRECTEUR_FINANCIER', 'AUTRE',
]

# Maps the SNAKE_CASE role stored in the Firestore profile (APP_ROLE_CHOICES
# above — legacy naming from before the RBAC migration) to the French Role
# name actually checked by core.permissions.has_role() on the Django side.
# 'AUTRE' has no Django-side equivalent — an employee with that value gets
# no elevated permissions, same as before this mapping existed.
APP_ROLE_TO_DJANGO_ROLE = {
    'SUPER_ADMIN': ROLE_SUPER_ADMIN,
    'RESPONSABLE_MARKETING': ROLE_RESPONSABLE_MARKETING,
    'RESPONSABLE_RH': ROLE_RH_MANAGER,
    'COMMERCIAL': ROLE_COMMERCIAL,
    'CHEF_DE_PROJET': ROLE_PROJECT_MANAGER,
    'DEVELOPPEUR': ROLE_DEVELOPER,
    'COMPTABLE': ROLE_COMPTABLE,
    'DIRECTEUR_FINANCIER': ROLE_DIRECTEUR_FINANCIER,
}


class ProvisionUserSerializer(serializers.Serializer):
    """Input for core.views.ProvisionUserView — creates a Firebase Auth
    account + Firestore profile + Django User row in one call. Not a
    ModelSerializer: no single model backs "platform access"."""

    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=255)
    last_name = serializers.CharField(max_length=255)
    avatar_url = serializers.URLField(required=False, allow_null=True, allow_blank=True)
    role = serializers.ChoiceField(choices=APP_ROLE_CHOICES)
    department_id = serializers.PrimaryKeyRelatedField(
        source='department', queryset=Department.objects.all(), required=False, allow_null=True,
    )


class SetUserRoleSerializer(serializers.Serializer):
    """Input for core.views.SetUserRoleView — changes an *existing* user's
    role/department. Super-Admin only (docs/backend-specifications.md §1.1)."""

    role = serializers.ChoiceField(choices=APP_ROLE_CHOICES)
    department_id = serializers.PrimaryKeyRelatedField(
        source='department', queryset=Department.objects.all(), required=False, allow_null=True,
    )


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
