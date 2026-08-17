from decimal import Decimal

from django.core.cache import cache
from django.db import models
from django.db.models import Q, Sum
from django.utils import timezone
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import mixins, permissions, status, viewsets, serializers
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from core.constants import ROLE_SUPER_ADMIN, ROLE_PROJECT_MANAGER, ROLE_DIRECTEUR_FINANCIER, ROLE_COMPTABLE
from core.permissions import has_role
from decimal import Decimal as D
from django.utils import timezone
from finance.models import (
    Account,
    AccountingPeriod,
    BankStatementImport,
    BankTransaction,
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


def _can_approve_tier(user, pending_status):
    """A higher validation tier's role can always approve a lower tier's
    request — Directeur Financier and Super-Admin both cover the
    Comptable-only N1 tier, Super-Admin also covers N2 (cahier des
    charges §4.3: N1 Comptable <10 000, N2 Directeur Financier
    10 000-50 000, N3 direction générale >50 000)."""
    if pending_status == DisbursementRequest.Status.EN_ATTENTE_N1:
        return has_role(user, *COMPTABLE_ROLES, *DIRECTEUR_FINANCIER_ROLES, ROLE_SUPER_ADMIN)
    if pending_status == DisbursementRequest.Status.EN_ATTENTE_N2:
        return has_role(user, *DIRECTEUR_FINANCIER_ROLES, ROLE_SUPER_ADMIN)
    return has_role(user, ROLE_SUPER_ADMIN)  # EN_ATTENTE_N3


class CanInitiateDisbursement(permissions.BasePermission):
    """N1 initiation: Chef de Projet, restricted in the view to projects
    they lead. N2/N3 final approval and execution are separate actions
    below, with their own permission checks — this class only gates
    list/retrieve/create."""

    def has_permission(self, request, view):
        if request.method == 'POST':
            return has_role(request.user, *CHEF_DE_PROJET_ROLES, ROLE_SUPER_ADMIN)
        return has_role(request.user, *CHEF_DE_PROJET_ROLES, *FINANCE_READ_ROLES, ROLE_SUPER_ADMIN)


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

    def get_queryset(self):
        if getattr(self, 'swagger_fake_view', False):
            return DisbursementRequest.objects.none()
        qs = DisbursementRequest.objects.select_related('project', 'requested_by', 'decided_by', 'executed_by')
        if has_role(self.request.user, *FINANCE_READ_ROLES, ROLE_SUPER_ADMIN):
            return qs
        return qs.filter(
            Q(project__lead_project_manager=self.request.user) | Q(requested_by=self.request.user)
        ).distinct()

    def perform_create(self, serializer):
        project = serializer.validated_data.get('project')
        if project and project.lead_project_manager_id != self.request.user.id:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Tu ne peux initier une demande que pour un projet que tu diriges.")
        amount = serializer.validated_data['amount']
        serializer.save(
            requested_by=self.request.user,
            status=DisbursementRequest.initial_status_for_amount(amount),
        )

    @extend_schema(
        tags=['Finance & Comptabilité'],
        summary='Give validation to a disbursement request (§4.3)',
        description="Which role can approve depends on the request's current tier "
        "(EN_ATTENTE_N1/N2/N3, set from the amount at creation — see "
        "DisbursementRequest.initial_status_for_amount): Comptable for N1 "
        "(<10 000 FCFA), Directeur Financier for N2 (10 000-50 000), Super-Admin "
        "for N3 (>50 000, standing in for the spec's \"direction générale\", no "
        "dedicated role exists). A higher tier's role can always approve a lower "
        "one. Rejecting requires `rejection_reason`.",
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
        if not _can_approve_tier(request.user, disbursement.status):
            return Response(status=status.HTTP_403_FORBIDDEN)

        decision = request.data.get('decision')
        if decision not in (DisbursementRequest.Status.APPROUVE, DisbursementRequest.Status.REJETE):
            return Response({'detail': 'decision doit être APPROUVE ou REJETE.'}, status=status.HTTP_400_BAD_REQUEST)

        rejection_reason = (request.data.get('rejection_reason') or '').strip()
        if decision == DisbursementRequest.Status.REJETE and not rejection_reason:
            return Response({'detail': 'Un motif de rejet est obligatoire.'}, status=status.HTTP_400_BAD_REQUEST)

        disbursement.status = decision
        disbursement.rejection_reason = rejection_reason if decision == DisbursementRequest.Status.REJETE else ''
        disbursement.decided_by = request.user
        disbursement.decided_at = timezone.now()
        disbursement.save(update_fields=['status', 'rejection_reason', 'decided_by', 'decided_at'])
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
        return Response(DisbursementRequestSerializer(disbursement).data)


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
        serializer.save(created_by=self.request.user)

    def update(self, request, *args, **kwargs):
        invoice = self.get_object()
        if invoice.status != Invoice.Status.BROUILLON:
            return Response({'detail': 'Une facture validée ne peut plus être modifiée.'}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

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

    def perform_create(self, serializer):
        invoice_id = self.kwargs.get('invoice_id')
        try:
            invoice = Invoice.objects.get(id=invoice_id)
        except Invoice.DoesNotExist:
            raise serializers.ValidationError('Invoice not found')

        payment = serializer.save(invoice=invoice)

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
