import hashlib
import hmac

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import viewsets, status, permissions
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.utils import timezone

from core import calendar_sync
from core.models import AuditLog, EmailLog, Notification
from core.notifications import notify
from core.storage import upload_client_document
from core.constants import (
    ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_PROJECT_MANAGER,
    ROLE_DEVELOPER, ROLE_DIRECTEUR_FINANCIER, ROLE_COMMERCIAL,
    ROLE_RH_MANAGER, ROLE_SUPPORT_CLIENT, ADMIN_ROLES, HR_ROLES, FINANCE_ROLES,
)
from core.permissions import (
    IsSuperAdmin, IsAdmin, IsProjectManager,
    IsDirecteurFinancier, IsCommercial, IsRHManager,
    IsOwner, IsAdminOrReadOnly, ReadOnly,
)

from .models import (
    Client, Contact, ClientInteraction, ClientDocument, EmployeeDocument,
    LeaveRequest, CompanyAsset, AdministrativeRecord, ContractGenerator, Appointment,
    Meeting, MeetingNote,
)
from .serializers import (
    ClientSerializer, ClientListSerializer, ContactSerializer, ClientInteractionSerializer,
    ClientDocumentSerializer, EmployeeDocumentSerializer, LeaveRequestSerializer,
    CompanyAssetSerializer, AdministrativeRecordSerializer, ContractGeneratorSerializer,
    AppointmentSerializer, MeetingSerializer, MeetingNoteSerializer,
)


def _accessible_clients_qs(user):
    """
    Clients visibles par cet utilisateur.

    Admin/Super-Admin et Support Client (cahier des charges §4.8, "accès
    aux tickets, base de connaissances, et fiches clients", non scopé) :
    tous les clients. Commercial : ses clients assignés. Chef de Projet :
    clients liés à ses projets. Tout le reste (Directeur Financier,
    Comptable, RH, Développeur, Consultant, Marketing, ou pas de rôle du
    tout) : aucun — le module "clients" ne figure pas dans leur périmètre
    déclaré (core.constants.DEFAULT_ROLE_PERMISSIONS).

    Corrige le pentest du 24/09/2026 : la version précédente renvoyait
    TOUS les clients par défaut dès qu'un rôle ne correspondait à aucun des
    deux cas scopés — un Consultant ou un utilisateur sans rôle lisait donc
    l'intégralité du fichier clients (SIRET, email, notes, assigné).
    """
    if user.roles.filter(name__in=[*ADMIN_ROLES, ROLE_SUPPORT_CLIENT]).exists():
        return Client.objects.all()

    accessible = Client.objects.none()
    if user.roles.filter(name=ROLE_COMMERCIAL).exists():
        accessible |= Client.objects.filter(assigned_to=user)
    if user.roles.filter(name=ROLE_PROJECT_MANAGER).exists():
        accessible |= Client.objects.filter(projects__project_manager=user)
    return accessible.distinct()


# ---------------------------------------------------------------------------
# CRM — Clients
# ---------------------------------------------------------------------------

# Rôles ayant une raison d'accéder au module clients, ne serait-ce que de
# façon scopée — le reste (Directeur Financier, Comptable, RH, Développeur,
# Consultant, Marketing, pas de rôle) n'y figure dans aucune entrée de
# core.constants.DEFAULT_ROLE_PERMISSIONS et ne doit donc jamais recevoir
# qu'un refus explicite plutôt qu'une liste vide silencieuse.
CLIENT_ACCESS_ROLES = [*ADMIN_ROLES, ROLE_SUPPORT_CLIENT, ROLE_COMMERCIAL, ROLE_PROJECT_MANAGER]


