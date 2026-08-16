from celery import shared_task
from django.utils import timezone
from django.shortcuts import get_object_or_404
from decimal import Decimal
import logging

from procurement.models import SupplierQuote, SupplierInvoice
from finance.models import DisbursementRequest, JournalEntry, TransactionLine
from core.utils import safe_dispatch

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def create_disbursement_request_task(self, quote_id):
    """
    Auto-crée DisbursementRequest (décaissement) quand devis validé.
    Montant = quote.amount_ttc
    Description: "Décaissement devis {quote_number} — {supplier.name}"
    """
    try:
        quote = get_object_or_404(SupplierQuote, id=quote_id)
        if quote.status != SupplierQuote.Status.VALIDATED:
            return

        # Créer DisbursementRequest
        disbursement = DisbursementRequest.objects.create(
            amount=quote.amount_ttc,
            description=f'Décaissement devis {quote.quote_number} — {quote.supplier.name}',
            procurement_quote=quote,
            status=DisbursementRequest.Status.PENDING,
        )

        logger.info(f'✓ DisbursementRequest créé: {disbursement.id}')

    except Exception as exc:
        logger.error(f'✗ create_disbursement_request_task error: {exc}')
        # Retry with exponential backoff
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))


@shared_task(bind=True, max_retries=3)
def post_supplier_invoice_journal_entry(self, invoice_id):
    """
    Auto-poste JournalEntry quand facture fournisseur validée (status=VALIDATED).
    Comptabilité:
      Débit: Achats (60x) + TVA déductible (4456)
      Crédit: Fournisseur (401)
    """
    try:
        invoice = get_object_or_404(SupplierInvoice, id=invoice_id)
        if invoice.status != SupplierInvoice.Status.VALIDATED:
            return

        # Récupérer les codes de compte
        try:
            from finance.models import FinanceSettings
            settings = FinanceSettings.load()
            account_purchases = settings.default_account_purchases or '601'
            account_vat_deductible = settings.default_account_vat_deductible or '4456'
            account_supplier = settings.default_account_supplier or '401'
        except:
            # Fallback defaults
            account_purchases = '601'
            account_vat_deductible = '4456'
            account_supplier = '401'

        # Créer JournalEntry
        journal_entry = JournalEntry.objects.create(
            reference=f'FAC-{invoice.invoice_number}',
            description=f'Facture {invoice.invoice_number} — {invoice.supplier.name}',
            amount_ht=invoice.amount_ht,
            amount_ttc=invoice.amount_ttc,
            vat_rate=invoice.vat_rate,
            related_content_type=None,  # Lier au SupplierInvoice si GenericFK
            related_object_id=str(invoice.id),
        )

        # Ligne débit: Achats
        TransactionLine.objects.create(
            journal_entry=journal_entry,
            account_code=account_purchases,
            account_name=f'Achats — {invoice.supplier.name}',
            debit=invoice.amount_ht,
            credit=Decimal('0'),
            line_description=f'Achats {invoice.supplier.name}',
        )

        # Ligne débit: TVA déductible
        if invoice.vat_rate > 0:
            vat_amount = invoice.amount_ht * invoice.vat_rate
            TransactionLine.objects.create(
                journal_entry=journal_entry,
                account_code=account_vat_deductible,
                account_name='TVA déductible',
                debit=vat_amount,
                credit=Decimal('0'),
                line_description=f'TVA déductible {invoice.supplier.name}',
            )

        # Ligne crédit: Fournisseur
        TransactionLine.objects.create(
            journal_entry=journal_entry,
            account_code=account_supplier,
            account_name=f'Fournisseur {invoice.supplier.name}',
            debit=Decimal('0'),
            credit=invoice.amount_ttc,
            line_description=f'Fournisseur {invoice.supplier.name}',
        )

        invoice.status = SupplierInvoice.Status.PAID
        invoice.save()

        logger.info(f'✓ JournalEntry créé: {journal_entry.id} pour facture {invoice_id}')

    except Exception as exc:
        logger.error(f'✗ post_supplier_invoice_journal_entry error: {exc}')
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
