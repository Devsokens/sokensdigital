from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.firestore_client import set_chat_room_members, upsert_chat_room
from core.permissions import has_role
from core.constants import ROLE_SUPER_ADMIN, ROLE_PROJECT_MANAGER, ROLE_DIRECTEUR_FINANCIER
from projects.models import Project, ProjectMember, ProjectTask, ProjectTaskComment, Timesheet
from projects.serializers import (
    ProjectMemberSerializer, ProjectSerializer, ProjectTaskCommentSerializer, ProjectTaskSerializer,
    TimesheetSerializer,
)

MANAGER_ROLES = (ROLE_PROJECT_MANAGER,)
WIDE_READ_ROLES = (ROLE_DIRECTEUR_FINANCIER,)


class IsProjectManagerOrReadOnly(permissions.BasePermission):
    """Any team member can read a project; only its lead (or a
    Super-Admin/Chef de Projet) can create/edit it."""

    def has_permission(self, request, view):
        if request.method == 'POST':
            return has_role(request.user, *MANAGER_ROLES)
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return (
                obj.lead_project_manager_id == request.user.id
                or obj.memberships.filter(user=request.user).exists()
                or has_role(request.user, *WIDE_READ_ROLES)
            )
        return obj.lead_project_manager_id == request.user.id or has_role(request.user, ROLE_SUPER_ADMIN)


