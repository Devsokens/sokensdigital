from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import has_role
from projects.models import Project, ProjectMember
from projects.serializers import ProjectMemberSerializer, ProjectSerializer

MANAGER_ROLES = ('Super-Administrateur', 'Chef de Projet')
WIDE_READ_ROLES = ('Super-Administrateur', 'Directeur Financier')


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
        return obj.lead_project_manager_id == request.user.id or request.user.is_superuser


@extend_schema_view(
    list=extend_schema(summary='List projects', description='Projects the user leads, is a member of, or all of them for wide-read roles.'),
    create=extend_schema(summary='Create a project', description='Restricted to Chef de Projet and Super-Admin.'),
    retrieve=extend_schema(summary='Get a project'),
    update=extend_schema(summary='Update a project'),
    partial_update=extend_schema(summary='Partially update a project'),
    destroy=extend_schema(summary='Delete a project'),
)
class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    permission_classes = [IsProjectManagerOrReadOnly]

    def get_queryset(self):
        user = self.request.user
        qs = Project.objects.select_related('lead_project_manager').prefetch_related('memberships__user')
        if has_role(user, *WIDE_READ_ROLES):
            return qs
        return qs.filter(Q(lead_project_manager=user) | Q(memberships__user=user)).distinct()

    def perform_create(self, serializer):
        lead = serializer.validated_data.get('lead_project_manager') or self.request.user
        serializer.save(lead_project_manager=lead)

    @extend_schema(
        summary='Add a member to the project',
        request=ProjectMemberSerializer,
        responses={201: ProjectMemberSerializer},
    )
    @action(detail=True, methods=['post'], url_path='members')
    def add_member(self, request, pk=None):
        project = self.get_object()
        if not (project.lead_project_manager_id == request.user.id or request.user.is_superuser):
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = ProjectMemberSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(project=project)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @extend_schema(summary='Remove a member from the project')
    @action(detail=True, methods=['delete'], url_path=r'members/(?P<membership_id>[^/.]+)')
    def remove_member(self, request, pk=None, membership_id=None):
        project = self.get_object()
        if not (project.lead_project_manager_id == request.user.id or request.user.is_superuser):
            return Response(status=status.HTTP_403_FORBIDDEN)
        membership = ProjectMember.objects.filter(id=membership_id, project=project).first()
        if not membership:
            return Response(status=status.HTTP_404_NOT_FOUND)
        # Instance .delete(), not queryset .delete() — LoggedModel writes an
        # AuditLog entry on the former, bulk deletes skip it entirely.
        membership.delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
