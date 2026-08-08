from django.db import models, transaction
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import serializers as drf_serializers
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend

from core.constants import (
    ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_PROJECT_MANAGER,
    ROLE_DEVELOPER, ROLE_DIRECTEUR_FINANCIER, ROLE_SUPPORT_CLIENT,
    ADMIN_ROLES, MANAGEMENT_ROLES, FINANCE_ROLES,
)
from core.permissions import (
    IsSuperAdmin, IsAdmin, IsProjectManager, IsDeveloper,
    IsDirecteurFinancier, IsOwner, IsProjectMember,
    IsAssignedDeveloper, IsAdminOrReadOnly, ReadOnly,
    IsConsultant, IsSupportClient,
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
        instance = serializer.instance
        # Chef de Projet : uniquement le projet qu'il gère lui-même
        is_admin = user.roles.filter(name__in=ADMIN_ROLES).exists()
        if not is_admin and user.roles.filter(name=ROLE_PROJECT_MANAGER).exists():
            if instance.project_manager_id != user.pk:
                raise PermissionDenied("Vous ne gérez pas ce projet.")
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

    @action(
        detail=True, methods=['post', 'delete'], url_path='members',
        permission_classes=[permissions.IsAuthenticated, (IsAdmin | IsProjectManager)],
    )
    def manage_members(self, request, pk=None):
        """Ajouter/retirer des membres au projet."""
        project = self.get_object()
        user = request.user
        is_admin = user.roles.filter(name__in=ADMIN_ROLES).exists()
        if not is_admin and project.project_manager_id != user.pk:
            raise PermissionDenied("Vous ne gérez pas ce projet.")
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
        qs = ProjectPhase.objects.filter(
            project_id=self.kwargs['project_pk']
        ).order_by('order')
        user = self.request.user
        if user.roles.filter(name__in=ADMIN_ROLES).exists():
            return qs
        is_member_or_manager = Project.objects.filter(
            models.Q(pk=self.kwargs['project_pk']) &
            (models.Q(project_manager=user) | models.Q(members=user))
        ).exists()
        if is_member_or_manager:
            return qs
        return qs.none()

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsProjectManager)()]
        return [permissions.IsAuthenticated()]

    def _check_project_manager_scope(self):
        user = self.request.user
        is_admin = user.roles.filter(name__in=ADMIN_ROLES).exists()
        if not is_admin and user.roles.filter(name=ROLE_PROJECT_MANAGER).exists():
            project = Project.objects.filter(pk=self.kwargs['project_pk']).first()
            if not project or project.project_manager_id != user.pk:
                raise PermissionDenied("Vous ne gérez pas ce projet.")

    def perform_create(self, serializer):
        self._check_project_manager_scope()
        serializer.save(project_id=self.kwargs['project_pk'])

    def perform_update(self, serializer):
        """Bloque le passage à TERMINE sans document LIVRABLE."""
        self._check_project_manager_scope()
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
        user = self.request.user
        is_management = user.roles.filter(
            name__in=[*ADMIN_ROLES, ROLE_PROJECT_MANAGER]
        ).exists()
        if not is_management:
            # Développeur : autorisé uniquement s'il a une tâche assignée
            # sur la phase visée par ce document (recette liée à sa tâche).
            phase_id = self.request.data.get('phase')
            has_linked_task = phase_id and Task.objects.filter(
                project_id=self.kwargs['project_pk'],
                phase_id=phase_id,
                assigned_to=user,
            ).exists()
            if not has_linked_task:
                raise PermissionDenied(
                    "Vous ne pouvez ajouter un document que sur une phase "
                    "liée à une de vos tâches."
                )
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
        qs = Task.objects.filter(
            project_id=self.kwargs['project_pk']
        ).select_related('assigned_to', 'phase')
        user = self.request.user
        if user.roles.filter(name__in=ADMIN_ROLES).exists():
            return qs
        is_member_or_manager = Project.objects.filter(
            models.Q(pk=self.kwargs['project_pk']) &
            (models.Q(project_manager=user) | models.Q(members=user))
        ).exists()
        if is_member_or_manager:
            return qs
        return qs.none()

    def get_permissions(self):
        if self.action in ['create', 'destroy']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsProjectManager)()]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(project_id=self.kwargs['project_pk'])

    def perform_update(self, serializer):
        user = self.request.user
        instance = serializer.instance
        is_management = user.roles.filter(name__in=MANAGEMENT_ROLES).exists()
        is_dev_only = (
            user.roles.filter(name=ROLE_DEVELOPER).exists() and not is_management
        )
        if is_dev_only:
            # Développeur non-manager : uniquement s'il est assigné à CETTE
            # tâche, et uniquement le champ status.
            if instance.assigned_to_id != user.pk:
                raise PermissionDenied(
                    "Vous n'êtes pas assigné à cette tâche."
                )
            allowed = {'status'}
            for field in list(serializer.validated_data.keys()):
                if field not in allowed:
                    serializer.validated_data.pop(field)
        elif not is_management:
            # Ni manager, ni développeur (rôle non habilité en écriture ici)
            raise PermissionDenied("Vous n'êtes pas autorisé à modifier cette tâche.")
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

        # Admin et Directeur Financier : visibilité totale.
        if user.roles.filter(name__in=[*ADMIN_ROLES, ROLE_DIRECTEUR_FINANCIER]).exists():
            return qs
        # Chef de Projet : uniquement les entrées de SES projets.
        if user.roles.filter(name=ROLE_PROJECT_MANAGER).exists():
            task = Task.objects.filter(pk=self.kwargs['task_pk']).select_related('project').first()
            if task and task.project.project_manager_id == user.pk:
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
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'severity', 'project', 'assigned_developer']
    search_fields = ['title', 'description']

    def get_queryset(self):
        qs = Ticket.objects.all()
        user = self.request.user
        # Admin, ChefProjet, Support Client : accès complet.
        if user.roles.filter(
            name__in=[*ADMIN_ROLES, ROLE_PROJECT_MANAGER, ROLE_SUPPORT_CLIENT]
        ).exists():
            return qs
        # Autres : uniquement tickets liés à un projet dont ils sont membres,
        # ou dont ils sont le développeur assigné.
        return qs.filter(
            models.Q(assigned_developer=user) | models.Q(project__members=user)
        ).distinct()

    def get_permissions(self):
        if self.action == 'create':
            return [
                permissions.IsAuthenticated(),
                (IsAdmin | IsProjectManager | IsSupportClient)(),
            ]
        if self.action == 'destroy':
            return [permissions.IsAuthenticated(), IsAdmin()]
        # update/partial_update : gate complet fait dans perform_update,
        # car le développeur assigné doit pouvoir modifier SON ticket sans
        # avoir de rôle de gestion — dépend de l'objet, pas connu ici.
        return [permissions.IsAuthenticated()]

    def perform_update(self, serializer):
        instance = serializer.instance
        user = self.request.user
        is_management = user.roles.filter(
            name__in=[*ADMIN_ROLES, ROLE_PROJECT_MANAGER, ROLE_SUPPORT_CLIENT]
        ).exists()
        if not is_management and instance.assigned_developer_id != user.pk:
            raise PermissionDenied("Vous n'êtes pas assigné à ce ticket.")
        serializer.save()


class KnowledgeBaseViewSet(viewsets.ModelViewSet):
    """Base de connaissances technique."""
    serializer_class = KnowledgeBaseSerializer
    queryset = KnowledgeBase.objects.all()
    search_fields = ['title', 'content', 'tags']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [
                permissions.IsAuthenticated(),
                (IsAdmin | IsProjectManager | IsConsultant)(),
            ]
        return [permissions.IsAuthenticated()]

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
