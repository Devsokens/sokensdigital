from rest_framework import serializers

from core.models import User
from projects.models import Project, ProjectMember


class ProjectUserBriefSerializer(serializers.ModelSerializer):
    """Minimal user shape for nesting inside project resources — avoids
    leaking encrypted/sensitive fields that core.UserSerializer exposes.
    Named distinctly from core/hr's UserBriefSerializer (different field
    set) so drf-spectacular doesn't collide them into one schema component."""

    class Meta:
        model = User
        fields = ['id', 'first_name', 'last_name', 'avatar_url']


class ProjectMemberSerializer(serializers.ModelSerializer):
    user = ProjectUserBriefSerializer(read_only=True)
    user_id = serializers.PrimaryKeyRelatedField(
        source='user', queryset=User.objects.all(), write_only=True
    )

    class Meta:
        model = ProjectMember
        fields = ['id', 'user', 'user_id', 'created_at']


class ProjectSerializer(serializers.ModelSerializer):
    lead_project_manager = ProjectUserBriefSerializer(read_only=True)
    lead_project_manager_id = serializers.PrimaryKeyRelatedField(
        source='lead_project_manager', queryset=User.objects.all(),
        write_only=True, required=False, allow_null=True,
    )
    members = ProjectMemberSerializer(source='memberships', many=True, read_only=True)

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'status',
            'lead_project_manager', 'lead_project_manager_id',
            'members', 'start_date', 'end_date', 'budget', 'created_at',
        ]

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError(
                {'end_date': 'La date de fin ne peut pas précéder la date de début.'}
            )
        return attrs
