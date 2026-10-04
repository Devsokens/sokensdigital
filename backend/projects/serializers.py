from rest_framework import serializers

from administration.models import Client
from core.models import User
from core.sanitize import sanitize_html
from core.storage import sign_private_path
from projects.models import (
    Project, ProjectDocument, ProjectMember, ProjectTask, ProjectTaskComment, ProjectSubtask,
    Epic, Label, Sprint, Timesheet,
)


class ProjectClientBriefSerializer(serializers.ModelSerializer):
    """Juste de quoi afficher/choisir un client depuis un projet — pas le
    reste de la fiche (siret, notes...), pas la préoccupation de ce module."""

    class Meta:
        model = Client
        fields = ['id', 'company_name']


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
    attachment_url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectTaskComment
        fields = ['id', 'body', 'author', 'attachment_url', 'attachment_name', 'created_at']
        read_only_fields = ['attachment_name']

    def get_attachment_url(self, obj):
        return sign_private_path(obj.attachment_path) if obj.attachment_path else None


class EpicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Epic
        fields = ['id', 'title', 'color', 'start_date', 'end_date', 'created_at']
        read_only_fields = ['created_at']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'La date de fin ne peut pas précéder la date de début.'})
        return attrs


class LabelSerializer(serializers.ModelSerializer):
    class Meta:
        model = Label
        fields = ['id', 'name', 'color']


class SprintSerializer(serializers.ModelSerializer):
    class Meta:
        model = Sprint
        fields = ['id', 'name', 'start_date', 'end_date']

    def validate(self, attrs):
        start = attrs.get('start_date', getattr(self.instance, 'start_date', None))
        end = attrs.get('end_date', getattr(self.instance, 'end_date', None))
        if start and end and end < start:
            raise serializers.ValidationError({'end_date': 'La date de fin ne peut pas précéder la date de début.'})
        return attrs


class ProjectSubtaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectSubtask
        fields = ['id', 'title', 'is_done', 'order']


class ProjectTaskSerializer(serializers.ModelSerializer):
    assignees = ProjectUserBriefSerializer(many=True, read_only=True)
    assignee_ids = serializers.PrimaryKeyRelatedField(
        source='assignees', queryset=User.objects.all(), many=True, write_only=True, required=False,
    )
    comments_count = serializers.IntegerField(source='comments.count', read_only=True)
    labels = LabelSerializer(many=True, read_only=True)
    label_ids = serializers.PrimaryKeyRelatedField(
        source='labels', queryset=Label.objects.all(), many=True, write_only=True, required=False,
    )
    subtasks = ProjectSubtaskSerializer(many=True, read_only=True)

    class Meta:
        model = ProjectTask
        fields = [
            'id', 'title', 'description', 'status', 'priority', 'due_date', 'progress',
            'assignees', 'assignee_ids', 'epic', 'sprint', 'labels', 'label_ids', 'subtasks',
            'comments_count', 'created_at', 'updated_at',
        ]

    def validate_progress(self, value):
        if not (0 <= value <= 100):
            raise serializers.ValidationError("La progression doit être comprise entre 0 et 100.")
        return value

    def validate_label_ids(self, labels):
        project = self.context.get('project') or getattr(self.instance, 'project', None)
        if project and any(label.project_id != project.id for label in labels):
            raise serializers.ValidationError("Une étiquette n'appartient pas à ce projet.")
        return labels

    def validate_epic(self, epic):
        project = self.context.get('project') or getattr(self.instance, 'project', None)
        if epic and project and epic.project_id != project.id:
            raise serializers.ValidationError("Cette phase n'appartient pas à ce projet.")
        return epic

    def validate_sprint(self, sprint):
        project = self.context.get('project') or getattr(self.instance, 'project', None)
        if sprint and project and sprint.project_id != project.id:
            raise serializers.ValidationError("Ce sprint n'appartient pas à ce projet.")
        return sprint


class ProjectDocumentSerializer(serializers.ModelSerializer):
    uploaded_by = ProjectUserBriefSerializer(read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectDocument
        fields = ['id', 'original_filename', 'uploaded_by', 'url', 'created_at']

    def get_url(self, obj):
        # Signée à chaque lecture plutôt que stockée : voir
        # ProjectDocument.storage_path.
        return sign_private_path(obj.storage_path)


class ProjectSerializer(serializers.ModelSerializer):
    lead_project_manager = ProjectUserBriefSerializer(read_only=True)
    lead_project_manager_id = serializers.PrimaryKeyRelatedField(
        source='lead_project_manager', queryset=User.objects.all(),
        write_only=True, required=False, allow_null=True,
    )
    client = ProjectClientBriefSerializer(read_only=True)
    client_id = serializers.PrimaryKeyRelatedField(
        source='client', queryset=Client.objects.all(),
        write_only=True, required=False, allow_null=True,
    )
    members = ProjectMemberSerializer(source='memberships', many=True, read_only=True)
    documents = ProjectDocumentSerializer(many=True, read_only=True)
    is_pinned = serializers.SerializerMethodField()
    tasks_total = serializers.SerializerMethodField()
    tasks_done = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = [
            'id', 'name', 'description', 'cover_image_url', 'status', 'priority', 'category',
            'lead_project_manager', 'lead_project_manager_id', 'client', 'client_id',
            'members', 'documents', 'start_date', 'end_date', 'budget', 'created_at',
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
        return sum(1 for t in obj.tasks.all() if t.status == ProjectTask.Status.TERMINE)

    def validate_description(self, value):
        # Défense contre XSS stockée : le HTML produit par l'éditeur Tiptap
        # admin est rendu tel quel côté détail projet
        # (dangerouslySetInnerHTML) — même raisonnement que
        # BlogPostSerializer.validate_content, la restriction de l'éditeur
        # n'étant pas une frontière de sécurité.
        return sanitize_html(value)

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
    task_id = serializers.PrimaryKeyRelatedField(
        source='task', queryset=ProjectTask.objects.all(), write_only=True, required=False, allow_null=True,
    )
    task_title = serializers.CharField(source='task.title', read_only=True, default=None)
    project_name = serializers.CharField(source='project.name', read_only=True)

    class Meta:
        model = Timesheet
        fields = [
            'id', 'project', 'project_name', 'task_id', 'task_title', 'user',
            'date', 'hours', 'description', 'status', 'created_at',
        ]
        read_only_fields = ['project', 'user', 'status']

    def validate_hours(self, value):
        if not (0 < value <= 24):
            raise serializers.ValidationError("Le nombre d'heures doit être compris entre 0 et 24.")
        return value

    def validate_task_id(self, task):
        project = self.context.get('project') or getattr(self.instance, 'project', None)
        if task and project and task.project_id != project.id:
            raise serializers.ValidationError("Cette tâche n'appartient pas à ce projet.")
        return task
