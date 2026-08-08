from rest_framework import serializers
from .models import Project, ProjectPhase, ProjectDocument, Task, TimeEntry, Ticket, KnowledgeBase
from core.models import User
from core.constants import ROLE_DEVELOPER, MANAGEMENT_ROLES
from administration.models import Client
from django.db.models import Sum
from django.utils import timezone

class UserMinimalSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name']
        read_only_fields = fields

def _is_dev_only(context):
    """True si l'utilisateur de la requête n'a que le rôle Développeur (pas
    de rôle de management) — utilisé pour masquer budget/marge en lecture."""
    request = context.get('request')
    user = getattr(request, 'user', None)
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    return (
        user.roles.filter(name=ROLE_DEVELOPER).exists()
        and not user.roles.filter(name__in=MANAGEMENT_ROLES).exists()
    )

class ProjectListSerializer(serializers.ModelSerializer):
    client_name = serializers.CharField(source='client.company_name', read_only=True)
    project_manager_name = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ['id', 'name', 'status', 'client_name', 'project_manager_name', 'start_date', 'end_date', 'total_cost', 'is_over_budget']

    def get_project_manager_name(self, obj):
        if obj.project_manager:
            return f"{obj.project_manager.first_name} {obj.project_manager.last_name}".strip() or obj.project_manager.email
        return None

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        if _is_dev_only(self.context):
            rep.pop('total_cost', None)
            rep.pop('is_over_budget', None)
        return rep

class ProjectSerializer(serializers.ModelSerializer):
    phases_count = serializers.IntegerField(source='phases.count', read_only=True)
    tasks_count = serializers.IntegerField(source='tasks.count', read_only=True)
    members = serializers.PrimaryKeyRelatedField(many=True, queryset=User.objects.all())

    class Meta:
        model = Project
        fields = '__all__'

    def validate(self, data):
        if 'budget' in data and data['budget'] <= 0:
            raise serializers.ValidationError({"budget": "Budget must be greater than 0."})
        if 'start_date' in data and 'end_date' in data:
            if data['start_date'] > data['end_date']:
                raise serializers.ValidationError({"start_date": "Start date must be before end date."})
        return data

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep['members'] = UserMinimalSerializer(instance.members.all(), many=True).data
        if _is_dev_only(self.context):
            rep.pop('budget', None)
            rep.pop('cost_rate', None)
            rep.pop('total_cost', None)
            rep.pop('is_over_budget', None)
        return rep

class ProjectPhaseSerializer(serializers.ModelSerializer):
    doc_count = serializers.IntegerField(source='documents.count', read_only=True)
    task_count = serializers.IntegerField(source='tasks.count', read_only=True)

    class Meta:
        model = ProjectPhase
        fields = '__all__'

    def validate(self, data):
        project = data.get('project', self.instance.project if self.instance else None)
        end_date = data.get('end_date', self.instance.end_date if self.instance else None)
        if end_date and project and project.end_date and end_date > project.end_date:
            raise serializers.ValidationError({"end_date": "Phase end date cannot be after project end date."})
        return data

class ProjectDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = ProjectDocument
        fields = '__all__'
        read_only_fields = ['uploaded_by']

    def validate_file_path(self, value):
        if not value:
            raise serializers.ValidationError("File path cannot be empty.")
        return value

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return f"{obj.uploaded_by.first_name} {obj.uploaded_by.last_name}".strip() or obj.uploaded_by.email
        return None

class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Task
        fields = '__all__'
        read_only_fields = ['actual_hours', 'completed_at']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return f"{obj.assigned_to.first_name} {obj.assigned_to.last_name}".strip() or obj.assigned_to.email
        return None

class TimeEntrySerializer(serializers.ModelSerializer):
    task_name = serializers.CharField(source='task.name', read_only=True)

    class Meta:
        model = TimeEntry
        fields = '__all__'

    def validate(self, data):
        date = data.get('date')
        if date and date > timezone.now().date():
            raise serializers.ValidationError({"date": "Date cannot be in the future."})

        user = data.get('user', self.instance.user if self.instance else None)
        hours = data.get('hours', 0)
        
        if user and date:
            qs = TimeEntry.objects.filter(user=user, date=date)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            total = qs.aggregate(total_hours=Sum('hours'))['total_hours'] or 0
            if total + hours > 24:
                raise serializers.ValidationError({"hours": "Total hours for a user on a given date cannot exceed 24 hours."})

        return data

class TicketSerializer(serializers.ModelSerializer):
    project_name = serializers.CharField(source='project.name', read_only=True)
    client_name = serializers.CharField(source='client.company_name', read_only=True)

    class Meta:
        model = Ticket
        fields = '__all__'

class KnowledgeBaseSerializer(serializers.ModelSerializer):
    created_by_name = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = KnowledgeBase
        fields = '__all__'
        read_only_fields = ['created_by']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip() or obj.created_by.email
        return None
