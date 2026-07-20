from rest_framework import serializers

from core.models import Department, User


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
