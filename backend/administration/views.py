import hashlib
import hmac

from django.conf import settings
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone

from core.models import AuditLog, Notification
from core.constants import (
    ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_PROJECT_MANAGER,
    ROLE_DEVELOPER, ROLE_DIRECTEUR_FINANCIER, ROLE_COMMERCIAL,
    ROLE_RH_MANAGER, ADMIN_ROLES, HR_ROLES, FINANCE_ROLES,
)
from core.permissions import (
    IsSuperAdmin, IsAdmin, IsProjectManager,
    IsDirecteurFinancier, IsCommercial, IsRHManager,
    IsOwner, IsAdminOrReadOnly, ReadOnly,
)

from .models import (
    Client, ClientInteraction, ClientDocument, EmployeeDocument,
    LeaveRequest, CompanyAsset, AdministrativeRecord, ContractGenerator,
)
from .serializers import (
    ClientSerializer, ClientListSerializer, ClientInteractionSerializer,
    ClientDocumentSerializer, EmployeeDocumentSerializer, LeaveRequestSerializer,
    CompanyAssetSerializer, AdministrativeRecordSerializer, ContractGeneratorSerializer,
)


def _accessible_clients_qs(user):
    """
    Clients visibles par cet utilisateur.

    Admin / Directeur Financier / Commercial&Marketing (non scopé
    ci-dessous) : tous les clients. Commercial seul : ses clients
    assignés. Chef de Projet seul : clients liés à ses projets.
    """
    qs = Client.objects.all()

    if (user.roles.filter(name=ROLE_COMMERCIAL).exists()
            and not user.roles.filter(name__in=ADMIN_ROLES).exists()):
        return qs.filter(assigned_to=user)

    if (user.roles.filter(name=ROLE_PROJECT_MANAGER).exists()
            and not user.roles.filter(name__in=ADMIN_ROLES).exists()):
        return qs.filter(projects__project_manager=user).distinct()

    return qs


# ---------------------------------------------------------------------------
# CRM — Clients
# ---------------------------------------------------------------------------

