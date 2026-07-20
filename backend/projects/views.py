from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import has_role
from projects.models import Project, ProjectMember, Timesheet
from projects.serializers import ProjectMemberSerializer, ProjectSerializer, TimesheetSerializer

MANAGER_ROLES = ('CHEF_DE_PROJET',)
WIDE_READ_ROLES = ('DIRECTEUR_FINANCIER',)


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
        return obj.lead_project_manager_id == request.user.id or has_role(request.user, 'SUPER_ADMIN')


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
        qs = Project.objects.select_related('lead_project_manager').prefetch_related('memberships__user')
        if has_role(user, *WIDE_READ_ROLES):
            return qs
        return qs.filter(Q(lead_project_manager=user) | Q(memberships__user=user)).distinct()

    def perform_create(self, serializer):
        lead = serializer.validated_data.get('lead_project_manager') or self.request.user
        serializer.save(lead_project_manager=lead)

    @extend_schema(
        tags=['Technique & Projets'],
        summary='Add a member to the project',
        request=ProjectMemberSerializer,
        responses={201: ProjectMemberSerializer},
    )
    @action(detail=True, methods=['post'], url_path='members')
    def add_member(self, request, pk=None):
        project = self.get_object()
        if not (project.lead_project_manager_id == request.user.id or has_role(request.user, 'SUPER_ADMIN')):
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = ProjectMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(tags=['Technique & Projets'], summary='Remove a member from the project')
    @action(detail=True, methods=['delete'], url_path=r'members/(?P<membership_id>[^/.]+)')
    def remove_member(self, request, pk=None, membership_id=None):
        project = self.get_object()
        if not (project.lead_project_manager_id == request.user.id or has_role(request.user, 'SUPER_ADMIN')):
            return Response(status=status.HTTP_403_FORBIDDEN)
        membership = ProjectMember.objects.filter(id=membership_id, project=project).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)
        # Instance .delete(), not queryset .delete() — LoggedModel writes an
        # AuditLog entry on the former, bulk deletes skip it entirely.
        membership.delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _is_lead_or_admin(self, request, project):
        return project.lead_project_manager_id == request.user.id or has_role(request.user, 'SUPER_ADMIN')

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
