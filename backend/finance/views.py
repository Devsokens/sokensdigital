from decimal import Decimal

import logging

from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, permissions, status, viewsets, serializers
from django.http import FileResponse
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from core.constants import ROLE_RESPONSABLE_ADMINISTRATIF, ROLE_SUPER_ADMIN, ROLE_PROJECT_MANAGER, ROLE_COMPTABLE, ROLE_CAISSIER
from core.notifications import notify, notify_roles
from core.permissions import gerant_recipients, has_role, is_gerant, is_subcontractor_only
from core.storage import upload_disbursement_quote
from decimal import Decimal as D
from django.utils import timezone
from finance.models import (
    Account,
    FinanceSettings,
    AccountingPeriod,
    BankStatementImport,
    BankTransaction,
    DisbursementQuote,
    DisbursementRequest,
    Invoice,
    JournalEntry,
    Payment,
    PaymentReceipt,
    TaxDeclaration,
    TransactionLine,
)
from finance.serializers import (
    AccountingPeriodSerializer,
    AccountSerializer,
    BankStatementImportSerializer,
    BankTransactionSerializer,
    DisbursementQuoteSerializer,
    DisbursementRequestListSerializer,
    DisbursementRequestSerializer,
    InvoiceSerializer,
    JournalEntrySerializer,
    PaymentSerializer,
    PaymentReceiptSerializer,
    TaxDeclarationSerializer,
)

CHEF_DE_PROJET_ROLES = (ROLE_PROJECT_MANAGER,)
COMPTABLE_ROLES = (ROLE_COMPTABLE,)
FINANCE_READ_ROLES = (ROLE_COMPTABLE,)
logger = logging.getLogger(__name__)


def _can_decide_stage(user, pending_status, disbursement=None):
    """Circuit fixe RCF puis Gérant (process comptable et financier,
    "Demande de décaissement") — aucun seuil de montant. Comptable et
    Comptable tiennent lieu de RCF (même convention que
    procurement.views.IsManagerOrAdmin) ; Super-Admin tient lieu de
    Gérant."""
    # Signataire figé sur la demande (en poste à sa création) : lui seul.
    if pending_status == DisbursementRequest.Status.EN_ATTENTE_RCF:
        if disbursement is not None and disbursement.assigned_rcf_id:
            return disbursement.assigned_rcf_id == user.id
        # Demande antérieure ou aucun responsable désigné à sa création.
        return has_role(user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN)
    if disbursement is not None and disbursement.assigned_gerant_id:
        return disbursement.assigned_gerant_id == user.id
    return is_gerant(user)


BESOINS_LINK = '/admin/technique/decaissements'  # suivi côté demandeur
DECAISSEMENTS_LINK = '/admin/finance/decaissements'  # validation (Comptable, Gérant)


def _besoin_label(disbursement):
    return f'{disbursement.reference or "Besoin"} — {disbursement.beneficiary} ({disbursement.amount:,.0f} FCFA)'.replace(',', ' ')


def _notify_besoin_stage(disbursement, exclude=None):
    """Prévient ceux qui doivent statuer à l'étape en cours : la RCF
    (Comptable) puis le Gérant (Super-Admin)."""
    if disbursement.status == DisbursementRequest.Status.EN_ATTENTE_RCF and disbursement.assigned_rcf_id:
        if disbursement.assigned_rcf_id != getattr(exclude, 'pk', None):
            notify(
                user=disbursement.assigned_rcf, title='Nouveau besoin à examiner', message=_besoin_label(disbursement),
                notification_type='GENERAL', link=DECAISSEMENTS_LINK,
            )
        return
    if disbursement.status == DisbursementRequest.Status.EN_ATTENTE_GERANT and disbursement.assigned_gerant_id:
        if disbursement.assigned_gerant_id != getattr(exclude, 'pk', None):
            notify(
                user=disbursement.assigned_gerant, title='Besoin à valider (Gérant)', message=_besoin_label(disbursement),
                notification_type='GENERAL', link=DECAISSEMENTS_LINK,
            )
        return
    if disbursement.status == DisbursementRequest.Status.EN_ATTENTE_RCF:
        notify_roles(
            (ROLE_COMPTABLE,), title='Nouveau besoin à examiner',
            message=_besoin_label(disbursement), notification_type='GENERAL', link=DECAISSEMENTS_LINK,
            exclude=[exclude, disbursement.requested_by],
        )
        return
    excluded = {getattr(u, 'pk', None) for u in (exclude, disbursement.requested_by) if u}
    for user in gerant_recipients():
        if user.pk in excluded:
            continue
        notify(
            user=user, title='Besoin à valider (Gérant)', message=_besoin_label(disbursement),
            notification_type='GENERAL', link=DECAISSEMENTS_LINK,
        )


def _notify_besoin_requester(disbursement):
    """Décision finale ou exécution : le demandeur est prévenu, e-mail
    compris (il n'est pas forcément devant l'application)."""
    if not disbursement.requested_by:
        return
    titles = {
        DisbursementRequest.Status.APPROUVE: 'Besoin approuvé',
        DisbursementRequest.Status.REJETE: 'Besoin rejeté',
        DisbursementRequest.Status.EXECUTE: 'Besoin exécuté',
    }
    title = titles.get(disbursement.status)
    if not title:
        return
    message = _besoin_label(disbursement)
    if disbursement.status == DisbursementRequest.Status.REJETE and disbursement.rejection_reason:
        message += f'. Motif : {disbursement.rejection_reason}'
    notify(
        user=disbursement.requested_by, title=title, message=message,
        notification_type='GENERAL', link=BESOINS_LINK, email=True,
    )


# Un encaissement suppose une facture validée : la validation passe
# l'écriture des ventes (411/706/TVA/CSS) ; encaisser un brouillon laissait
# une facture payée sans écriture.
VALIDATE_BEFORE_PAYMENT = "Validez d'abord la facture (écriture comptable) avant d'enregistrer un paiement."


class CanInitiateDisbursement(permissions.BasePermission):
    """Initiation d'un besoin : tout employé (rattachement à un projet
    contrôlé dans perform_create). N2/N3 final approval and execution are separate actions
    below, with their own permission checks — this class only gates
    list/retrieve/create."""

    def has_permission(self, request, view):
        # Chaque département exprime ses besoins depuis sa propre interface :
        # tout employé connecté et actif peut créer une demande et voir les
        # siennes. Ce qu'il voit est borné par get_queryset (ses demandes,
        # son département, les projets qu'il dirige) ; la validation reste
        # réservée au Comptable puis au Gérant (action approve).
        user = request.user
        if not (user and user.is_authenticated and user.is_active):
            return False
        # Sous-traitants : aucune visibilité sur les finances.
        return not is_subcontractor_only(user)


