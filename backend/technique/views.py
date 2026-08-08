from django.db import models, transaction
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers as drf_serializers
from django_filters.rest_framework import DjangoFilterBackend

from core.constants import (
    ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_PROJECT_MANAGER,
    ROLE_DEVELOPER, ROLE_DIRECTEUR_FINANCIER,
    ADMIN_ROLES, MANAGEMENT_ROLES, FINANCE_ROLES,
)
from core.permissions import (
    IsSuperAdmin, IsAdmin, IsProjectManager, IsDeveloper,
    IsDirecteurFinancier, IsOwner, IsProjectMember,
    IsAssignedDeveloper, IsAdminOrReadOnly, ReadOnly,
)
from core.models import User, AuditLog, Notification
from .models import (
    Project, ProjectPhase, ProjectDocument,
    Task, TimeEntry, Ticket, KnowledgeBase, ProjectStatus,
)
from .serializers import (
    ProjectSerializer, ProjectListSerializer, ProjectPhaseSerializer,
    ProjectDocumentSerializer, TaskSerializer, TimeEntrySerializer,
    TicketSerializer, KnowledgeBaseSerializer,
)


class ProjectViewSet(viewsets.ModelViewSet):
    """
    CRUD projets avec filtrage RBAC.

    - Admin / Directeur Financier : tous les projets
    - Chef de Projet : projets gérés + projets membres
    - Développeur : projets dont il est membre uniquement
    """
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'client', 'project_manager']
    search_fields = ['name', 'description']
    ordering_fields = ['created_at', 'start_date', 'end_date', 'name']

    def get_queryset(self):
        user = self.request.user
        qs = Project.objects.select_related(
            'client', 'project_manager'
        ).prefetch_related('members')

        if user.roles.filter(name__in=[*ADMIN_ROLES, ROLE_DIRECTEUR_FINANCIER]).exists():
            return qs
        if user.roles.filter(name=ROLE_PROJECT_MANAGER).exists():
            return qs.filter(
                models.Q(project_manager=user) | models.Q(members=user)
            ).distinct()
        if user.roles.filter(name=ROLE_DEVELOPER).exists():
            return qs.filter(members=user)
        return qs.none()

    def get_serializer_class(self):
        if self.action == 'list':
            return ProjectListSerializer
        return ProjectSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsProjectManager)()]
        if self.action == 'destroy':
            return [permissions.IsAuthenticated(), IsSuperAdmin()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        instance = serializer.save()
        # Ajouter le PM comme membre si pas déjà
        if instance.project_manager:
            instance.members.add(instance.project_manager)

    def perform_update(self, serializer):
        user = self.request.user
        # Développeurs ne peuvent pas modifier budget ou cost_rate
        is_dev_only = (
            user.roles.filter(name=ROLE_DEVELOPER).exists()
            and not user.roles.filter(name__in=MANAGEMENT_ROLES).exists()
        )
        if is_dev_only:
            serializer.validated_data.pop('budget', None)
            serializer.validated_data.pop('cost_rate', None)
        serializer.save()

    @action(detail=True, methods=['post'], url_path='change-status')
    def change_status(self, request, pk=None):
        """Change le statut du projet avec audit trail."""
        project = self.get_object()
        new_status = request.data.get('status')
        if not new_status:
            return Response(
                {'error': 'Le champ status est requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_statuses = [s.value for s in ProjectStatus]
        if new_status not in valid_statuses:
            return Response(
                {'error': f'Statut invalide. Choix : {valid_statuses}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            old_status = project.status
            project.status = new_status
            project.save()

            AuditLog.objects.log_action(
                user=request.user,
                action=f'STATUS_CHANGE:{old_status}->{new_status}',
                entity_type='Project',
                entity_id=str(project.pk),
                details={'old_status': old_status, 'new_status': new_status},
            )

        return Response({'status': project.status})

    @action(detail=True, methods=['post', 'delete'], url_path='members')
    def manage_members(self, request, pk=None):
        """Ajouter/retirer des membres au projet."""
        project = self.get_object()
        user_ids = request.data.get('user_ids', [])

        users = User.objects.filter(id__in=user_ids)
        if request.method == 'POST':
            project.members.add(*users)
            return Response({'status': 'members added'})
        else:
            project.members.remove(*users)
            return Response({'status': 'members removed'})


class ProjectPhaseViewSet(viewsets.ModelViewSet):
    """Phases d'un projet (nested sous /projects/{id}/phases/)."""
    serializer_class = ProjectPhaseSerializer

    def get_queryset(self):
        return ProjectPhase.objects.filter(
            project_id=self.kwargs['project_pk']
        ).order_by('order')

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsProjectManager)()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_pk'])

    def perform_update(self, serializer):
        """Bloque le passage à TERMINE sans document LIVRABLE."""
        if serializer.validated_data.get('status') == 'TERMINE':
            phase = self.get_object()
            if not phase.documents.filter(document_type='LIVRABLE').exists():
                raise drf_serializers.ValidationError(
                    'Impossible de terminer une phase sans document de type LIVRABLE.'
                )
        serializer.save()


class ProjectDocumentViewSet(viewsets.ModelViewSet):
    """Documents d'un projet (nested sous /projects/{id}/documents/)."""
    serializer_class = ProjectDocumentSerializer

    def get_queryset(self):
        return ProjectDocument.objects.filter(
            project_id=self.kwargs['project_pk']
        )

    def get_permissions(self):
        if self.action in ['create']:
            return [permissions.IsAuthenticated()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsProjectManager)()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(
            uploaded_by=self.request.user,
            project_id=self.kwargs['project_pk'],
        )


class TaskViewSet(viewsets.ModelViewSet):
    """
    Tâches d'un projet.

    Développeurs assignés ne peuvent que modifier le champ ``status``
    (PATCH partiel).
    """
    serializer_class = TaskSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'priority', 'assigned_to', 'phase']
    search_fields = ['name', 'description']

    def get_queryset(self):
        return Task.objects.filter(
            project_id=self.kwargs['project_pk']
        ).select_related('assigned_to', 'phase')

    def get_permissions(self):
        if self.action in ['create', 'destroy']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsProjectManager)()]
        if self.action in ['update', 'partial_update']:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_pk'])

    def perform_update(self, serializer):
        user = self.request.user
        is_dev_only = (
            user.roles.filter(name=ROLE_DEVELOPER).exists()
            and not user.roles.filter(name__in=MANAGEMENT_ROLES).exists()
        )
        if is_dev_only:
            # Développeurs : uniquement le champ status
            allowed = {'status'}
            for field in list(serializer.validated_data.keys()):
                if field not in allowed:
                    serializer.validated_data.pop(field)
        serializer.save()


class TimeEntryViewSet(viewsets.ModelViewSet):
    """
    Entrées de temps (nested sous /tasks/{id}/time-entries/).

    Chaque utilisateur ne peut créer/modifier/supprimer que ses propres entrées.
    """
    serializer_class = TimeEntrySerializer

    def get_queryset(self):
        qs = TimeEntry.objects.filter(task_id=self.kwargs['task_pk'])
        user = self.request.user

        # Managers et admins voient toutes les entrées du projet
        if user.roles.filter(
            name__in=[*ADMIN_ROLES, ROLE_PROJECT_MANAGER, ROLE_DIRECTEUR_FINANCIER]
        ).exists():
            return qs
        return qs.filter(user=user)

    def get_permissions(self):
        if self.action in ['create']:
            return [permissions.IsAuthenticated()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsOwner()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        instance = serializer.save(
            user=self.request.user,
            task_id=self.kwargs['task_pk'],
        )
        # Recalcul actual_hours géré par le signal post_save

    def perform_destroy(self, instance):
        task = instance.task
        instance.delete()
        # Recalcul actual_hours géré par le signal post_delete


class TicketViewSet(viewsets.ModelViewSet):
    """Support technique — tickets."""
    serializer_class = TicketSerializer
    queryset = Ticket.objects.all()
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'severity', 'project', 'assigned_developer']
    search_fields = ['title', 'description']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update']:
            return [permissions.IsAuthenticated()]
        if self.action == 'destroy':
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]


class KnowledgeBaseViewSet(viewsets.ModelViewSet):
    """Base de connaissances technique."""
    serializer_class = KnowledgeBaseSerializer
    queryset = KnowledgeBase.objects.all()
    search_fields = ['title', 'content', 'tags']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsProjectManager)()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