class ClientViewSet(viewsets.ModelViewSet):
    """
    Gestion des clients (CRM).

    Suppression interdite — utiliser l'action ``archive`` (Super-Admin uniquement).
    """
    queryset = Client.objects.all()
    filterset_fields = ['status', 'sector', 'assigned_to']
    search_fields = ['company_name', 'siret', 'email']
    ordering_fields = ['created_at', 'company_name', 'status']

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientListSerializer
        return ClientSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsCommercial)()]
        return [permissions.IsAuthenticated()]

    def destroy(self, request, *args, **kwargs):
        """Suppression interdite — utiliser l'action archive."""
        return Response(
            {'detail': 'Suppression interdite. Utilisez l\'action archive.'},
            status=status.HTTP_405_METHOD_NOT_ALLOWED,
        )

    def get_queryset(self):
        return _accessible_clients_qs(self.request.user)

    def perform_create(self, serializer):
        user = self.request.user
        is_commercial_only = (
            user.roles.filter(name=ROLE_COMMERCIAL).exists()
            and not user.roles.filter(name__in=ADMIN_ROLES).exists()
        )
        if is_commercial_only:
            # Un Commercial ne peut créer un client que pour lui-même.
            serializer.save(assigned_to=user)
        else:
            serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[IsSuperAdmin])
    def archive(self, request, pk=None):
        """Archive un client (Super-Admin uniquement)."""
        client = self.get_object()
        old_status = client.status
        client.status = Client.Status.ARCHIVE
        client.save()

        AuditLog.objects.log_action(
            user=request.user,
            action=f'CLIENT_ARCHIVE:{old_status}->ARCHIVE',
            entity_type='Client',
            entity_id=str(client.pk),
            details={'old_status': old_status},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response({'status': 'archived'})


# ---------------------------------------------------------------------------
# CRM — Interactions clients
# ---------------------------------------------------------------------------

class ClientInteractionViewSet(viewsets.ModelViewSet):
    """
    Interactions clients (nested sous /clients/{id}/interactions/).

    Verrouillage automatique après 24h.
    """
    serializer_class = ClientInteractionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        client_pk = self.kwargs.get('client_pk')
        if not _accessible_clients_qs(self.request.user).filter(pk=client_pk).exists():
            return ClientInteraction.objects.none()
        return ClientInteraction.objects.filter(
            client_id=client_pk
        ).order_by('-created_at')

    def perform_create(self, serializer):
        client_pk = self.kwargs.get('client_pk')
        if not _accessible_clients_qs(self.request.user).filter(pk=client_pk).exists():
            raise PermissionDenied("Vous n'avez pas accès à ce client.")
        client = get_object_or_404(Client, pk=client_pk)
        serializer.save(client=client, user=self.request.user)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_locked:
            return Response(
                {'detail': 'Modification bloquée après 24h.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.is_locked:
            return Response(
                {'detail': 'Modification bloquée après 24h.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        return super().partial_update(request, *args, **kwargs)


# ---------------------------------------------------------------------------
# CRM — Documents clients
# ---------------------------------------------------------------------------

class ClientDocumentViewSet(viewsets.ModelViewSet):
    """
    Documents clients (nested sous /clients/{id}/documents/).

    Les documents de type CONTRAT sont masqués aux rôles non autorisés.
    """
    serializer_class = ClientDocumentSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [
                permissions.IsAuthenticated(),
                (IsAdmin | IsDirecteurFinancier | IsCommercial)(),
            ]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        client_pk = self.kwargs.get('client_pk')
        user = self.request.user
        if not _accessible_clients_qs(user).filter(pk=client_pk).exists():
            return ClientDocument.objects.none()
        qs = ClientDocument.objects.filter(client_id=client_pk)

        # Masquer les CONTRAT aux rôles non autorisés
        if not user.roles.filter(
            name__in=[*ADMIN_ROLES, ROLE_DIRECTEUR_FINANCIER]
        ).exists():
            qs = qs.exclude(file_type=ClientDocument.FileType.CONTRAT)
        return qs

    def _check_write_scope(self, file_type):
        user = self.request.user
        is_admin_or_finance = user.roles.filter(
            name__in=[*ADMIN_ROLES, ROLE_DIRECTEUR_FINANCIER]
        ).exists()
        if is_admin_or_finance:
            return
        is_commercial = user.roles.filter(name=ROLE_COMMERCIAL).exists()
        if is_commercial and file_type == ClientDocument.FileType.DEVIS:
            return
        raise PermissionDenied(
            "Les commerciaux ne peuvent ajouter que des documents de type DEVIS."
        )

    def perform_create(self, serializer):
        client_pk = self.kwargs.get('client_pk')
        if not _accessible_clients_qs(self.request.user).filter(pk=client_pk).exists():
            raise PermissionDenied("Vous n'avez pas accès à ce client.")
        self._check_write_scope(serializer.validated_data.get('file_type'))
        client = get_object_or_404(Client, pk=client_pk)
        serializer.save(client=client, uploaded_by=self.request.user)

    def perform_update(self, serializer):
        self._check_write_scope(serializer.instance.file_type)
        serializer.save()


# ---------------------------------------------------------------------------
# RH — Documents employés
# ---------------------------------------------------------------------------

class EmployeeDocumentViewSet(viewsets.ModelViewSet):
    """
    Documents employés — accès strictement limité.

    - Super-Admin / Admin / Responsable RH : accès complet
    - Autres : uniquement leurs propres documents (lecture seule)
    """
    serializer_class = EmployeeDocumentSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsRHManager)()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = EmployeeDocument.objects.all()

        if user.roles.filter(name__in=HR_ROLES).exists():
            return qs
        # Tout autre utilisateur : seulement ses propres documents
        return qs.filter(user=user)


# ---------------------------------------------------------------------------
# RH — Congés
# ---------------------------------------------------------------------------

class LeaveRequestViewSet(viewsets.ModelViewSet):
    """
    Demandes de congés.

    - Création : tout employé (pour lui-même)
    - Validation/refus : Administration uniquement
    """
    queryset = LeaveRequest.objects.all()
    serializer_class = LeaveRequestSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Admin/RH voient toutes les demandes
        if user.roles.filter(name__in=HR_ROLES).exists():
            return qs
        return qs.filter(user=user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def approve(self, request, pk=None):
        """Approuver une demande de congé."""
        leave = self.get_object()
        if leave.status != LeaveRequest.Status.EN_ATTENTE:
            return Response(
                {'detail': 'Seules les demandes EN_ATTENTE peuvent être approuvées.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        leave.status = LeaveRequest.Status.APPROUVE
        leave.approved_by = request.user
        leave.save()
        return Response({'status': 'approved'})

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def reject(self, request, pk=None):
        """Rejeter une demande de congé."""
        leave = self.get_object()
        if leave.status != LeaveRequest.Status.EN_ATTENTE:
            return Response(
                {'detail': 'Seules les demandes EN_ATTENTE peuvent être rejetées.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        leave.status = LeaveRequest.Status.REJETE
        leave.approved_by = request.user
        leave.save()
        return Response({'status': 'rejected'})


# ---------------------------------------------------------------------------
# Actifs de l'entreprise
# ---------------------------------------------------------------------------

class CompanyAssetViewSet(viewsets.ModelViewSet):
    """
    Gestion des actifs de l'entreprise (matériel).

    Consultation libre, création/modification/assignation réservées aux Admin.
    """
    queryset = CompanyAsset.objects.all()
    serializer_class = CompanyAssetSerializer
    search_fields = ['asset_name', 'serial_number']

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'assign']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def assign(self, request, pk=None):
        """Assigner un actif à un utilisateur avec audit trail."""
        asset = self.get_object()
        user_id = request.data.get('user_id')
        old_holder_id = str(asset.current_holder_id) if asset.current_holder_id else None

        asset.current_holder_id = user_id
        asset.save()

        AuditLog.objects.log_action(
            user=request.user,
            action='ASSET_ASSIGN',
            entity_type='CompanyAsset',
            entity_id=str(asset.pk),
            details={
                'old_holder': old_holder_id,
                'new_holder': str(user_id),
            },
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response({'status': 'assigned'})


# ---------------------------------------------------------------------------
# Registre administratif
# ---------------------------------------------------------------------------

class AdministrativeRecordViewSet(viewsets.ModelViewSet):
    """
    Registre des PV, notes de service et décisions.

    Documents non publics visibles uniquement par Admin/Super-Admin.
    """
    serializer_class = AdministrativeRecordSerializer

    def get_permissions(self):
        if self.action in ['create', 'update', 'partial_update', 'destroy', 'finalize']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsSuperAdmin)()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = AdministrativeRecord.objects.all()
        user = self.request.user

        # Non-admins ne voient que les documents publics
        if not user.roles.filter(name__in=ADMIN_ROLES).exists():
            qs = qs.filter(is_public_internally=True)
        return qs

    @action(detail=True, methods=['post'], permission_classes=[IsAdmin])
    def finalize(self, request, pk=None):
        """Finaliser un registre (le rend inaltérable)."""
        record = self.get_object()
        record.is_finalized = True
        record.save()
        return Response({'status': 'finalized'})


# ---------------------------------------------------------------------------
# Générateur de contrats
# ---------------------------------------------------------------------------

class ContractGeneratorViewSet(viewsets.ModelViewSet):
    """
    Génération et gestion des contrats.

    - Admin : tous types de contrats
    - Commercial : NDA et PRESTATION_SERVICES uniquement
    - Modification bloquée après EN_ATTENTE_DE_SIGNATURE
    """
    queryset = ContractGenerator.objects.all()
    serializer_class = ContractGeneratorSerializer
    filterset_fields = ['contract_type', 'signing_status']

    def get_permissions(self):
        if self.action in ['create']:
            return [permissions.IsAuthenticated(), (IsAdmin | IsCommercial)()]
        if self.action in ['update', 'partial_update', 'destroy']:
            return [permissions.IsAuthenticated(), IsAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        # Admin/Finance voient tout
        if user.roles.filter(name__in=[*ADMIN_ROLES, ROLE_DIRECTEUR_FINANCIER]).exists():
            return qs

        # Commerciaux : contrats de leurs clients
        if user.roles.filter(name=ROLE_COMMERCIAL).exists():
            return qs.filter(client__assigned_to=user)

        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        contract_type = serializer.validated_data.get('contract_type')

        # Commerciaux limités aux NDA et PRESTATION_SERVICES
        if (user.roles.filter(name=ROLE_COMMERCIAL).exists()
                and not user.roles.filter(name__in=ADMIN_ROLES).exists()):
            allowed = [
                ContractGenerator.ContractType.NDA,
                ContractGenerator.ContractType.PRESTATION_SERVICES,
            ]
            if contract_type not in allowed:
                from rest_framework import serializers as s
                raise s.ValidationError(
                    'Les commerciaux ne peuvent créer que des NDA '
                    'et des contrats de prestation de services.'
                )
        serializer.save()

    @action(detail=True, methods=['post'], url_path='generate-pdf')
    def generate_pdf(self, request, pk=None):
        """Déclenche la génération PDF du contrat (placeholder Celery)."""
        contract = self.get_object()
        if contract.signing_status != ContractGenerator.SigningStatus.BROUILLON:
            return Response(
                {'detail': 'Le PDF ne peut être généré que pour un contrat en brouillon.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Placeholder — à remplacer par appel Celery
        contract.generated_file_path = f'/drive/contracts/{contract.pk}.pdf'
        contract.save()
        return Response({
            'status': 'pdf_generated',
            'path': contract.generated_file_path,
        })


# ---------------------------------------------------------------------------
# Webhook signature électronique (public, sans auth)
# ---------------------------------------------------------------------------

class SignatureWebhookView(APIView):
    """
    Webhook sécurisé pour mise à jour du statut de signature.

    Reçoit les callbacks du provider de signature électronique.
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        secret = getattr(settings, 'SIGNATURE_WEBHOOK_SECRET', '')
        if not secret:
            return Response(
                {'detail': 'Webhook non configuré.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        signature_header = request.META.get('HTTP_X_SIGNATURE', '')
        expected = hmac.new(
            secret.encode(), request.body, hashlib.sha256
        ).hexdigest()
        if not signature_header or not hmac.compare_digest(signature_header, expected):
            return Response(
                {'detail': 'Signature invalide.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        envelope_id = request.data.get('envelope_id')
        sig_status = request.data.get('status')

        if not envelope_id or not sig_status:
            return Response(
                {'detail': 'envelope_id et status requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            contract = ContractGenerator.objects.get(envelope_id=envelope_id)
        except ContractGenerator.DoesNotExist:
            return Response(
                {'detail': 'Contrat introuvable.'},
                status=status.HTTP_404_NOT_FOUND,
            )

        if sig_status == 'completed':
            contract.signing_status = ContractGenerator.SigningStatus.SIGNE
            contract.signed_at = timezone.now()
        elif sig_status in ('declined', 'voided'):
            contract.signing_status = ContractGenerator.SigningStatus.EXPIRE

        contract.save()

        AuditLog.objects.log_action(
            user=None,
            action=f'SIGNATURE_WEBHOOK:{sig_status}',
            entity_type='ContractGenerator',
            entity_id=str(contract.pk),
            details={'envelope_id': envelope_id, 'webhook_status': sig_status},
        )

        return Response({'status': 'ok'})