class IsHasClientAccess(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.roles.filter(name__in=CLIENT_ACCESS_ROLES).exists()


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
        # Pentest du 24/09/2026 : list/retrieve ne demandaient qu'un compte
        # authentifié, en s'appuyant uniquement sur get_queryset pour filtrer
        # — un rôle hors périmètre (Consultant, Développeur, sans rôle...)
        # recevait un 200 vide plutôt qu'un refus explicite, et un accès
        # direct par id à la fiche de quelqu'un d'autre n'était bloqué que
        # par le filtrage de queryset. IsHasClientAccess rend le refus
        # explicite (403) en plus du filtrage déjà en place.
        return [permissions.IsAuthenticated(), IsHasClientAccess()]

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
        """Marque un client inactif (Super-Admin uniquement). Nom d'action
        conservé (le frontend appelle déjà /archive/) — sémantique mise à
        jour pour les 2 statuts actuels (plus d'ARCHIVE distinct)."""
        client = self.get_object()
        old_status = client.status
        client.status = Client.Status.CLIENT_INACTIF
        client.save()

        AuditLog.objects.log_action(
            user=request.user,
            action=f'CLIENT_ARCHIVE:{old_status}->CLIENT_INACTIF',
            entity_type='Client',
            entity_id=str(client.pk),
            details={'old_status': old_status},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response({'status': 'archived'})

    @action(detail=True, methods=['get'], url_path='emails')
    def emails(self, request, pk=None):
        """E-mails envoyés par l'application à ce client — retrouvés par
        adresse (celle de la fiche et celles de ses contacts) dans EmailLog,
        qui ne référence pas Client directement."""
        client = self.get_object()
        addresses = {a.lower() for a in [client.email, *client.contacts.values_list('email', flat=True)] if a}
        logs = EmailLog.objects.filter(recipient__in=addresses)[:200]
        return Response([
            {
                'id': str(log.id),
                'recipient': log.recipient,
                'subject': log.subject,
                'template_key': log.template_key,
                'success': log.success,
                'created_at': log.created_at,
            }
            for log in logs
        ])


# ---------------------------------------------------------------------------
# CRM — Contacts
# ---------------------------------------------------------------------------

class ContactViewSet(viewsets.ModelViewSet):
    """Interlocuteurs d'un client (nested sous /clients/{id}/contacts/)."""
    serializer_class = ContactSerializer

    def get_queryset(self):
        client_pk = self.kwargs.get('client_pk')
        if not _accessible_clients_qs(self.request.user).filter(pk=client_pk).exists():
            return Contact.objects.none()
        return Contact.objects.filter(client_id=client_pk)

    def perform_create(self, serializer):
        client_pk = self.kwargs.get('client_pk')
        if not _accessible_clients_qs(self.request.user).filter(pk=client_pk).exists():
            raise PermissionDenied("Vous n'avez pas accès à ce client.")
        client = get_object_or_404(Client, pk=client_pk)
        serializer.save(client=client)


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

    create() est entièrement réécrit : avant, le client uploadait le fichier
    à part (endpoint générique pièce-jointe chat) puis postait l'URL signée
    obtenue comme `file_path` — cette URL expirait en silence après 7 jours
    (LONG_SIGNED_URL_TTL_SECONDS), sans renouvellement. Le fichier est
    maintenant reçu ici directement (multipart), stocké via
    core.storage.upload_client_document (qui retourne un CHEMIN, pas une
    URL), resigné à la demande par ClientDocumentSerializer.get_url — même
    principe que ProjectDocument (backend/projects/).
    """
    serializer_class = ClientDocumentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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

    def create(self, request, *args, **kwargs):
        client_pk = self.kwargs.get('client_pk')
        if not _accessible_clients_qs(request.user).filter(pk=client_pk).exists():
            raise PermissionDenied("Vous n'avez pas accès à ce client.")

        file_type = request.data.get('file_type')
        self._check_write_scope(file_type)

        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'detail': 'Fichier manquant.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            storage_path = upload_client_document(uploaded, client_pk)
        except DjangoValidationError as exc:
            return Response({'detail': exc.messages[0] if exc.messages else str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        client = get_object_or_404(Client, pk=client_pk)
        is_sensitive = str(request.data.get('is_sensitive', '')).lower() in ('true', '1')
        document = ClientDocument.objects.create(
            client=client,
            name=request.data.get('name') or uploaded.name,
            file_path=storage_path,
            file_type=file_type,
            uploaded_by=request.user,
            is_sensitive=is_sensitive,
        )
        return Response(self.get_serializer(document).data, status=status.HTTP_201_CREATED)

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


class PayrollValidationView(APIView):
    """
    Passerelle externe (cahier des charges §2 — "Validation du Module Paie").

    La paie est produite par le module RH externe (``hr.Payslip``), hors
    périmètre du département Administration. Ce point de contact est la
    seule responsabilité d'Administration dans ce flux : sur déclenchement
    d'un membre du pôle, importer en masse les bulletins d'une période
    (déjà générés côté RH) dans ``EmployeeDocument`` (point 2.5), pour
    centraliser l'accès collaborateur au même endroit que ses autres
    documents RH.

    N'implémente PAS la génération du PDF ni son chiffrement — ``hr.Payslip.
    file_url`` est déjà produit par le module externe ; seul le nom stocké
    dans ``EmployeeDocument`` est chiffré (AES, cf. modèle), cohérent avec
    le reste du dossier RH.
    """
    permission_classes = [permissions.IsAuthenticated, (IsAdmin | IsRHManager)]

    def post(self, request):
        from hr.models import Payslip

        month = request.data.get('period_month')
        year = request.data.get('period_year')
        if not month or not year:
            return Response(
                {'detail': 'period_month et period_year requis.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        payslips = Payslip.objects.filter(
            period_month=month, period_year=year,
        ).select_related('employee__user')

        created = []
        for payslip in payslips:
            target_user = payslip.employee.user
            exists = EmployeeDocument.objects.filter(
                user=target_user,
                document_type=EmployeeDocument.DocumentType.FICHE_PAIE,
                file_path=payslip.file_url,
            ).exists()
            if exists:
                continue
            doc = EmployeeDocument.objects.create(
                user=target_user,
                document_name=f'Fiche de paie {month}/{year}',
                file_path=payslip.file_url,
                document_type=EmployeeDocument.DocumentType.FICHE_PAIE,
            )
            created.append(str(doc.pk))

        AuditLog.objects.log_action(
            user=request.user,
            action='PAYROLL_VALIDATION_IMPORT',
            entity_type='EmployeeDocument',
            entity_id=f'{year}-{month}',
            details={'period_month': month, 'period_year': year, 'imported': len(created)},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response({'status': 'validated', 'imported_count': len(created)})


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
# Agenda — rendez-vous
# ---------------------------------------------------------------------------

class AppointmentViewSet(viewsets.ModelViewSet):
    """
    Agenda — chacun voit ses propres rendez-vous (créés par lui ou où il est
    participant) ; Admin/Super-Admin voient tout.
    """
    serializer_class = AppointmentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['client']

    def get_queryset(self):
        user = self.request.user
        qs = Appointment.objects.select_related('client', 'created_by').prefetch_related('attendees')
        if user.roles.filter(name__in=ADMIN_ROLES).exists():
            return qs.distinct()
        from django.db.models import Q
        return qs.filter(Q(created_by=user) | Q(attendees=user)).distinct()

    def perform_create(self, serializer):
        appointment = serializer.save(created_by=self.request.user)
        # Le créateur est toujours participant, même s'il a oublié de se
        # sélectionner lui-même dans la liste des participants.
        appointment.attendees.add(self.request.user)
        calendar_sync.sync_appointment_event(appointment)
        self._notify_invited(appointment, appointment.attendees.exclude(pk=self.request.user.pk))

    def perform_update(self, serializer):
        previous_ids = set(serializer.instance.attendees.values_list('pk', flat=True))
        appointment = serializer.save()
        calendar_sync.sync_appointment_event(appointment)
        new_attendees = appointment.attendees.exclude(pk__in=previous_ids).exclude(pk=self.request.user.pk)
        self._notify_invited(appointment, new_attendees)

    def _notify_invited(self, appointment, users):
        """Invitation : in-app + push + e-mail (un rendez-vous s'adresse aussi
        à quelqu'un qui n'est pas devant l'application)."""
        when = timezone.localtime(appointment.start_at).strftime('%d/%m/%Y à %H:%M')
        organizer = self.request.user
        organizer_name = f'{organizer.first_name} {organizer.last_name}'.strip() or organizer.email
        for user in users:
            notify(
                user=user,
                title=f'Invitation : {appointment.title}',
                message=f'{organizer_name} vous invite le {when}'
                + (f' — {appointment.location}' if appointment.location else '') + '.',
                notification_type='FOLLOW_UP',
                link='/admin/agenda',
                email=True,
            )

    def perform_destroy(self, instance):
        user = self.request.user
        is_admin = user.roles.filter(name__in=ADMIN_ROLES).exists()
        if not is_admin and instance.created_by_id != user.id:
            raise PermissionDenied("Seul le créateur ou un administrateur peut supprimer ce rendez-vous.")
        calendar_sync.delete_appointment_event(instance)
        instance.delete()

    @action(detail=True, methods=['get', 'patch'], url_path='meeting')
    def meeting(self, request, pk=None):
        """Transforme ce rendez-vous en réunion (créée à la demande, une
        seule fois — OneToOne) ou renvoie la réunion existante."""
        appointment = self.get_object()
        meeting_obj, _ = Meeting.objects.get_or_create(appointment=appointment)
        if request.method == 'PATCH':
            serializer = MeetingSerializer(meeting_obj, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(MeetingSerializer(meeting_obj).data)

    @action(detail=True, methods=['get', 'put'], url_path='meeting/my-note')
    def meeting_my_note(self, request, pk=None):
        """Notes personnelles du participant courant sur cette réunion —
        chacun ne voit/modifie que les siennes via cet endpoint."""
        appointment = self.get_object()
        meeting_obj, _ = Meeting.objects.get_or_create(appointment=appointment)
        note, _ = MeetingNote.objects.get_or_create(meeting=meeting_obj, author=request.user)
        if request.method == 'PUT':
            serializer = MeetingNoteSerializer(note, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data)
        return Response(MeetingNoteSerializer(note).data)


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
        client = serializer.validated_data.get('client')

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
            # Pentest du 24/09/2026 : rien ne vérifiait que le client
            # choisi appartient bien à ce commercial — il pouvait créer un
            # contrat (document juridique) rattaché au client d'un autre.
            if client and not _accessible_clients_qs(user).filter(pk=client.pk).exists():
                raise PermissionDenied("Vous n'avez pas accès à ce client.")
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
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'webhook'

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
