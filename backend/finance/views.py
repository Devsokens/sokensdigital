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

from core.constants import ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_PROJECT_MANAGER, ROLE_DIRECTEUR_FINANCIER, ROLE_COMPTABLE, ROLE_CAISSIER
from core.notifications import notify, notify_roles
from core.permissions import gerant_recipients, has_role, is_gerant
from core.storage import upload_disbursement_quote
from decimal import Decimal as D
from django.utils import timezone
from finance.models import (
    Account,
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
DIRECTEUR_FINANCIER_ROLES = (ROLE_DIRECTEUR_FINANCIER,)
COMPTABLE_ROLES = (ROLE_COMPTABLE,)
FINANCE_READ_ROLES = (ROLE_DIRECTEUR_FINANCIER, ROLE_COMPTABLE)
logger = logging.getLogger(__name__)


def _can_decide_stage(user, pending_status):
    """Circuit fixe RCF puis Gérant (process comptable et financier,
    "Demande de décaissement") — aucun seuil de montant. Comptable et
    Directeur Financier tiennent lieu de RCF (même convention que
    procurement.views.IsManagerOrAdmin) ; Super-Admin tient lieu de
    Gérant."""
    if pending_status == DisbursementRequest.Status.EN_ATTENTE_RCF:
        # Première validation : le Directeur financier (Super-Admin en secours).
        return has_role(user, *DIRECTEUR_FINANCIER_ROLES, ROLE_SUPER_ADMIN)
    return is_gerant(user)  # EN_ATTENTE_GERANT — gérant désigné, sinon Super-Admin


BESOINS_LINK = '/admin/technique/decaissements'  # suivi côté demandeur
DECAISSEMENTS_LINK = '/admin/finance/decaissements'  # validation (Directeur financier, Gérant)


def _besoin_label(disbursement):
    return f'{disbursement.reference or "Besoin"} — {disbursement.beneficiary} ({disbursement.amount:,.0f} FCFA)'.replace(',', ' ')


def _notify_besoin_stage(disbursement, exclude=None):
    """Prévient ceux qui doivent statuer à l'étape en cours : la RCF
    (Comptable, Directeur Financier) puis le Gérant (Super-Admin)."""
    if disbursement.status == DisbursementRequest.Status.EN_ATTENTE_RCF:
        notify_roles(
            (ROLE_DIRECTEUR_FINANCIER,), title='Nouveau besoin à examiner',
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
        # réservée au Directeur financier puis au Gérant (action approve).
        user = request.user
        return bool(user and user.is_authenticated and user.is_active)


@extend_schema_view(
    list=extend_schema(
        tags=['Finance & Comptabilité'],
        summary='List disbursement requests',
        description='Chef de Projet sees requests for projects they lead; Directeur Financier/Comptable/Super-Admin see everything.',
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
                or has_role(user, ROLE_ADMIN, ROLE_SUPER_ADMIN)
            )
            if not allowed:
                raise PermissionDenied("Seuls le chef de projet et les membres de l'équipe du projet peuvent lui rattacher un besoin.")
        disbursement = serializer.save(
            requested_by=self.request.user,
            department=self.request.user.department,
            status=DisbursementRequest.Status.EN_ATTENTE_RCF,
        )
        _notify_besoin_stage(disbursement, exclude=self.request.user)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Give validation to a disbursement request',
        description="Circuit fixe, sans seuil de montant : la RCF (Comptable ou "
        "Directeur Financier) examine d'abord — approuver transmet au Gérant "
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
        if not _can_decide_stage(request.user, disbursement.status):
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
        # le bon de demande PDF (Directeur financier puis Gérant).
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


class IsDirecteurFinancierOrSuperAdmin(permissions.BasePermission):
    """§4.1 "Clôture comptable": "Seul rôle, avec le Super-Admin, habilité à
    ouvrir ou verrouiller définitivement des exercices". Read access is
    wider (Comptable needs to know whether a period is open)."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return has_role(request.user, *FINANCE_READ_ROLES, ROLE_SUPER_ADMIN)
        return has_role(request.user, *DIRECTEUR_FINANCIER_ROLES, ROLE_SUPER_ADMIN)


@extend_schema_view(
    list=extend_schema(tags=['Finance & Comptabilité'], summary='List accounting periods'),
    create=extend_schema(tags=['Finance & Comptabilité'], summary='Create an accounting period', description='Directeur Financier/Super-Admin only.'),
    retrieve=extend_schema(tags=['Finance & Comptabilité'], summary='Get an accounting period'),
)
class AccountingPeriodViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.CreateModelMixin, viewsets.GenericViewSet):
    queryset = AccountingPeriod.objects.select_related('closed_by')
    serializer_class = AccountingPeriodSerializer
    permission_classes = [IsDirecteurFinancierOrSuperAdmin]

    @extend_schema(tags=['Finance & Comptabilité'], summary='Close (lock) an accounting period', responses={200: AccountingPeriodSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsDirecteurFinancierOrSuperAdmin])
    def close(self, request, pk=None):
        period = self.get_object()
        period.status = AccountingPeriod.Status.CLOTUREE
        period.closed_by = request.user
        period.closed_at = timezone.now()
        period.save(update_fields=['status', 'closed_by', 'closed_at'])
        return Response(AccountingPeriodSerializer(period).data)

    @extend_schema(tags=['Finance & Comptabilité'], summary='Reopen a closed accounting period', responses={200: AccountingPeriodSerializer})
    @action(detail=True, methods=['post'], permission_classes=[IsDirecteurFinancierOrSuperAdmin])
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
    queryset = Invoice.objects.select_related('created_by', 'validated_by')
    serializer_class = InvoiceSerializer
    permission_classes = [IsFinanceRole]

    def perform_create(self, serializer):
        invoice = serializer.save(created_by=self.request.user)
        notify_roles(
            DIRECTEUR_FINANCIER_ROLES,
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

    def perform_destroy(self, instance):
        # Suppression d'une facture déjà validée/envoyée = action très
        # critique (décision du 10/09/2026) — e-mail en plus du push. Une
        # facture encore BROUILLON n'est qu'un brouillon, push suffit.
        was_validated = instance.status != Invoice.Status.BROUILLON
        number = instance.invoice_number
        super().perform_destroy(instance)
        notify_roles(
            DIRECTEUR_FINANCIER_ROLES,
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
        vat_amount = invoice.amount_ttc - invoice.amount_ht

        entry = JournalEntry.objects.create(
            period=period, journal_code=JournalEntry.JournalCode.VENTES, date=invoice.issue_date,
            label=f'Facture {invoice.invoice_number} — {invoice.client_name}',
            created_by=request.user, source_invoice=invoice,
        )
        TransactionLine.objects.create(entry=entry, account=client_account, label=invoice.client_name, debit=invoice.amount_ttc, credit=Decimal('0'))
        TransactionLine.objects.create(entry=entry, account=sales_account, label=invoice.invoice_number, debit=Decimal('0'), credit=invoice.amount_ht)
        if vat_amount:
            TransactionLine.objects.create(entry=entry, account=vat_account, label=invoice.invoice_number, debit=Decimal('0'), credit=vat_amount)

        invoice.status = Invoice.Status.VALIDEE
        invoice.validated_by = request.user
        invoice.validated_at = timezone.now()
        invoice.save(update_fields=['status', 'validated_by', 'validated_at'])
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
        serializer.save(invoice=invoice)

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Mark a payment as received',
        description='Change payment status PENDING → RECEIVED, auto-create receipt, check if fully paid',
        responses={200: PaymentSerializer},
    )
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def receive(self, request, pk=None, **kwargs):
        """Marquer versement reçu + auto-créer reçu."""
        if not has_role(request.user, *COMPTABLE_ROLES, *DIRECTEUR_FINANCIER_ROLES, ROLE_SUPER_ADMIN):
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
            payment.invoice.status = Invoice.Status.VALIDEE
            payment.invoice.validated_by = request.user
            payment.invoice.validated_at = timezone.now()
            payment.invoice.save()

            # Enregistrement comptable (via signal ou task)
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
        description='Directeur Financier/Super-Admin only (§4.1 "Gouvernance fiscale").',
        responses={200: TaxDeclarationSerializer},
    )
    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def validate(self, request, pk=None):
        if not has_role(request.user, *DIRECTEUR_FINANCIER_ROLES, ROLE_SUPER_ADMIN):
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
    description='Comptable/Directeur Financier/Super-Admin. NOTE: simplified subset of '
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


@extend_schema(
    tags=['Finance & Comptabilité'],
    summary='Finance dashboard (§4.1 Analytique & Reporting)',
    description='Directeur Financier/Super-Admin. Simplified: trésorerie brute (solde du '
    "compte 512), résultat brut (produits - charges validés), DSO (délai moyen "
    "facture émise -> échéance sur factures validées), décaissements exécutés par "
    "projet. No true per-project margin (revenue isn't tracked per-project in "
    "Django yet — see docs/backend-specifications.md).",
    responses={200: {'type': 'object'}},
)
@api_view(['GET'])
@permission_classes([permissions.IsAuthenticated])
def finance_dashboard(request):
    if not has_role(request.user, *DIRECTEUR_FINANCIER_ROLES, ROLE_SUPER_ADMIN):
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
    "Filtres optionnels `date_from`/`date_to` (YYYY-MM-DD). Accès Directeur Financier / "
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
