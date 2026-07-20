from rest_framework import serializers

from core.models import AuditLog, Department, User


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'color']


class UserBriefSerializer(serializers.ModelSerializer):
    """Minimal shape for picking a user elsewhere (HR/Finance/Projects) —
    no encrypted fields beyond email, no department/timestamps."""

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'email']


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


class ProvisionUserSerializer(serializers.Serializer):
    """Input for core.views.ProvisionUserView — creates a Firebase Auth
    account + Firestore profile + Django User row in one call. Not a
    ModelSerializer: no single model backs "platform access"."""

    email = serializers.EmailField()
    password = serializers.CharField(min_length=8, write_only=True)
    first_name = serializers.CharField(max_length=255)
    last_name = serializers.CharField(max_length=255)
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
