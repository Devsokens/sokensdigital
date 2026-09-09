"""
Maintenance des applications et sites livrés.

Dans son propre module plutôt qu'ajouté à technique/views.py (déjà ~450
lignes) : la maintenance a son propre modèle de permissions — notamment la
séparation entre "voir la fiche" (toute l'équipe technique) et "voir les
identifiants de production" (personne assignée + responsable, avec
journalisation) — et la mélanger au reste rendait cette frontière moins
lisible.
"""
from datetime import timedelta

from django.db import models
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.constants import (
    ROLE_ADMIN, ROLE_DEVELOPER, ROLE_PROJECT_MANAGER, ROLE_SUPER_ADMIN,
)
from core.models import AuditLog, Notification, User
from core.permissions import has_role

from .models import MaintainedApp, MaintenanceReport, MaintenanceServiceAccount
from .serializers import (
    MaintainedAppSecretsSerializer,
    MaintainedAppSerializer,
    MaintenanceReportSerializer,
    MaintenanceServiceAccountPublicSerializer,
    MaintenanceServiceAccountSerializer,
)

# Le "responsable de l'équipe technique" du cahier des charges n'a pas de
# rôle dédié dans core.constants — Chef de Projet / Admin / Super-Admin en
# tiennent lieu, même raisonnement que le palier N3 des décaissements côté
# Finance (aucun rôle "direction générale" n'existe non plus là-bas).
MAINTENANCE_LEAD_ROLES = (ROLE_PROJECT_MANAGER, ROLE_ADMIN, ROLE_SUPER_ADMIN)
# Qui compose "l'équipe technique", et voit donc les fiches et les rapports.
MAINTENANCE_TEAM_ROLES = MAINTENANCE_LEAD_ROLES + (ROLE_DEVELOPER,)


class IsTechnicalTeam(permissions.BasePermission):
    """Lecture des fiches et rapports — toute l'équipe technique, le cahier
    des charges demandant des rapports "visibles par les membres
    techniques"."""

    def has_permission(self, request, view):
        return has_role(request.user, *MAINTENANCE_TEAM_ROLES)


class IsMaintenanceLead(permissions.BasePermission):
    """Écriture sur les fiches — le responsable technique seul, puisque
    c'est lui qui décide des attributions."""

    def has_permission(self, request, view):
        return has_role(request.user, *MAINTENANCE_LEAD_ROLES)


class MaintainedAppViewSet(viewsets.ModelViewSet):
    """Applications et sites sous maintenance.

    Lecture ouverte à l'équipe technique, écriture réservée au responsable.
    Les identifiants ne transitent jamais par cette route — voir `secrets`.
    """

    serializer_class = MaintainedAppSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['is_active', 'app_type', 'assigned_to']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return MaintainedApp.objects.none()
        since = timezone.now() - timedelta(days=7)
        return (
            MaintainedApp.objects
            .select_related('client', 'project', 'assigned_to')
            .prefetch_related('service_accounts', 'reports')
            # Rapports des 7 derniers jours comptés en une seule requête
            # agrégée plutôt qu'un COUNT par ligne affichée — le serializer
            # lit cette annotation dans get_reports_last_7_days().
            .annotate(recent_reports_count=models.Count(
                'reports',
                filter=models.Q(reports__performed_at__gte=since),
                distinct=True,
            ))
        )

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated(), IsTechnicalTeam()]
        return [permissions.IsAuthenticated(), IsMaintenanceLead()]

    @action(detail=True, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def secrets(self, request, pk=None):
        """Accès admin et comptes de service, en clair.

        Réservé à la personne assignée et aux responsables techniques : un
        développeur de l'équipe voit la fiche et les rapports, mais pas les
        mots de passe d'une application qui ne lui est pas confiée. Chaque
        consultation est journalisée — ces identifiants ouvrent des systèmes
        de production, savoir qui les a lus et quand fait partie du contrôle.
        """
        app = self.get_object()
        is_lead = has_role(request.user, *MAINTENANCE_LEAD_ROLES)
        is_assignee = app.assigned_to_id == request.user.id
        if not (is_lead or is_assignee):
            return Response(
                {'detail': 'Ces accès sont réservés à la personne assignée et aux responsables techniques.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        AuditLog.objects.create(
            user=request.user,
            action='READ_SECRETS',
            entity_type='MaintainedApp',
            entity_id=str(app.id),
            details={'app_name': app.name},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response(MaintainedAppSecretsSerializer(app).data)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsMaintenanceLead])
    def assign(self, request, pk=None):
        """Attribue la maintenance d'une application à un membre de l'équipe."""
        app = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'user_id requis.'}, status=status.HTTP_400_BAD_REQUEST)
        assignee = User.objects.filter(id=user_id, is_active=True).first()
        if not assignee:
            return Response({'detail': 'Utilisateur introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        app.assigned_to = assignee
        app.assigned_by = request.user
        app.assigned_at = timezone.now()
        app.save(update_fields=['assigned_to', 'assigned_by', 'assigned_at'])

        Notification.objects.create(
            user=assignee,
            title='Maintenance attribuée',
            message=f'{app.name} vous est confiée ({app.get_maintenance_frequency_display().lower()}).',
            notification_type='GENERAL',
            link='/admin/technique/maintenance',
        )
        return Response(self.get_serializer(app).data)


class MaintenanceServiceAccountViewSet(viewsets.ModelViewSet):
    """Comptes des services tiers utilisés par une application.

    Écriture réservée au responsable technique. La liste ne renvoie jamais
    les identifiants (serializer public) — ceux-ci ne sortent que par
    MaintainedAppViewSet.secrets, qui vérifie l'assignation et journalise.
    """

    queryset = MaintenanceServiceAccount.objects.select_related('app')
    serializer_class = MaintenanceServiceAccountSerializer
    permission_classes = [permissions.IsAuthenticated, IsMaintenanceLead]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['app']

    def get_serializer_class(self):
        if self.action == 'list':
            return MaintenanceServiceAccountPublicSerializer
        return MaintenanceServiceAccountSerializer


class MaintenanceReportViewSet(viewsets.ModelViewSet):
    """Rapports de maintenance — lisibles par toute l'équipe technique
    (exigence explicite du cahier des charges), rédigés par la personne qui
    a effectué le passage."""

    serializer_class = MaintenanceReportSerializer
    permission_classes = [permissions.IsAuthenticated, IsTechnicalTeam]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['app', 'status']

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return MaintenanceReport.objects.none()
        return MaintenanceReport.objects.select_related('app', 'performed_by')

    def perform_create(self, serializer):
        serializer.save(performed_by=self.request.user)

    def update(self, request, *args, **kwargs):
        report = self.get_object()
        # Un rapport est un constat daté : son auteur peut le corriger, mais
        # personne d'autre ne réécrit ce qu'il a observé sur le terrain —
        # sauf un responsable, pour les cas de correction manifeste.
        if report.performed_by_id != request.user.id and not has_role(request.user, *MAINTENANCE_LEAD_ROLES):
            return Response(
                {'detail': "Seul l'auteur du rapport (ou un responsable) peut le modifier."},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)
