from rest_framework import serializers

from core.models import Department, Role, User


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ['id', 'name', 'description']


class DepartmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Department
        fields = ['id', 'name', 'color']


class UserSerializer(serializers.ModelSerializer):
    """Full profile of the authenticated user — read side of /auth/me/."""

    roles = RoleSerializer(many=True, read_only=True)
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
            'roles',
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
