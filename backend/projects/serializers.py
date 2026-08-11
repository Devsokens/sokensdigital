from rest_framework import serializers

from core.models import User
from projects.models import Project, ProjectMember, ProjectTask, ProjectTaskComment, Timesheet


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


class ProjectTaskCommentSerializer(serializers.ModelSerializer):
    author = ProjectUserBriefSerializer(read_only=True)

    class Meta:
        model = ProjectTaskComment
        fields = ['id', 'body', 'author', 'created_at']


class ProjectTaskSerializer(serializers.ModelSerializer):
    assignees = ProjectUserBriefSerializer(many=True, read_only=True)
    assignee_ids = serializers.PrimaryKeyRelatedField(
        source='assignees', queryset=User.objects.all(), many=True, write_only=True, required=False,
    )
    comments_count = serializers.IntegerField(source='comments.count', read_only=True)

    class Meta:
        model = ProjectTask
        fields = [
            'id', 'title', 'status', 'due_date', 'progress',
            'assignees', 'assignee_ids', 'comments_count', 'created_at', 'updated_at',
        ]

    def validate_progress(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError("La progression doit être comprise entre 0 et 100.")
        return value


class ProjectSerializer(serializers.ModelSerializer):
    lead_project_manager = ProjectUserBriefSerializer(read_only=True)
    lead_project_manager_id = serializers.PrimaryKeyRelatedField(
        source='lead_project_manager', queryset=User.objects.all(),
        write_only=True, required=False, allow_null=True,
    )
    members = ProjectMemberSerializer(source='memberships', many=True, read_only=True)
    is_pinned = serializers.SerializerMethodField()
    tasks_total = serializers.SerializerMethodField()
    tasks_done = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'status', 'priority', 'category',
            'lead_project_manager', 'lead_project_manager_id',
            'members', 'start_date', 'end_date', 'budget', 'created_at',
            'is_archived', 'is_locked', 'is_pinned', 'tasks_total', 'tasks_done',
        ]

    def get_is_pinned(self, obj):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        if not user or not user.is_authenticated:
            return False
        # obj.pinned_by / obj.tasks are prefetched by the viewset — iterating
        # the cached .all() avoids an extra query per row when listing.
        return any(u.id == user.id for u in obj.pinned_by.all())

    def get_tasks_total(self, obj):
        return len(obj.tasks.all())

    def get_tasks_done(self, obj):
        return sum(1 for t in obj.tasks.all() if t.status == ProjectTask.Status.DONE)

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError(
                {'end_date': 'La date de fin ne peut pas précéder la date de début.'}
            )
        return attrs


class TimesheetSerializer(serializers.ModelSerializer):
    user = ProjectUserBriefSerializer(read_only=True)

    class Meta:
        model = Timesheet
        fields = ['id', 'project', 'user', 'date', 'hours', 'description', 'status', 'created_at']
        read_only_fields = ['project', 'user', 'status']

    def validate_hours(self, value):
        if not (0 < value <= 24):
            raise serializers.ValidationError("Le nombre d'heures doit être compris entre 0 et 24.")
        return value
