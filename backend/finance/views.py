from django.db.models import Q
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, permissions, viewsets

from core.permissions import has_role
from finance.models import DisbursementRequest
from finance.serializers import DisbursementRequestSerializer

CHEF_DE_PROJET_ROLES = ('CHEF_DE_PROJET',)
WIDE_READ_ROLES = ('DIRECTEUR_FINANCIER', 'COMPTABLE')


class CanInitiateDisbursement(permissions.BasePermission):
    """N1 initiation only — Chef de Projet, restricted in the view to
    projects they lead. N2/N3 approval and execution (Directeur Financier/
    Comptable, docs/backend-specifications.md §6.3) aren't built yet, so
    those roles only get read access here for now."""

    def has_permission(self, request, view):
        if request.method == 'POST':
            return has_role(request.user, *CHEF_DE_PROJET_ROLES)
        return has_role(request.user, *CHEF_DE_PROJET_ROLES, *WIDE_READ_ROLES)


@extend_schema_view(
    list=extend_schema(
        tags=['Technique & Projets'],
        summary='List disbursement requests',
        description="Chef de Projet sees requests for projects they lead; "
        "Directeur Financier/Comptable/Super-Admin see everything. "
        "NOTE: approval (N2/N3) and execution aren't implemented yet — "
        "requests stay at EN_ATTENTE_N1 (docs/backend-specifications.md §6.3).",
    ),
    create=extend_schema(tags=['Technique & Projets'], summary='Initiate a disbursement request (N1)', description='Chef de Projet only, for a project they lead.'),
    retrieve=extend_schema(tags=['Technique & Projets'], summary='Get a disbursement request'),
)
class DisbursementRequestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = DisbursementRequestSerializer
    permission_classes = [CanInitiateDisbursement]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return DisbursementRequest.objects.none()
        qs = DisbursementRequest.objects.select_related('project', 'requested_by')
        if has_role(self.request.user, *WIDE_READ_ROLES):
            return qs
        return qs.filter(
            Q(project__lead_project_manager=self.request.user) | Q(requested_by=self.request.user)
        ).distinct()

    def perform_create(self, serializer):
        project = serializer.validated_data.get('project')
        if project and project.lead_project_manager_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Tu ne peux initier une demande que pour un projet que tu diriges.")
        serializer.save(requested_by=self.request.user)
