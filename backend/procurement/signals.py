from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from decimal import Decimal

from procurement.models import SupplierQuote, SupplierInvoice
from procurement.tasks import (
    create_disbursement_request_task,
    post_supplier_invoice_journal_entry,
)


@receiver(post_save, sender=SupplierQuote)
def on_supplier_quote_validated(sender, instance, created, **kwargs):
    """
    Quand devis validé par Manager (status=VALIDATED):
    - Créer DisbursementRequest automatiquement
    Signal: post_save sur SupplierQuote.status=VALIDATED
    """
    if instance.status == SupplierQuote.Status.VALIDATED:
        # Async task pour créer DisbursementRequest
        create_disbursement_request_task.delay(str(instance.id))


@receiver(post_save, sender=SupplierInvoice)
def on_supplier_invoice_validated(sender, instance, created, **kwargs):
    """
    Quand facture validée (status=VALIDATED):
    - Créer JournalEntry automatiquement
      Débit: Achats (60x) + TVA déductible (4456)
      Crédit: Fournisseur (401)
    """
    if instance.status == SupplierInvoice.Status.VALIDATED:
        post_supplier_invoice_journal_entry.delay(str(instance.id))
