from celery import shared_task
from django.utils import timezone
from django.shortcuts import get_object_or_404
from decimal import Decimal
import logging

from procurement.models import SupplierQuote, SupplierInvoice
from finance.models import DisbursementRequest, JournalEntry, Account, FinanceSettings
from finance.accounting_helpers import get_or_create_account, resolve_open_period_for_date, post_balanced_entry
from core.celery_utils import safe_dispatch

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def create_disbursement_request_task(self, quote_id):
    """
    Auto-crée DisbursementRequest (décaissement) quand devis validé par Manager.

    IMPORTANT: le décaissement généré retombe dans le circuit d'approbation
    N1/N2/N3 normal (§4.3 cahier des charges) via initial_status_for_amount —
    la validation du devis n'équivaut PAS à une autorisation de paiement.
    Sans ça, un Manager RCF pourrait faire passer un paiement fournisseur
    de n'importe quel montant sans jamais solliciter Directeur Financier
    ou Direction Générale.
    """
    try:
        quote = get_object_or_404(SupplierQuote, id=quote_id)
        if quote.status != SupplierQuote.Status.VALIDE:
            return

        disbursement = DisbursementRequest.objects.create(
            amount=quote.amount_ttc,
            beneficiary=quote.supplier.name,
            reason=f'Décaissement devis {quote.quote_number} — {quote.supplier.name}',
            status=DisbursementRequest.initial_status_for_amount(quote.amount_ttc),
            requested_by=quote.manager_validated_by,
        )

        logger.info(f'✓ DisbursementRequest créé (statut {disbursement.status}): {disbursement.id}')

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
        if invoice.status != SupplierInvoice.Status.VALIDEE:
            return

        period = resolve_open_period_for_date(invoice.invoice_date)
        if not period:
            logger.warning(f'No open accounting period for supplier invoice {invoice_id}')
            return

        settings = FinanceSettings.load()
        account_purchases = get_or_create_account(
            settings.default_purchases_account_code, 'Achats', Account.AccountClass.CHARGE)
        account_supplier = get_or_create_account(
            settings.default_supplier_account_code, 'Fournisseurs', Account.AccountClass.PASSIF)

        vat_amount = invoice.amount_ttc - invoice.amount_ht

        lines = [
            {'account': account_purchases, 'label': f'Achats {invoice.supplier.name}', 'debit': invoice.amount_ht, 'credit': Decimal('0')},
        ]
        if vat_amount:
            account_vat_deductible = get_or_create_account(
                settings.default_vat_deductible_account_code, 'TVA déductible', Account.AccountClass.TVA)
            lines.append({'account': account_vat_deductible, 'label': f'TVA déductible {invoice.supplier.name}', 'debit': vat_amount, 'credit': Decimal('0')})
        lines.append(
            {'account': account_supplier, 'label': f'Fournisseur {invoice.supplier.name}', 'debit': Decimal('0'), 'credit': invoice.amount_ttc}
        )

        journal_entry = post_balanced_entry(
            period=period,
            journal_code=JournalEntry.JournalCode.ACHATS,
            date=invoice.invoice_date,
            label=f'Facture {invoice.invoice_number} — {invoice.supplier.name}',
            lines=lines,
        )

        invoice.status = SupplierInvoice.Status.PAYEE
        invoice.save()

        logger.info(f'✓ JournalEntry créé: {journal_entry.id} pour facture {invoice_id}')

    except Exception as exc:
        logger.error(f'✗ post_supplier_invoice_journal_entry error: {exc}')
        raise self.retry(exc=exc, countdown=60 * (2 ** self.request.retries))
