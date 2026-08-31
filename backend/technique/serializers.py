from datetime import timedelta
from django.utils import timezone
from rest_framework import serializers
from .models import (
    Project, ProjectPhase, ProjectDocument, Task, TimeEntry, Ticket, KnowledgeBase,
    MaintainedApp, MaintenanceServiceAccount, MaintenanceReport,
)
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


# ---------------------------------------------------------------------------
# Maintenance
# ---------------------------------------------------------------------------

class MaintenanceServiceAccountSerializer(serializers.ModelSerializer):
    """Compte de service AVEC ses identifiants — n'est monté que depuis
    l'action `secrets` de MaintainedAppViewSet, jamais dans une liste."""

    class Meta:
        model = MaintenanceServiceAccount
        fields = ['id', 'app', 'service_name', 'url', 'username', 'password', 'notes', 'updated_at']


class MaintenanceServiceAccountPublicSerializer(serializers.ModelSerializer):
    """Le même compte SANS les identifiants — pour dire "cette app utilise
    Cloudinary et SendGrid" sans divulguer comment s'y connecter."""

    class Meta:
        model = MaintenanceServiceAccount
        fields = ['id', 'service_name', 'url']


class MaintainedAppSerializer(serializers.ModelSerializer):
    """Fiche descriptive — AUCUN identifiant. C'est ce que voit toute
    l'équipe technique en liste et en détail.

    Les champs chiffrés (admin_username/password, access_notes) sont
    délibérément absents de `fields` : un serializer qui les exposerait
    "juste en lecture pour les personnes autorisées" finirait tôt ou tard
    par fuiter dans un log, un cache ou un écran de debug. Ils ne
    transitent que par l'action dédiée `secrets`.
    """

    assigned_to_name = serializers.SerializerMethodField(read_only=True)
    client_name = serializers.CharField(source='client.company_name', read_only=True)
    project_name = serializers.CharField(source='project.name', read_only=True)
    service_accounts = MaintenanceServiceAccountPublicSerializer(many=True, read_only=True)
    last_report_at = serializers.SerializerMethodField(read_only=True)
    last_report_status = serializers.SerializerMethodField(read_only=True)
    reports_last_7_days = serializers.SerializerMethodField(read_only=True)
    expected_reports_per_week = serializers.IntegerField(read_only=True)

    class Meta:
        model = MaintainedApp
        fields = [
            'id', 'name', 'app_type', 'url', 'description',
            'client', 'client_name', 'project', 'project_name',
            'tech_stack', 'hosting_provider', 'repository_url', 'admin_url',
            'assigned_to', 'assigned_to_name', 'assigned_by', 'assigned_at',
            'maintenance_frequency', 'expected_reports_per_week', 'is_active',
            'service_accounts', 'last_report_at', 'last_report_status',
            'reports_last_7_days', 'created_at', 'updated_at',
        ]
        read_only_fields = ['assigned_by', 'assigned_at']

    def get_assigned_to_name(self, obj):
        if not obj.assigned_to:
            return None
        full = f'{obj.assigned_to.first_name} {obj.assigned_to.last_name}'.strip()
        return full or obj.assigned_to.email

    def _recent_reports(self, obj):
        # Annoté par MaintainedAppViewSet.get_queryset() quand disponible —
        # évite une requête par ligne sur un écran qui liste toutes les apps.
        return getattr(obj, 'recent_reports_count', None)

    def get_reports_last_7_days(self, obj):
        annotated = self._recent_reports(obj)
        if annotated is not None:
            return annotated
        since = timezone.now() - timedelta(days=7)
        return obj.reports.filter(performed_at__gte=since).count()

    def get_last_report_at(self, obj):
        last = obj.reports.first()  # ordering = ['-performed_at']
        return last.performed_at if last else None

    def get_last_report_status(self, obj):
        last = obj.reports.first()
        return last.status if last else None


class MaintainedAppSecretsSerializer(serializers.ModelSerializer):
    """Les accès, et rien d'autre. Servi uniquement par l'action `secrets`,
    réservée à la personne assignée et aux responsables techniques."""

    service_accounts = MaintenanceServiceAccountSerializer(many=True, read_only=True)

    class Meta:
        model = MaintainedApp
        fields = ['id', 'admin_url', 'admin_username', 'admin_password', 'access_notes', 'service_accounts']


class MaintenanceReportSerializer(serializers.ModelSerializer):
    performed_by_name = serializers.SerializerMethodField(read_only=True)
    app_name = serializers.CharField(source='app.name', read_only=True)

    class Meta:
        model = MaintenanceReport
        fields = [
            'id', 'app', 'app_name', 'performed_by', 'performed_by_name', 'performed_at',
            'status', 'site_reachable', 'backups_verified', 'updates_applied', 'ssl_valid',
            'summary', 'next_actions', 'created_at',
        ]
        read_only_fields = ['performed_by']

    def get_performed_by_name(self, obj):
        if not obj.performed_by:
            return None
        full = f'{obj.performed_by.first_name} {obj.performed_by.last_name}'.strip()
        return full or obj.performed_by.email