@extend_schema_view(
    list=extend_schema(tags=['Technique & Projets'], summary='List projects', description='Projects the user leads, is a member of, or all of them for wide-read roles.'),
    create=extend_schema(tags=['Technique & Projets'], summary='Create a project', description='Restricted to Chef de Projet and Super-Admin.'),
    retrieve=extend_schema(tags=['Technique & Projets'], summary='Get a project'),
    update=extend_schema(tags=['Technique & Projets'], summary='Update a project'),
    partial_update=extend_schema(tags=['Technique & Projets'], summary='Partially update a project'),
    destroy=extend_schema(tags=['Technique & Projets'], summary='Delete a project'),
)
class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsProjectManagerOrReadOnly]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Project.objects.none()
        user = self.request.user
        qs = Project.objects.select_related('lead_project_manager').prefetch_related(
            'memberships__user', 'pinned_by', 'tasks',
        )
        if has_role(user, *WIDE_READ_ROLES):
            qs = qs
        else:
            qs = qs.filter(Q(lead_project_manager=user) | Q(memberships__user=user)).distinct()

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search)
        return qs

    def perform_create(self, serializer):
        lead = serializer.validated_data.get('lead_project_manager') or self.request.user
        project = serializer.save(lead_project_manager=lead)
        upsert_chat_room(f'project-{project.id}', {
            'name': f'Salon {project.name}',
            'roomType': 'PROJECT',
            'projectId': str(project.id),
        })
        self._sync_chat_room_members(project)

    def _sync_chat_room_members(self, project):
        """Pushes the current lead + team member firebase_uids to the
        project's chat room — firestore.rules' PROJECT-room read check is
        `request.auth.uid in resource.data.memberUids`, and only the Admin
        SDK (here) can write chatRooms directly. Members without a
        firebase_uid yet (never logged in) are silently skipped — they'll
        be added next time this runs after their first login links it."""
        uids = set()
        if project.lead_project_manager_id and project.lead_project_manager.firebase_uid:
            uids.add(project.lead_project_manager.firebase_uid)
        for member in project.memberships.select_related('user').all():
            if member.user.firebase_uid:
                uids.add(member.user.firebase_uid)
        set_chat_room_members(f'project-{project.id}', list(uids))

    @extend_schema(
        tags=['Technique & Projets'],
        summary='Add a member to the project',
        request=ProjectMemberSerializer,
        responses={201: ProjectMemberSerializer},
    )
    @action(detail=True, methods=['post'], url_path='members')
    def add_member(self, request, pk=None):
        project = self.get_object()
        if not (project.lead_project_manager_id == request.user.id or has_role(request.user, ROLE_SUPER_ADMIN)):
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = ProjectMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project)
        self._sync_chat_room_members(project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=['Technique & Projets'], summary='Remove a member from the project')
    @action(detail=True, methods=['delete'], url_path=r'members/(?P<membership_id>[^/.]+)')
    def remove_member(self, request, pk=None, membership_id=None):
        project = self.get_object()
        if not (project.lead_project_manager_id == request.user.id or has_role(request.user, ROLE_SUPER_ADMIN)):
            return Response(status=status.HTTP_403_FORBIDDEN)
        membership = ProjectMember.objects.filter(id=membership_id, project=project).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)
        # Instance .delete(), not queryset .delete() — LoggedModel writes an
        # AuditLog entry on the former, bulk deletes skip it entirely.
        membership.delete(user=request.user)
        self._sync_chat_room_members(project)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _is_lead_or_admin(self, request, project):
        return project.lead_project_manager_id == request.user.id or has_role(request.user, ROLE_SUPER_ADMIN)

    def _is_project_member(self, request, project):
        return (
            self._is_lead_or_admin(request, project)
            or project.memberships.filter(user=request.user).exists()
        )

    @extend_schema(
        tags=['Technique & Projets'],
        summary='List / submit timesheets for this project',
        description='Team members see and submit only their own entries; the project lead sees everyone\'s.',
        request=TimesheetSerializer,
        responses={200: TimesheetSerializer(many=True), 201: TimesheetSerializer},
    )
    @action(detail=True, methods=['get', 'post'], url_path='timesheets', permission_classes=[permissions.IsAuthenticated])
    def timesheets(self, request, pk=None):
        project = self.get_object()
        if not self._is_project_member(request, project):
            return Response(status=status.HTTP_403_FORBIDDEN)

        if request.method == 'POST':
            serializer = TimesheetSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            if Timesheet.objects.filter(
                project=project, user=request.user, date=serializer.validated_data['date']
            ).exists():
                return Response(
                    {'detail': 'Une feuille de temps existe déjà pour cette date sur ce projet.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            serializer.save(project=project, user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        qs = Timesheet.objects.filter(project=project).select_related('user')
        if not self._is_lead_or_admin(request, project):
            qs = qs.filter(user=request.user)
        return Response(TimesheetSerializer(qs, many=True).data)

    @extend_schema(
        tags=['Technique & Projets'],
        summary='Validate or reject a timesheet entry',
        request={'application/json': {'type': 'object', 'properties': {'status': {'type': 'string', 'enum': ['VALIDE', 'REJETE']}}}},
        responses={200: TimesheetSerializer},
    )
    @action(
        detail=True, methods=['post'], url_path=r'timesheets/(?P<timesheet_id>[^/.]+)/validate',
        permission_classes=[permissions.IsAuthenticated],
    )
    def validate_timesheet(self, request, pk=None, timesheet_id=None):
        project = self.get_object()
        if not self._is_lead_or_admin(request, project):
            return Response(status=status.HTTP_403_FORBIDDEN)
        new_status = request.data.get('status')
        if new_status not in (Timesheet.Status.VALIDE, Timesheet.Status.REJETE):
            return Response(
                {'detail': 'status doit être VALIDE ou REJETE.'}, status=status.HTTP_400_BAD_REQUEST,
            )
        timesheet = Timesheet.objects.filter(id=timesheet_id, project=project).first()
        if not timesheet:
            return Response(status=status.HTTP_404_NOT_FOUND)
        timesheet.status = new_status
        timesheet.save(update_fields=['status'])
        return Response(TimesheetSerializer(timesheet).data)

    @extend_schema(
        tags=['Technique & Projets'],
        summary='Toggle the requesting user\'s personal pin on a project',
        request=None,
        responses={200: {'type': 'object', 'properties': {'is_pinned': {'type': 'boolean'}}}},
    )
    @action(detail=True, methods=['post'], url_path='pin', permission_classes=[permissions.IsAuthenticated])
    def toggle_pin(self, request, pk=None):
        project = self.get_object()
        if project.pinned_by.filter(id=request.user.id).exists():
            project.pinned_by.remove(request.user)
            pinned = False
        else:
            project.pinned_by.add(request.user)
            pinned = True
        return Response({'is_pinned': pinned})

    @extend_schema(
        tags=['Technique & Projets'],
        summary='List / add checklist tasks for a project',
        description='Any project member can view and add checklist tasks.',
        request=ProjectTaskSerializer,
        responses={200: ProjectTaskSerializer(many=True), 201: ProjectTaskSerializer},
    )
    @action(detail=True, methods=['get', 'post'], url_path='tasks', permission_classes=[permissions.IsAuthenticated])
    def tasks(self, request, pk=None):
        project = self.get_object()
        if not self._is_project_member(request, project):
            return Response(status=status.HTTP_403_FORBIDDEN)

        if request.method == 'POST':
            serializer = ProjectTaskSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(project=project)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        qs = project.tasks.prefetch_related('assignees')
        return Response(ProjectTaskSerializer(qs, many=True).data)

    @extend_schema(
        tags=['Technique & Projets'],
        summary='Update or delete a checklist task',
        description='Any project member can toggle/edit or delete a checklist task.',
        request=ProjectTaskSerializer,
        responses={200: ProjectTaskSerializer},
    )
    @action(
        detail=True, methods=['patch', 'delete'], url_path=r'tasks/(?P<task_id>[^/.]+)',
        permission_classes=[permissions.IsAuthenticated],
    )
    def task_detail(self, request, pk=None, task_id=None):
        project = self.get_object()
        if not self._is_project_member(request, project):
            return Response(status=status.HTTP_403_FORBIDDEN)

        task = project.tasks.filter(id=task_id).first()
        if not task:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if request.method == 'DELETE':
            task.delete(user=request.user)
            return Response(status=status.HTTP_204_NO_CONTENT)

        serializer = ProjectTaskSerializer(task, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @extend_schema(
        tags=['Technique & Projets'],
        summary='List / add comments on a checklist task',
        description='Any project member can view and post comments on a task.',
        request=ProjectTaskCommentSerializer,
        responses={200: ProjectTaskCommentSerializer(many=True), 201: ProjectTaskCommentSerializer},
    )
    @action(
        detail=True, methods=['get', 'post'], url_path=r'tasks/(?P<task_id>[^/.]+)/comments',
        permission_classes=[permissions.IsAuthenticated],
    )
    def task_comments(self, request, pk=None, task_id=None):
        project = self.get_object()
        if not self._is_project_member(request, project):
            return Response(status=status.HTTP_403_FORBIDDEN)

        task = project.tasks.filter(id=task_id).first()
        if not task:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if request.method == 'POST':
            serializer = ProjectTaskCommentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            serializer.save(task=task, author=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        qs = task.comments.select_related('author')
        return Response(ProjectTaskCommentSerializer(qs, many=True).data)
