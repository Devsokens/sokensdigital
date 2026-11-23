"""Suppression complète d'un abonnement (Super-Admin) : abonnement, périodes,
livrables, et les factures de ses périodes avec tout ce qui en dépend
(versements, reçus, pièces jointes, écritures de vente).

Pour ne jamais laisser la comptabilité incohérente, la suppression est
refusée en bloc (rien n'est supprimé) si une facture :
- a une écriture dans une période comptable CLÔTURÉE (intouchable) ;
- a une ligne d'écriture rapprochée d'un relevé bancaire ;
- a un versement déjà enregistré en caisse ou en banque (Trésorerie) :
  cet argent existe réellement, la pièce de trésorerie doit d'abord être
  annulée par la Finance.
"""
import logging

from django.contrib.contenttypes.models import ContentType
from django.db import transaction

logger = logging.getLogger(__name__)


def blocking_reasons(subscription) -> list[str]:
    from finance.models import AccountingPeriod, JournalEntry

    reasons = []
    for period in subscription.periods.select_related('invoice'):
        invoice = period.invoice
        if not invoice:
            continue
        num = invoice.invoice_number
        entries = JournalEntry.objects.filter(source_invoice=invoice)
        if entries.filter(period__status=AccountingPeriod.Status.CLOTUREE).exists():
            reasons.append(f'{num} : écriture dans une période comptable clôturée.')
        if entries.filter(lines__matched_bank_transaction__isnull=False).exists():
            reasons.append(f'{num} : écriture rapprochée d’un relevé bancaire.')
        for payment in invoice.payments.all():
            if payment.cash_entries.exists() or payment.bank_entries.exists():
                reasons.append(f'{num} : versement du {payment.payment_date:%d/%m/%Y} enregistré en trésorerie (caisse/banque).')
    return reasons


def delete_subscription(subscription, user, ip_address=None) -> dict:
    """Supprime tout ; à n'appeler qu'après blocking_reasons() == []."""
    from core.models import DocumentAttachment
    from finance.models import Invoice, JournalEntry, Payment

    removed = {'invoices': [], 'payments': 0, 'journal_entries': 0}
    with transaction.atomic():
        periods = list(subscription.periods.select_related('invoice'))
        invoices = [p.invoice for p in periods if p.invoice_id]
        for period in periods:
            period.deliverables.all().delete()
        # Les périodes protègent leur facture (PROTECT) : elles partent d'abord.
        subscription.periods.all().delete()

        invoice_ct = ContentType.objects.get_for_model(Invoice)
        payment_ct = ContentType.objects.get_for_model(Payment)
        for invoice in invoices:
            payment_ids = [str(pk) for pk in invoice.payments.values_list('pk', flat=True)]
            attachments = DocumentAttachment.objects.filter(
                content_type=payment_ct, object_id__in=payment_ids,
            ) | DocumentAttachment.objects.filter(content_type=invoice_ct, object_id=str(invoice.pk))
            for att in attachments:
                try:
                    att.file.delete(save=False)
                except Exception:  # noqa: BLE001 — fichier déjà absent du stockage
                    logger.warning('Pièce jointe %s introuvable au stockage', att.pk)
                att.delete()
            entries = JournalEntry.objects.filter(source_invoice=invoice)
            removed['journal_entries'] += entries.count()
            entries.delete()  # lignes supprimées en cascade
            removed['payments'] += len(payment_ids)
            removed['invoices'].append(invoice.invoice_number)
            # Versements et reçus partent en cascade avec la facture.
            invoice.delete(user=user, ip_address=ip_address)

        subscription.delete(user=user, ip_address=ip_address)
    return removed