@extend_schema_view(
    list=extend_schema(
        tags=['Finance & Comptabilité'],
        summary='List disbursement requests',
        description='Chef de Projet sees requests for projects they lead; Comptable/Super-Admin see everything.',
    ),
    create=extend_schema(tags=['Finance & Comptabilité'], summary='Initiate a disbursement request (N1)', description='Chef de Projet only, for a project they lead.'),
    retrieve=extend_schema(tags=['Finance & Comptabilité'], summary='Get a disbursement request'),
)
class DisbursementRequestViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    serializer_class = DisbursementRequestSerializer
    permission_classes = [CanInitiateDisbursement]

    def get_serializer_class(self):
        if self.action == 'list':
            return DisbursementRequestListSerializer
        return DisbursementRequestSerializer

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return DisbursementRequest.objects.none()
        qs = DisbursementRequest.objects.select_related(
            'project', 'requested_by', 'beneficiary_user', 'rcf_decided_by', 'decided_by', 'executed_by',
            'department',
        ).prefetch_related('lines', 'quotes')
        user = self.request.user
        if has_role(user, *FINANCE_READ_ROLES, ROLE_SUPER_ADMIN) or is_gerant(user):
            scoped = qs
        else:
            # Interface « Besoins » d'un département : ses propres demandes,
            # celles des projets qu'il dirige et celles de son département.
            visible = Q(project__lead_project_manager=user) | Q(requested_by=user)
            if user.department_id:
                visible |= Q(department_id=user.department_id)
            scoped = qs.filter(visible).distinct()
        # ?scope=department : vue département (mes besoins et ceux du département),
        # même pour les rôles finance qui voient tout ailleurs.
        if self.request.query_params.get('scope') == 'department':
            mine = Q(requested_by=user)
            if user.department_id:
                mine |= Q(department_id=user.department_id)
            scoped = scoped.filter(mine).distinct()
        return scoped

    def perform_create(self, serializer):
        project = serializer.validated_data.get('project')
        if project:
            from rest_framework.exceptions import PermissionDenied, ValidationError
            # Un besoin peut survenir à tout moment de la vie du projet
            # (lancé, en cours d'exécution, en pause, même terminé pour une
            # dépense de clôture) — seul un projet annulé est refusé.
            if project.status == project.Status.ANNULE:
                raise ValidationError({'project_id': 'Ce projet est annulé : aucun besoin ne peut lui être rattaché.'})
            # Qui peut rattacher : le chef de projet, un membre de l'équipe
            # du projet, ou un Admin/Super-Admin.
            user = self.request.user
            allowed = (
                project.lead_project_manager_id == user.id
                or project.memberships.filter(user=user).exists()
                or has_role(user, ROLE_RESPONSABLE_ADMINISTRATIF, ROLE_SUPER_ADMIN)
            )
            if not allowed:
                raise PermissionDenied("Seuls le chef de projet et les membres de l'équipe du projet peuvent lui rattacher un besoin.")
        from core.models import User as _User
        disbursement = serializer.save(
            requested_by=self.request.user,
            department=self.request.user.department,
            assigned_rcf=_User.objects.filter(is_rcf=True, is_active=True).first(),
            assigned_gerant=_User.objects.filter(is_gerant=True, is_active=True).first(),
            status=DisbursementRequest.Status.EN_ATTENTE_RCF,
        )
        _notify_besoin_stage(disbursement, exclude=self.request.user)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Give validation to a disbursement request',
        description="Circuit fixe, sans seuil de montant : la RCF (Comptable ou "
        "Comptable) examine d'abord — approuver transmet au Gérant "
        "(Super-Admin), rejeter clôture la demande. Le Gérant statue ensuite en "
        "dernier ressort. Rejeter exige `rejection_reason`.",
        request={'application/json': {'type': 'object', 'properties': {
            'decision': {'type': 'string', 'enum': ['APPROUVE', 'REJETE']},
            'rejection_reason': {'type': 'string'},
        }}},
        responses={200: DisbursementRequestSerializer},
    )
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def approve(self, request, pk=None):
        disbursement = self.get_object()
        if disbursement.status not in DisbursementRequest.PENDING_STATUSES:
            return Response({'detail': 'Cette demande a déjà été traitée.'}, status=status.HTTP_400_BAD_REQUEST)
        if not _can_decide_stage(request.user, disbursement.status, disbursement):
            return Response(status=status.HTTP_403_FORBIDDEN)
        # Séparation des tâches (pentest du 24/09/2026, F1) : quelqu'un qui
        # cumule le rôle demandeur et un rôle d'approbation (ex: Chef de
        # Projet qui est aussi Comptable) ne doit jamais pouvoir valider sa
        # propre demande, à aucun des deux paliers.
        if disbursement.requested_by_id == request.user.id:
            return Response(
                {'detail': 'Vous ne pouvez pas approuver votre propre demande.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        decision = request.data.get('decision')
        if decision not in ('APPROUVE', 'REJETE'):
            return Response({'detail': 'decision doit être APPROUVE ou REJETE.'}, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = (request.data.get('rejection_reason') or '').strip()
        if decision == 'REJETE' and not rejection_reason:
            return Response({'detail': 'Un motif de rejet est obligatoire.'}, status=status.HTTP_400_BAD_REQUEST)

        at_rcf_stage = disbursement.status == DisbursementRequest.Status.EN_ATTENTE_RCF

        # Approuver = signer : signature manuscrite obligatoire, reprise sur
        # le bon de demande PDF (Comptable puis Gérant).
        signature_url = ''
        if decision == 'APPROUVE':
            from django.core.exceptions import ValidationError as DjangoValidationError
            from core.signatures import decode_signature_image
            from core.storage import upload_image
            signature = request.data.get('signature')
            if not signature:
                return Response({'detail': 'Votre signature est requise pour approuver.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                signature_url = upload_image(decode_signature_image(signature), 'besoin-signatures')
            except DjangoValidationError:
                return Response({'detail': 'Signature invalide.'}, status=status.HTTP_400_BAD_REQUEST)
            except Exception:
                logger.exception('Signature du besoin %s non enregistrée', disbursement.pk)
                return Response({'detail': "Impossible d'enregistrer la signature. Réessayez."}, status=status.HTTP_502_BAD_GATEWAY)

        if decision == 'REJETE':
            disbursement.status = DisbursementRequest.Status.REJETE
            disbursement.rejection_reason = rejection_reason
        elif at_rcf_stage:
            # La RCF approuve : la demande passe au Gérant, elle n'est pas
            # encore définitivement approuvée — c'est lui qui statue en
            # dernier ressort (process comptable, "Demande de décaissement").
            disbursement.status = DisbursementRequest.Status.EN_ATTENTE_GERANT
        else:
            disbursement.status = DisbursementRequest.Status.APPROUVE

        update_fields = ['status', 'rejection_reason']
        if at_rcf_stage:
            disbursement.rcf_decided_by = request.user
            disbursement.rcf_decided_at = timezone.now()
            disbursement.rcf_signature_url = signature_url
            update_fields += ['rcf_decided_by', 'rcf_decided_at', 'rcf_signature_url']
        else:
            disbursement.decided_by = request.user
            disbursement.decided_at = timezone.now()
            disbursement.gerant_signature_url = signature_url
            update_fields += ['decided_by', 'decided_at', 'gerant_signature_url']

        disbursement.save(update_fields=update_fields)
        if disbursement.status == DisbursementRequest.Status.EN_ATTENTE_GERANT:
            _notify_besoin_stage(disbursement, exclude=request.user)
        else:
            _notify_besoin_requester(disbursement)
        return Response(DisbursementRequestSerializer(disbursement).data)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Mark a disbursement request as executed (§4.2)',
        description='Comptable/Super-Admin only, once approved — records that the money actually moved.',
        responses={200: DisbursementRequestSerializer},
    )
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def execute(self, request, pk=None):
        if not has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)
        disbursement = self.get_object()
        if disbursement.status != DisbursementRequest.Status.APPROUVE:
            return Response({'detail': 'Seule une demande approuvée peut être exécutée.'}, status=status.HTTP_400_BAD_REQUEST)
        disbursement.status = DisbursementRequest.Status.EXECUTE
        disbursement.executed_by = request.user
        disbursement.executed_at = timezone.now()
        disbursement.save(update_fields=['status', 'executed_by', 'executed_at'])
        _notify_besoin_requester(disbursement)
        return Response(DisbursementRequestSerializer(disbursement).data)

    def _can_edit_quotes(self, user, disbursement):
        """Les devis se joignent/retirent par le demandeur (ou un
        Super-Admin) tant que la demande n'est pas tranchée."""
        is_owner = disbursement.requested_by_id == user.id or has_role(user, ROLE_SUPER_ADMIN)
        return is_owner and disbursement.status in DisbursementRequest.PENDING_STATUSES

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='List / attach quotes to a disbursement request',
        request={'multipart/form-data': {'type': 'object', 'properties': {'file': {'type': 'string', 'format': 'binary'}}}},
        responses={200: DisbursementQuoteSerializer(many=True), 201: DisbursementQuoteSerializer},
    )
    @action(
        detail=True, methods=['get', 'post'], url_path='quotes',
        permission_classes=[permissions.IsAuthenticated], parser_classes=[MultiPartParser, FormParser, JSONParser],
    )
    def quotes(self, request, pk=None):
        disbursement = self.get_object()
        if request.method == 'POST':
            if not self._can_edit_quotes(request.user, disbursement):
                return Response(status=status.HTTP_403_FORBIDDEN)
            uploaded = request.FILES.get('file')
            if not uploaded:
                return Response({'detail': 'Fichier manquant.'}, status=status.HTTP_400_BAD_REQUEST)
            try:
                storage_path = upload_disbursement_quote(uploaded, str(disbursement.id))
            except DjangoValidationError as exc:
                return Response({'detail': exc.messages[0] if exc.messages else str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            quote = DisbursementQuote.objects.create(
                request=disbursement, storage_path=storage_path,
                original_filename=uploaded.name, uploaded_by=request.user,
            )
            return Response(DisbursementQuoteSerializer(quote).data, status=status.HTTP_201_CREATED)
        return Response(DisbursementQuoteSerializer(disbursement.quotes.all(), many=True).data)

    @extend_schema(tags=['Finance & Comptabilité'], summary='Remove a quote from a disbursement request')
    @action(
        detail=True, methods=['delete'], url_path=r'quotes/(?P<quote_id>[^/.]+)',
        permission_classes=[permissions.IsAuthenticated],
    )
    def delete_quote(self, request, pk=None, quote_id=None):
        disbursement = self.get_object()
        if not self._can_edit_quotes(request.user, disbursement):
            return Response(status=status.HTTP_403_FORBIDDEN)
        quote = disbursement.quotes.filter(id=quote_id).first()
        if not quote:
            return Response(status=status.HTTP_404_NOT_FOUND)
        quote.delete(user=request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Bon de demande (PDF)',
        description='Affiché dans le navigateur, ou téléchargé avec `?download=1`. '
        'Visible par toute personne qui voit la demande.',
    )
    @action(detail=True, methods=['get'], url_path='pdf', permission_classes=[permissions.IsAuthenticated])
    def pdf(self, request, pk=None):
        from treasury.pdf import generate_disbursement_request_pdf
        disbursement = self.get_object()
        try:
            pdf_file = generate_disbursement_request_pdf(disbursement)
        except ImportError:
            return Response(
                {'detail': "La génération PDF n'est pas disponible sur ce serveur."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        download = request.query_params.get('download') in ('1', 'true')
        return FileResponse(
            pdf_file,
            as_attachment=download,
            filename=f'{disbursement.reference or disbursement.id}.pdf',
            content_type='application/pdf',
        )


class IsComptableOrSuperAdmin(permissions.BasePermission):
    """§4.1 "Clôture comptable": "Seul rôle, avec le Super-Admin, habilité à
    ouvrir ou verrouiller définitivement des exercices". Read access is
    wider (Comptable needs to know whether a period is open)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return has_role(request.user, *FINANCE_READ_ROLES, ROLE_SUPER_ADMIN)
        return has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN)


@extend_schema_view(
    list=extend_schema(tags=['Finance & Comptabilité'], summary='List accounting periods'),
    create=extend_schema(tags=['Finance & Comptabilité'], summary='Create an accounting period', description='Comptable/Super-Admin only.'),
    retrieve=extend_schema(tags=['Finance & Comptabilité'], summary='Get an accounting period'),
)
class AccountingPeriodViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = AccountingPeriod.objects.select_related('closed_by')
    serializer_class = AccountingPeriodSerializer
    permission_classes = [IsComptableOrSuperAdmin]

    @extend_schema(tags=['Finance & Comptabilité'], summary='Close (lock) an accounting period', responses={200: AccountingPeriodSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsComptableOrSuperAdmin])
    def close(self, request, pk=None):
        period = self.get_object()
        period.status = AccountingPeriod.Status.CLOTUREE
        period.closed_by = request.user
        period.closed_at = timezone.now()
        period.save(update_fields=['status', 'closed_by', 'closed_at'])
        return Response(AccountingPeriodSerializer(period).data)

    @extend_schema(tags=['Finance & Comptabilité'], summary='Reopen a closed accounting period', responses={200: AccountingPeriodSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsComptableOrSuperAdmin])
    def reopen(self, request, pk=None):
        period = self.get_object()
        period.status = AccountingPeriod.Status.OUVERTE
        period.closed_by = None
        period.closed_at = None
        period.save(update_fields=['status', 'closed_by', 'closed_at'])
        return Response(AccountingPeriodSerializer(period).data)


class IsFinanceRole(permissions.BasePermission):
    def has_permission(self, request, view):
        return has_role(request.user, *FINANCE_READ_ROLES, ROLE_SUPER_ADMIN)


@extend_schema_view(
    list=extend_schema(tags=['Finance & Comptabilité'], summary='List chart-of-accounts entries'),
    create=extend_schema(tags=['Finance & Comptabilité'], summary='Create an account'),
    retrieve=extend_schema(tags=['Finance & Comptabilité'], summary='Get an account'),
    update=extend_schema(tags=['Finance & Comptabilité'], summary='Update an account'),
    partial_update=extend_schema(tags=['Finance & Comptabilité'], summary='Partially update an account'),
    destroy=extend_schema(tags=['Finance & Comptabilité'], summary='Delete an account'),
)
class AccountViewSet(viewsets.ModelViewSet):
    """Simplified chart of accounts — not the full OHADA/PCG plan comptable,
    just enough to post balanced entries (see finance.models.Account)."""

    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_classes = [IsFinanceRole]


@extend_schema_view(
    list=extend_schema(tags=['Finance & Comptabilité'], summary='List journal entries (Grand Livre)'),
    create=extend_schema(tags=['Finance & Comptabilité'], summary='Post a journal entry', description='Comptable/Super-Admin only, and only on an open accounting period.'),
    retrieve=extend_schema(tags=['Finance & Comptabilité'], summary='Get a journal entry'),
)
class JournalEntryViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Immutable once posted, by design — same reasoning as AuditLog: no
    update/destroy actions. Corrections go through a new counter-entry, not
    an edit (docs/backend-specifications.md §4.2)."""

    queryset = JournalEntry.objects.select_related('period', 'created_by', 'source_invoice').prefetch_related('lines__account')
    serializer_class = JournalEntrySerializer
    permission_classes = [IsFinanceRole]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return JournalEntry.objects.none()
        return super().get_queryset()

    def create(self, request, *args, **kwargs):
        if not has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


@extend_schema_view(
    list=extend_schema(tags=['Finance & Comptabilité'], summary='List invoices'),
    create=extend_schema(tags=['Finance & Comptabilité'], summary='Create a draft invoice'),
    retrieve=extend_schema(tags=['Finance & Comptabilité'], summary='Get an invoice'),
    update=extend_schema(tags=['Finance & Comptabilité'], summary='Update an invoice', description='BROUILLON only.'),
    partial_update=extend_schema(tags=['Finance & Comptabilité'], summary='Partially update an invoice'),
    destroy=extend_schema(tags=['Finance & Comptabilité'], summary='Delete a draft invoice'),
)
class InvoiceViewSet(viewsets.ModelViewSet):
    serializer_class = InvoiceSerializer
    permission_classes = [IsFinanceRole]

    def get_queryset(self):
        # Une requête pour toute la liste : client, devis + lead (adresses
        # d'envoi), période d'abonnement, et le payé agrégé en SQL au lieu
        # d'un SUM par facture.
        qs = Invoice.objects.select_related('created_by', 'validated_by', 'client', 'quote__lead', 'service_period')
        if self.action != 'list':
            # Détail / actions : le payé est relu en base (un versement créé
            # pendant la requête doit compter).
            return qs
        return qs.annotate(paid_total=Sum('payments__amount', filter=Q(payments__status__in=[
            Payment.Status.RECU, Payment.Status.ENREGISTRE,
        ])))

    def perform_create(self, serializer):
        invoice = serializer.save(created_by=self.request.user)
        notify_roles(
            COMPTABLE_ROLES,
            title='Nouvelle facture créée',
            message=f'Facture {invoice.invoice_number} créée.',
            notification_type='GENERAL',
            link='/admin/finance/facturation',
            exclude=self.request.user,
        )

    def update(self, request, *args, **kwargs):
        invoice = self.get_object()
        if invoice.status != Invoice.Status.BROUILLON:
            return Response({'detail': 'Une facture validée ne peut plus être modifiée.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary="Données de l'éditeur de facture",
        description="Devis récupérables (avec leurs lignes, pour pré-remplir une facture) et "
        "coordonnées de la société pour l'aperçu (paramètres des devis).",
    )
    @action(detail=False, methods=['get'], url_path='editor-context', permission_classes=[IsFinanceRole])
    def editor_context(self, request):
        from marketing.models import Quote, QuoteSettings

        settings_obj = QuoteSettings.load()
        default_terms = settings_obj.default_payment_terms or []
        quotes = (
            Quote.objects.exclude(status=Quote.Status.REFUSE)
            .prefetch_related('lines').order_by('-created_at')[:100]
        )
        quote_options = []
        for quote in quotes:
            lines = [
                {
                    'description': line.service_title,
                    'quantity': str(line.quantity),
                    'unit_price': str(line.unit_price),
                }
                for line in quote.lines.all()
            ]
            quote_options.append({
                'id': str(quote.id),
                'quote_number': quote.quote_number,
                'client_name': quote.client_name,
                'status': quote.status,
                'document_color': quote.document_color,
                'lines': lines,
                # Remise déjà accordée dans le devis : reprise comme réduction.
                'discount_amount': str(quote.discount_amount or 0),
                # Base des acomptes : total des prestations moins la remise.
                'total': str(sum((line.total_line for line in quote.lines.all()), Decimal('0')) - (quote.discount_amount or 0)),
                'payment_terms': [
                    {'label': t.get('label', ''), 'percentage': t.get('percentage', 0)}
                    for t in (quote.payment_terms or default_terms) if isinstance(t, dict)
                ],
            })
        return Response({
            'settings': {
                'company_address': settings_obj.company_address,
                'company_phone': settings_obj.company_phone,
                'company_email': settings_obj.company_email,
                'company_rccm': settings_obj.company_rccm,
                'company_nif': settings_obj.company_nif,
                'company_stamp_url': settings_obj.company_stamp_url,
                'payment_methods': settings_obj.payment_methods or [],
            },
            # Taux par défaut des nouvelles factures (paramètres Finance).
            'tax_rates': {
                'vat_rate': str(FinanceSettings.load().vat_rate),
                'css_rate': str(FinanceSettings.load().css_rate),
                'extra_taxes': FinanceSettings.load().extra_taxes or [],
            },
            'quotes': quote_options,
        })

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Marquer la facture comme payée',
        description="Enregistre le reste dû comme un versement reçu (avec son reçu). "
        "`payment_method` facultatif (AUTRE par défaut). Comptable, Super-Admin.",
        responses={200: InvoiceSerializer},
    )
    @action(detail=True, methods=['post'], url_path='mark-paid', permission_classes=[permissions.IsAuthenticated])
    def mark_paid(self, request, pk=None):
        if not has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)
        invoice = self.get_object()
        if invoice.status == Invoice.Status.BROUILLON:
            return Response({'detail': VALIDATE_BEFORE_PAYMENT}, status=status.HTTP_400_BAD_REQUEST)
        due = invoice.amount_ttc - invoice.amount_paid
        if due <= 0:
            return Response({'detail': 'Cette facture est déjà entièrement payée.'}, status=status.HTTP_400_BAD_REQUEST)
        method = request.data.get('payment_method') or Payment.PaymentMethod.AUTRE
        if method not in Payment.PaymentMethod.values:
            return Response({'detail': 'Moyen de paiement inconnu.'}, status=status.HTTP_400_BAD_REQUEST)
        # Versements encore en attente : on ne les compte pas deux fois, le
        # solde est encaissé en une fois et ils restent à traiter à part.
        pending = invoice.payments.filter(status=Payment.Status.EN_ATTENTE).aggregate(total=Sum('amount'))['total'] or Decimal('0')
        if pending:
            return Response(
                {'detail': f'{pending} FCFA de versements sont encore en attente : marquez-les reçus avant de solder la facture.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        payment = Payment.objects.create(
            invoice=invoice, amount=due, payment_date=timezone.now().date(), payment_method=method,
            status=Payment.Status.RECU, received_by=request.user, received_at=timezone.now(),
            notes='Solde enregistré via « Marquer comme payée ».',
        )
        PaymentReceipt.objects.create(payment=payment, issued_by=request.user)
        invoice.refresh_from_db()
        return Response(InvoiceSerializer(invoice).data)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Envoyer la facture par e-mail',
        description="La facture en PDF, et le devis d'origine s'il y en a un, en pièces jointes. "
        "`recipient_emails` (sinon les adresses du client) et `message` facultatifs.",
        responses={200: InvoiceSerializer},
    )
    @action(detail=True, methods=['post'], url_path='send', permission_classes=[IsFinanceRole])
    def send(self, request, pk=None):
        from core import mailer
        from finance.pdf import _amount, generate_invoice_pdf, get_invoice_filename

        invoice = self.get_object()
        recipient_emails = request.data.get('recipient_emails') or []
        if isinstance(recipient_emails, str):
            recipient_emails = [e.strip() for e in recipient_emails.split(',') if e.strip()]
        if not recipient_emails:
            recipient_emails = InvoiceSerializer(invoice).data['contact_emails']
        if not recipient_emails:
            return Response({'detail': "Aucune adresse e-mail : ajoutez un destinataire."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            attachments = [mailer.Attachment(filename=get_invoice_filename(invoice), content=generate_invoice_pdf(invoice).getvalue())]
            if invoice.quote_id:
                from marketing.quote_pdf import build_quote_pdf
                attachments.append(mailer.Attachment(
                    filename=f'Devis-{invoice.quote.quote_number}.pdf', content=build_quote_pdf(invoice.quote),
                ))
        except Exception:
            logger.exception('PDF de la facture %s non généré', invoice.pk)
            return Response(
                {'detail': "Le PDF n'a pas pu être généré : facture non envoyée. Réessayez."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        paid = invoice.amount_paid
        amounts = f'Montant total : {_amount(invoice.amount_ttc)} FCFA.\n'
        if paid:
            amounts += (
                f'Déjà payé : {_amount(paid)} FCFA — reste à payer : '
                f'{_amount(max(invoice.amount_ttc - paid, Decimal("0")))} FCFA.\n'
            )
        joined = 'La facture et le devis correspondant sont joints' if invoice.quote_id else 'La facture est jointe'
        custom_message = request.data.get('message') or f'Veuillez trouver ci-joint notre facture {invoice.invoice_number}.'
        body = (
            f"Bonjour {invoice.client_name or ''},\n\n{custom_message}\n\n{amounts}"
            f"{joined} à ce message au format PDF.\n\nCordialement,\nL'équipe Soken's Digital"
        )

        failed = []
        for dest in recipient_emails:
            try:
                if mailer.send_mail(dest, f"Facture {invoice.invoice_number} — Soken's Digital", body, attachments=attachments) is False:
                    failed.append(dest)
            except Exception:
                logger.exception('Envoi de la facture %s à %s impossible', invoice.pk, dest)
                failed.append(dest)

        data = InvoiceSerializer(invoice).data
        if failed:
            data['email_warning'] = f"Envoi impossible vers : {', '.join(failed)}."
        return Response(data)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Télécharger la facture en PDF',
        responses={(200, 'application/pdf'): bytes},
    )
    @action(detail=True, methods=['get'], url_path='pdf', permission_classes=[IsFinanceRole])
    def pdf(self, request, pk=None):
        from django.http import HttpResponse
        from finance.pdf import generate_invoice_pdf, get_invoice_filename

        invoice = self.get_object()
        try:
            pdf_file = generate_invoice_pdf(invoice)
        except Exception:
            logger.exception('PDF de la facture %s non généré', invoice.pk)
            return Response(
                {'detail': "La génération PDF n'est pas disponible pour le moment."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        response = HttpResponse(pdf_file.getvalue(), content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{get_invoice_filename(invoice)}"'
        return response

    def destroy(self, request, *args, **kwargs):
        # Suppression propre (versements, reçus, écritures, période
        # d'abonnement) ou refus en bloc si la comptabilité ne peut pas être
        # défaite sans la fausser — voir finance.invoice_deletion.
        # Droits : le Comptable ne supprime qu'un brouillon hors abonnement ;
        # une facture validée/payée ou celle d'un mois d'abonnement exige le
        # Super-Admin (même niveau que la suppression d'un abonnement).
        from django.db import transaction
        from finance.invoice_deletion import invoice_blocking_reasons
        with transaction.atomic():
            invoice = Invoice.objects.select_for_update().get(pk=self.get_object().pk)
            sensitive = (
                invoice.status != Invoice.Status.BROUILLON
                or invoice.payments.exists()
                or hasattr(invoice, 'service_period')
            )
            if sensitive and not has_role(request.user, ROLE_SUPER_ADMIN):
                return Response(
                    {'detail': "Seul un Super-Administrateur peut supprimer une facture validée, payée ou liée à un abonnement."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            reasons = invoice_blocking_reasons(invoice)
            if reasons:
                return Response({
                    'detail': 'Suppression impossible sans fausser la comptabilité : ' + ' '.join(reasons),
                    'reasons': reasons,
                }, status=status.HTTP_409_CONFLICT)
            self.perform_destroy(invoice)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def perform_destroy(self, instance):
        # Suppression d'une facture déjà validée/envoyée = action très
        # critique (décision du 10/09/2026) — e-mail en plus du push. Une
        # facture encore BROUILLON n'est qu'un brouillon, push suffit.
        from core.models import AuditLog
        from finance.invoice_deletion import delete_invoice_completely
        was_validated = instance.status != Invoice.Status.BROUILLON
        number = instance.invoice_number
        invoice_pk = instance.pk
        ip = self.request.META.get('REMOTE_ADDR')
        removed = delete_invoice_completely(instance, self.request.user, ip)
        AuditLog.objects.log_action(self.request.user, 'FACTURE_SUPPRIMEE', 'Invoice', invoice_pk,
                                    details=removed, ip_address=ip)
        notify_roles(
            COMPTABLE_ROLES,
            title='Facture supprimée',
            message=f'Facture {number} supprimée.',
            notification_type='GENERAL',
            link='/admin/finance/facturation',
            email=was_validated,
            exclude=self.request.user,
        )

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Validate an invoice and post its regularization entry',
        description='Comptable/Super-Admin only. Requires an open accounting period covering the issue_date.',
        responses={200: InvoiceSerializer},
    )
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def validate(self, request, pk=None):
        if not has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)
        invoice = self.get_object()
        if invoice.status != Invoice.Status.BROUILLON:
            return Response({'detail': 'Cette facture est déjà validée.'}, status=status.HTTP_400_BAD_REQUEST)

        period = AccountingPeriod.objects.filter(
            start_date__lte=invoice.issue_date, end_date__gte=invoice.issue_date,
            status=AccountingPeriod.Status.OUVERTE,
        ).first()
        if not period:
            return Response(
                {'detail': "Aucune période comptable ouverte ne couvre cette date de facture."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        client_account, _ = Account.objects.get_or_create(code='411', defaults={'name': 'Clients', 'account_class': Account.AccountClass.ACTIF})
        sales_account, _ = Account.objects.get_or_create(code='706', defaults={'name': 'Prestations de services', 'account_class': Account.AccountClass.PRODUIT})
        vat_account, _ = Account.objects.get_or_create(code='4457', defaults={'name': 'TVA collectée', 'account_class': Account.AccountClass.TVA})
        vat_amount = invoice.vat_amount
        css_amount = invoice.css_amount

        entry = JournalEntry.objects.create(
            period=period, journal_code=JournalEntry.JournalCode.VENTES, date=invoice.issue_date,
            label=f'Facture {invoice.invoice_number} — {invoice.client_name}',
            created_by=request.user, source_invoice=invoice,
        )
        TransactionLine.objects.create(entry=entry, account=client_account, label=invoice.client_name, debit=invoice.amount_ttc, credit=Decimal('0'))
        TransactionLine.objects.create(entry=entry, account=sales_account, label=invoice.invoice_number, debit=Decimal('0'), credit=invoice.amount_ht)
        if vat_amount:
            TransactionLine.objects.create(entry=entry, account=vat_account, label=invoice.invoice_number, debit=Decimal('0'), credit=vat_amount)
        if css_amount:
            # Contribution Spéciale de Solidarité collectée, reversée à l'État.
            css_code = FinanceSettings.load().default_css_collected_account_code or '4478'
            css_account, _ = Account.objects.get_or_create(code=css_code, defaults={'name': 'CSS collectée', 'account_class': Account.AccountClass.TVA})
            TransactionLine.objects.create(entry=entry, account=css_account, label=f'CSS {invoice.invoice_number}', debit=Decimal('0'), credit=css_amount)
        # Autres taxes (paramètres Finance) : une ligne chacune au compte des
        # autres taxes collectées. Le TTC les inclut, l'écriture reste équilibrée.
        other_code = FinanceSettings.load().default_other_taxes_account_code or '447'
        for tax in invoice.extra_taxes or []:
            amount = Decimal(str(tax.get('amount') or 0))
            if amount:
                other_account, _ = Account.objects.get_or_create(code=other_code, defaults={'name': 'État, autres impôts et taxes', 'account_class': Account.AccountClass.TVA})
                TransactionLine.objects.create(entry=entry, account=other_account, label=f"{tax.get('name', 'Taxe')} {invoice.invoice_number}", debit=Decimal('0'), credit=amount)

        invoice.status = Invoice.Status.VALIDEE
        invoice.validated_by = request.user
        invoice.validated_at = timezone.now()
        invoice.save(update_fields=['status', 'validated_by', 'validated_at'])
        from services.activation import on_invoice_paid
        on_invoice_paid(invoice)
        return Response(InvoiceSerializer(invoice).data)


@extend_schema_view(
    list=extend_schema(tags=['Finance & Comptabilité'], summary='List bank statement imports'),
    create=extend_schema(tags=['Finance & Comptabilité'], summary='Import bank transaction rows', description='Comptable/Super-Admin only. No CSV file parsing — send parsed rows directly.'),
    retrieve=extend_schema(tags=['Finance & Comptabilité'], summary='Get a bank statement import'),
)
class BankStatementImportViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = BankStatementImport.objects.select_related('imported_by').prefetch_related('transactions')
    serializer_class = BankStatementImportSerializer
    permission_classes = [IsFinanceRole]

    def create(self, request, *args, **kwargs):
        if not has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.save(imported_by=self.request.user)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Suggest Grand Livre lines matching a bank transaction (rapprochement)',
        description='Same-amount, unmatched lines posted to the bank account (code 512).',
        responses={200: {'type': 'array', 'items': {'type': 'object'}}},
    )
    @action(detail=True, methods=['get'], url_path=r'transactions/(?P<transaction_id>[^/.]+)/suggestions', permission_classes=[IsFinanceRole])
    def suggestions(self, request, pk=None, transaction_id=None):
        transaction_row = BankTransaction.objects.filter(id=transaction_id, statement_import_id=pk).first()
        if not transaction_row:
            return Response(status=status.HTTP_404_NOT_FOUND)
        candidates = TransactionLine.objects.filter(
            account__code='512', matched_bank_transaction__isnull=True,
        ).filter(Q(debit=transaction_row.amount) | Q(credit=transaction_row.amount)).select_related('entry', 'account')
        from finance.serializers import TransactionLineSerializer
        return Response(TransactionLineSerializer(candidates, many=True).data)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Match a bank transaction to a Grand Livre line (lettrage)',
        request={'application/json': {'type': 'object', 'properties': {'line_id': {'type': 'string'}}}},
        responses={200: BankTransactionSerializer},
    )
    @action(detail=True, methods=['post'], url_path=r'transactions/(?P<transaction_id>[^/.]+)/match', permission_classes=[IsFinanceRole])
    def match(self, request, pk=None, transaction_id=None):
        if not has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)
        transaction_row = BankTransaction.objects.filter(id=transaction_id, statement_import_id=pk).first()
        if not transaction_row:
            return Response(status=status.HTTP_404_NOT_FOUND)
        line = TransactionLine.objects.filter(id=request.data.get('line_id')).first()
        if not line:
            return Response({'detail': 'line_id introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        import uuid
        code = str(uuid.uuid4())
        line.lettrage_code = code
        line.save(update_fields=['lettrage_code'])
        transaction_row.matched_line = line
        transaction_row.status = BankTransaction.Status.LETTRE
        transaction_row.save(update_fields=['matched_line', 'status'])
        return Response(BankTransactionSerializer(transaction_row).data)


class PaymentViewSet(mixins.ListModelMixin, mixins.CreateModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Versements partiels d'une facture (workflow paiements 20-30%-...-100%)."""

    serializer_class = PaymentSerializer
    permission_classes = [IsFinanceRole]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return Payment.objects.none()
        invoice_id = self.kwargs.get('invoice_id')
        qs = Payment.objects.filter(invoice_id=invoice_id).select_related('invoice', 'received_by')
        return qs.prefetch_related('receipt', 'attachments')

    def get_serializer_context(self):
        context = super().get_serializer_context()
        # Le serializer valide le montant contre le restant du, donc il lui
        # faut la facture des la creation — a ce moment la, l'instance n'a
        # pas encore de FK.
        invoice_id = self.kwargs.get('invoice_id')
        if invoice_id:
            context['invoice'] = Invoice.objects.filter(id=invoice_id).first()
        return context

    def perform_create(self, serializer):
        invoice = self.get_serializer_context().get('invoice')
        if invoice is None:
            raise serializers.ValidationError('Invoice not found')
        if invoice.status == Invoice.Status.BROUILLON:
            raise serializers.ValidationError({'detail': VALIDATE_BEFORE_PAYMENT})
        serializer.save(invoice=invoice)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Mark a payment as received',
        description='Change payment status PENDING → RECEIVED, auto-create receipt, check if fully paid',
        responses={200: PaymentSerializer},
    )
    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Télécharger le reçu du versement en PDF',
        responses={(200, 'application/pdf'): bytes},
    )
    @action(detail=True, methods=['get'], permission_classes=[IsFinanceRole])
    def receipt(self, request, pk=None, **kwargs):
        from django.http import HttpResponse
        from finance.pdf import generate_receipt_pdf

        payment = self.get_object()
        receipt = getattr(payment, 'receipt', None)
        if receipt is None:
            return Response({'detail': "Ce versement n'a pas encore de reçu : marquez-le reçu d'abord."}, status=status.HTTP_404_NOT_FOUND)
        try:
            pdf_bytes = generate_receipt_pdf(receipt)
        except Exception:
            logger.exception('PDF du reçu %s non généré', receipt.pk)
            return Response({'detail': "La génération PDF n'est pas disponible pour le moment."}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        response = HttpResponse(pdf_bytes, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{receipt.receipt_number}.pdf"'
        return response

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def receive(self, request, pk=None, **kwargs):
        """Marquer versement reçu + auto-créer reçu."""
        if not has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)

        payment = self.get_object()
        if payment.status != Payment.Status.EN_ATTENTE:
            return Response({'detail': 'Payment must be EN_ATTENTE'}, status=status.HTTP_400_BAD_REQUEST)

        payment.status = Payment.Status.RECU
        payment.received_by = request.user
        payment.received_at = timezone.now()
        payment.save()

        # Auto-créer receipt
        PaymentReceipt.objects.create(payment=payment, issued_by=request.user)

        # Vérifier si facture 100% payée
        total_paid = payment.invoice.payments.filter(
            status=Payment.Status.RECU
        ).aggregate(total=models.Sum('amount'))['total'] or Decimal('0')

        if total_paid >= payment.invoice.amount_ttc:
            from core.notifications import notify
            notify(
                user=request.user,
                title='Facture complètement payée',
                message=f'{payment.invoice.invoice_number}: Prêt pour enregistrement comptable',
                notification_type='INVOICE_FULLY_PAID',
                link=f'/admin/finance/facturation/{payment.invoice.id}/',
            )

        return Response(PaymentSerializer(payment).data)


class PaymentReceiptViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    """Reçus de versement — lecture seule (créés auto par Payment.receive action)."""

    serializer_class = PaymentReceiptSerializer
    permission_classes = [IsFinanceRole]

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return PaymentReceipt.objects.none()
        invoice_id = self.kwargs.get('invoice_id')
        return PaymentReceipt.objects.filter(
            payment__invoice_id=invoice_id
        ).select_related('payment', 'issued_by')


@extend_schema_view(
    list=extend_schema(tags=['Finance & Comptabilité'], summary='List TVA declarations'),
    retrieve=extend_schema(tags=['Finance & Comptabilité'], summary='Get a TVA declaration'),
)
class TaxDeclarationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    queryset = TaxDeclaration.objects.select_related('period', 'generated_by', 'validated_by')
    serializer_class = TaxDeclarationSerializer
    permission_classes = [IsFinanceRole]

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Generate/refresh a draft TVA declaration for a period',
        description='Comptable/Super-Admin only. Computes collected/deductible VAT from '
        'TransactionLine rows posted to accounts 4457/4456 within the period.',
        request={'application/json': {'type': 'object', 'properties': {'period_id': {'type': 'string'}}}},
        responses={201: TaxDeclarationSerializer},
    )
    @action(detail=False, methods=['post'], permission_classes=[IsFinanceRole])
    def generate(self, request):
        if not has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)
        period = AccountingPeriod.objects.filter(id=request.data.get('period_id')).first()
        if not period:
            return Response({'detail': 'period_id introuvable.'}, status=status.HTTP_400_BAD_REQUEST)

        collected = TransactionLine.objects.filter(
            entry__period=period, account__code='4457',
        ).aggregate(total=Sum('credit'))['total'] or Decimal('0')
        deductible = TransactionLine.objects.filter(
            entry__period=period, account__code='4456',
        ).aggregate(total=Sum('debit'))['total'] or Decimal('0')

        declaration, _ = TaxDeclaration.objects.update_or_create(
            period=period,
            defaults={
                'collected_vat': collected, 'deductible_vat': deductible,
                'net_vat': collected - deductible, 'generated_by': request.user,
            },
        )
        return Response(TaxDeclarationSerializer(declaration).data, status=status.HTTP_201_CREATED)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Validate (sign) a TVA declaration',
        description='Comptable/Super-Admin only (§4.1 "Gouvernance fiscale").',
        responses={200: TaxDeclarationSerializer},
    )
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def validate(self, request, pk=None):
        if not has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)
        declaration = self.get_object()
        if declaration.status != TaxDeclaration.Status.BROUILLON:
            return Response({'detail': 'Cette déclaration est déjà validée.'}, status=status.HTTP_400_BAD_REQUEST)
        declaration.status = TaxDeclaration.Status.VALIDEE
        declaration.validated_by = request.user
        declaration.validated_at = timezone.now()
        declaration.save(update_fields=['status', 'validated_by', 'validated_at'])
        return Response(TaxDeclarationSerializer(declaration).data)


@extend_schema(
    tags=['Finance & Comptabilité'],
    summary='Export the FEC (Fichier des Écritures Comptables) for a period',
    description='Comptable/Super-Admin. NOTE: simplified subset of '
    "the real French DGFiP FEC column spec (18 mandatory columns, strict formats) — "
    'covers the columns needed to reconstruct entries, not a certified export.',
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def fec_export(request, period_id):
    if not has_role(request.user, *FINANCE_READ_ROLES, ROLE_SUPER_ADMIN):
        return Response(status=status.HTTP_403_FORBIDDEN)
    period = AccountingPeriod.objects.filter(id=period_id).first()
    if not period:
        return Response(status=status.HTTP_404_NOT_FOUND)

    lines = TransactionLine.objects.filter(entry__period=period).select_related('entry', 'account').order_by('entry__date', 'entry__id')
    rows = ['JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|EcritureLib|Debit|Credit']
    for line in lines:
        entry = line.entry
        rows.append('|'.join([
            entry.journal_code, entry.get_journal_code_display(), str(entry.id),
            entry.date.strftime('%Y%m%d'), line.account.code, line.account.name,
            line.label or entry.label, str(line.debit), str(line.credit),
        ]))

    from django.http import HttpResponse
    response = HttpResponse('\n'.join(rows), content_type='text/plain; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="FEC_{period.label}.txt"'
    return response


FINANCE_DASHBOARD_CACHE_KEY = 'finance:dashboard:v1'
# 5 min — le settings.py promettait déjà ce comportement (commentaire
# "Cache (also used to memoize dashboard aggregations behind a TTL"),
# jamais câblé jusqu'ici. Plusieurs agrégations pleine-table à chaque vue
# de la page, alors qu'une fraîcheur à 5 min est largement suffisante pour
# un dashboard financier consulté plusieurs fois par jour par la même
# personne.
FINANCE_DASHBOARD_CACHE_TTL = 300


def invoice_tax_totals(year: int | None = None) -> dict:
    """Taxes collectées sur les factures émises (hors brouillons) : TVA, CSS
    et autres taxes, pour l'année en cours et depuis le début."""
    year = year or timezone.localdate().year
    issued = Invoice.objects.exclude(status=Invoice.Status.BROUILLON)

    def totals(qs):
        agg = qs.aggregate(ht=Sum('amount_ht'), vat=Sum('vat_amount'), css=Sum('css_amount'), ttc=Sum('amount_ttc'))
        extras: dict[str, Decimal] = {}
        for taxes in qs.exclude(extra_taxes=[]).values_list('extra_taxes', flat=True):
            for tax in taxes or []:
                name = (tax.get('name') or 'Autre taxe').strip() or 'Autre taxe'
                extras[name] = extras.get(name, Decimal('0')) + Decimal(str(tax.get('amount') or 0))
        vat, css = agg['vat'] or Decimal('0'), agg['css'] or Decimal('0')
        return {
            'invoices': qs.count(),
            'amount_ht': str(agg['ht'] or Decimal('0')),
            'vat': str(vat),
            'css': str(css),
            'extra': {name: str(amount) for name, amount in extras.items()},
            'total_taxes': str(vat + css + sum(extras.values(), Decimal('0'))),
            'amount_ttc': str(agg['ttc'] or Decimal('0')),
        }

    return {'year': year, 'this_year': totals(issued.filter(issue_date__year=year)), 'all_time': totals(issued)}


@extend_schema(
    tags=['Finance & Comptabilité'],
    summary='Finance dashboard (§4.1 Analytique & Reporting)',
    description='Comptable/Super-Admin. Simplified: trésorerie brute (solde du '
    "compte 512), résultat brut (produits - charges validés), DSO (délai moyen "
    "facture émise -> échéance sur factures validées), décaissements exécutés par "
    "projet. No true per-project margin (revenue isn't tracked per-project in "
    "Django yet — see docs/backend-specifications.md).",
    responses={200: {'type': 'object'}},
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def finance_dashboard(request):
    if not has_role(request.user, *COMPTABLE_ROLES, ROLE_SUPER_ADMIN):
        return Response(status=status.HTTP_403_FORBIDDEN)

    cached = cache.get(FINANCE_DASHBOARD_CACHE_KEY)
    if cached is not None:
        return Response(cached)

    bank_lines = TransactionLine.objects.filter(account__code='512')
    # Une seule requête (2 Sum dans le même aggregate) au lieu de deux scans
    # identiques de bank_lines.
    bank_totals = bank_lines.aggregate(debit_total=Sum('debit'), credit_total=Sum('credit'))
    cash_balance = (bank_totals['debit_total'] or Decimal('0')) - (bank_totals['credit_total'] or Decimal('0'))

    charge_lines = TransactionLine.objects.filter(account__account_class=Account.AccountClass.CHARGE)
    produit_lines = TransactionLine.objects.filter(account__account_class=Account.AccountClass.PRODUIT)
    total_charges = charge_lines.aggregate(total=Sum('debit'))['total'] or Decimal('0')
    total_produits = produit_lines.aggregate(total=Sum('credit'))['total'] or Decimal('0')

    validated_invoices = Invoice.objects.filter(status=Invoice.Status.VALIDEE, due_date__isnull=False)
    delays = [(inv.due_date - inv.issue_date).days for inv in validated_invoices]
    dso_days = round(sum(delays) / len(delays), 1) if delays else None

    disbursements_by_project = {
        str(row['project_id']): str(row['total'])
        for row in DisbursementRequest.objects.filter(status=DisbursementRequest.Status.EXECUTE, project__isnull=False)
        .values('project_id').annotate(total=Sum('amount')).order_by()
    }

    payload = {
        'cash_balance': str(cash_balance),
        'gross_result': str(total_produits - total_charges),
        'dso_days': dso_days,
        'executed_disbursements_by_project': disbursements_by_project,
        'taxes': invoice_tax_totals(),
    }
    cache.set(FINANCE_DASHBOARD_CACHE_KEY, payload, FINANCE_DASHBOARD_CACHE_TTL)
    return Response(payload)


# ---------------------------------------------------------------------------
# Encaissements — vue consolidée de TOUTES les entrées d'argent
# ---------------------------------------------------------------------------

@extend_schema(
    tags=['Finance & Comptabilité'],
    summary='Encaissements consolidés (caisse + banque + versements clients)',
    description="Toutes les entrées d'argent de l'entreprise en une seule liste, quelle que "
    "soit leur porte d'entrée : espèces en caisse (treasury.CashEntry type=ENTREE), "
    "crédits bancaires (treasury.BankEntry type=ENTREE) et versements clients encaissés "
    "(finance.Payment status=RECU). Agrégé côté serveur plutôt que par 3 appels frontend "
    "séparés : une seule requête HTTP, un seul tri chronologique, des totaux cohérents.\n\n"
    "Filtres optionnels `date_from`/`date_to` (YYYY-MM-DD). Accès Comptable / "
    "Comptable / Super-Admin ; le Caissier y accède aussi mais ne voit que la caisse "
    "(la banque et les versements ne sont pas de son périmètre, cf. cahier des charges §3).",
    responses={200: {'type': 'object'}},
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def encaissements(request):
    from treasury.models import BankEntry, CashEntry

    is_finance = has_role(request.user, *FINANCE_READ_ROLES, ROLE_SUPER_ADMIN)
    is_caissier = has_role(request.user, ROLE_CAISSIER)
    if not (is_finance or is_caissier):
        return Response(status=status.HTTP_403_FORBIDDEN)

    date_from = request.query_params.get('date_from')
    date_to = request.query_params.get('date_to')

    def _apply_date_filter(qs, field='date'):
        if date_from:
            qs = qs.filter(**{f'{field}__gte': date_from})
        if date_to:
            qs = qs.filter(**{f'{field}__lte': date_to})
        return qs

    rows = []

    # --- Caisse (visible par le Caissier comme par la Finance) -------------
    cash_qs = _apply_date_filter(
        CashEntry.objects.filter(type=CashEntry.Type.ENTREE).select_related('created_by')
    )
    for entry in cash_qs:
        rows.append({
            'id': str(entry.id),
            'origin': 'CAISSE',
            'origin_label': 'Caisse',
            'reference': entry.voucher_number,
            'label': entry.get_source_display(),
            'description': entry.description,
            'amount': str(entry.amount),
            'date': entry.date.isoformat(),
            'reconciled': entry.reconciled_at is not None,
        })

    # --- Banque + versements clients : Finance uniquement ------------------
    if is_finance:
        bank_qs = _apply_date_filter(
            BankEntry.objects.filter(type=BankEntry.Type.ENTREE).select_related('created_by')
        )
        for entry in bank_qs:
            rows.append({
                'id': str(entry.id),
                'origin': 'BANQUE',
                'origin_label': 'Banque',
                'reference': entry.reference,
                'label': entry.get_source_display(),
                'description': entry.description,
                'amount': str(entry.amount),
                'date': entry.date.isoformat(),
                'reconciled': entry.reconciled_at is not None,
            })

        payment_qs = _apply_date_filter(
            Payment.objects.filter(status=Payment.Status.RECU).select_related('invoice'),
            field='payment_date',
        )
        for payment in payment_qs:
            rows.append({
                'id': str(payment.id),
                'origin': 'VERSEMENT',
                'origin_label': 'Versement client',
                'reference': payment.invoice.invoice_number,
                'label': payment.get_payment_method_display(),
                'description': payment.notes,
                'amount': str(payment.amount),
                'date': payment.payment_date.isoformat(),
                # Un versement encaissé est constaté par nature — il n'a pas
                # d'étape de rapprochement propre (celle-ci vit sur la pièce
                # de caisse ou le mouvement bancaire correspondant).
                'reconciled': True,
            })

    rows.sort(key=lambda r: r['date'], reverse=True)

    totals = {}
    for row in rows:
        totals[row['origin']] = str(Decimal(totals.get(row['origin'], '0')) + Decimal(row['amount']))

    return Response({
        'results': rows,
        'count': len(rows),
        'totals_by_origin': totals,
        'total': str(sum((Decimal(r['amount']) for r in rows), Decimal('0'))),
        'scope': 'caisse' if (is_caissier and not is_finance) else 'complet',
    })


class PublicInvoiceVerificationView(APIView):
    """Vérification publique d'une facture via son QR code fiscal.

    Sans authentification (le client, l'administration fiscale ou un tiers
    scanne le QR code). La signature HMAC du lien est recalculée à partir de
    la facture en base : les données ne sont renvoyées que si elle
    correspond — un numéro deviné ou une facture modifiée après émission
    ne révèle rien et est signalé comme non conforme. Débit limité.
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'invoice_verify'

    @extend_schema(tags=['Public'], summary='Verify an invoice fiscal QR code')
    def get(self, request):
        from finance.fiscal import verify_signature
        from marketing.models import QuoteSettings

        number = (request.query_params.get('n') or '').strip()
        signature = (request.query_params.get('s') or '').strip()
        invoice = Invoice.objects.select_related('client').filter(invoice_number=number).first() if number else None
        if not invoice or invoice.status == Invoice.Status.BROUILLON or not verify_signature(invoice, signature):
            return Response({'valid': False}, status=status.HTTP_200_OK)
        company = QuoteSettings.load()
        return Response({
            'valid': True,
            'invoice_number': invoice.invoice_number,
            'issue_date': invoice.issue_date,
            'supplier': "Soken's Digital",
            'supplier_nif': company.company_nif,
            'supplier_rccm': company.company_rccm,
            'client': invoice.client.company_name if invoice.client_id else invoice.client_name,
            'client_nif': invoice.client.nif if invoice.client_id else '',
            'amount_ht': invoice.amount_ht,
            'vat_rate': invoice.vat_rate,
            'vat_amount': invoice.vat_amount,
            'css_rate': invoice.css_rate,
            'css_amount': invoice.css_amount,
            'extra_taxes': [{'name': t.get('name'), 'percent': t.get('percent'), 'amount': t.get('amount')} for t in (invoice.extra_taxes or [])],
            'amount_ttc': invoice.amount_ttc,
            'status': invoice.get_status_display(),
        })


class TaxRatesView(APIView):
    """Taux de TVA et de CSS appliqués par défaut aux nouvelles factures.

    Lecture : rôles finance. Modification : Comptable ou
    Super-Admin uniquement, tracée dans le journal d'audit. Les factures
    déjà émises gardent les taux en vigueur à leur émission."""

    def get_permissions(self):
        return [IsFinanceRole()]

    @extend_schema(tags=['Finance & Comptabilité'], summary='Taux de TVA et de CSS par défaut')
    def get(self, request):
        from finance.serializers import TaxRatesSerializer
        return Response(TaxRatesSerializer(FinanceSettings.load()).data)

    @extend_schema(tags=['Finance & Comptabilité'], summary='Modifier les taux de TVA et de CSS par défaut')
    def patch(self, request):
        from core.models import AuditLog
        from finance.serializers import TaxRatesSerializer
        from marketing.serializers import can_edit_tax_rates
        if not can_edit_tax_rates(request.user):
            return Response({'detail': 'Les taux sont modifiables par le gérant, la comptabilité et les Super-Admins.'}, status=status.HTTP_403_FORBIDDEN)
        settings_obj = FinanceSettings.load()
        before = {'vat_rate': str(settings_obj.vat_rate), 'css_rate': str(settings_obj.css_rate), 'extra_taxes': settings_obj.extra_taxes}
        serializer = TaxRatesSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        AuditLog.objects.log_action(
            request.user, 'TAUX_FISCAUX_MODIFIES', 'FinanceSettings', settings_obj.pk,
            details={'avant': before, 'apres': {'vat_rate': str(settings_obj.vat_rate), 'css_rate': str(settings_obj.css_rate), 'extra_taxes': settings_obj.extra_taxes}},
            ip_address=request.META.get('REMOTE_ADDR'),
        )
        return Response(serializer.data)



class PublicDocumentVerificationView(APIView):
    """Vérification publique d'une pièce de caisse (entrée/sortie) ou d'un
    bon de demande via son QR code. Données renvoyées seulement si la
    signature, recalculée sur la pièce en base, correspond."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = 'invoice_verify'

    @extend_schema(tags=['Public'], summary='Verify a treasury document QR code')
    def get(self, request):
        import uuid as _uuid
        from finance.fiscal import verify_document
        from treasury.models import CashEntry
        kind = request.query_params.get('t') or ''
        doc_id = request.query_params.get('id') or ''
        signature = request.query_params.get('s') or ''
        try:
            _uuid.UUID(doc_id)
        except ValueError:
            return Response({'valid': False})
        if kind == 'caisse':
            obj = CashEntry.objects.filter(pk=doc_id).first()
            if not obj or not verify_document(kind, obj, signature):
                return Response({'valid': False})
            return Response({
                'valid': True, 'kind': 'Pièce de caisse',
                'direction': obj.get_type_display(), 'number': obj.voucher_number or obj.reference,
                'date': obj.date, 'amount': obj.amount, 'issuer': "Soken's Digital",
            })
        if kind == 'besoin':
            obj = DisbursementRequest.objects.filter(pk=doc_id).first()
            if not obj or not verify_document(kind, obj, signature):
                return Response({'valid': False})
            return Response({
                'valid': True, 'kind': 'Bon de demande', 'number': obj.reference,
                'date': obj.request_date, 'amount': obj.amount, 'status': obj.get_status_display(),
                'beneficiary': obj.beneficiary, 'issuer': "Soken's Digital",
            })
        return Response({'valid': False})
