"""Suppression propre d'une facture, depuis Finance ou depuis la
suppression d'un abonnement : versements, reçus, pièces jointes, écritures
de vente, et période d'abonnement rattachée.

Refusée (rien supprimé) si la comptabilité ne peut pas être défaite sans
la fausser : écriture dans une période comptable clôturée, écriture
rapprochée d'un relevé bancaire, versement enregistré en caisse/banque."""
import logging

from django.contrib.contenttypes.models import ContentType
from django.db import transaction

logger = logging.getLogger(__name__)

DASHBOARD_CACHE_KEYS = ['finance:dashboard:v1', 'core:dashboard:v2']


def invoice_blocking_reasons(invoice) -> list[str]:
    from finance.models import AccountingPeriod, JournalEntry

    num = invoice.invoice_number
    reasons = []
    entries = JournalEntry.objects.filter(source_invoice=invoice)
    if entries.filter(period__status=AccountingPeriod.Status.CLOTUREE).exists():
        reasons.append(f'{num} : écriture dans une période comptable clôturée.')
    if entries.filter(lines__matched_bank_transaction__isnull=False).exists():
        reasons.append(f'{num} : écriture rapprochée d’un relevé bancaire.')
    for payment in invoice.payments.all():
        if payment.cash_entries.exists() or payment.bank_entries.exists():
            reasons.append(f'{num} : versement du {payment.payment_date:%d/%m/%Y} enregistré en trésorerie (caisse/banque).')
    return reasons


def delete_invoice_completely(invoice, user=None, ip_address=None) -> dict:
    """À appeler après invoice_blocking_reasons() == []."""
    from core.models import DocumentAttachment
    from finance.models import Invoice, JournalEntry, Payment

    with transaction.atomic():
        period = getattr(invoice, 'service_period', None)
        period_id = str(period.pk) if period is not None else None
        if period is not None:
            # La période d'abonnement n'existe que par sa facture.
            period.deliverables.all().delete()
            period.delete()
        payment_ids = [str(pk) for pk in invoice.payments.values_list('pk', flat=True)]
        attachments = DocumentAttachment.objects.filter(
            content_type=ContentType.objects.get_for_model(Payment), object_id__in=payment_ids,
        ) | DocumentAttachment.objects.filter(
            content_type=ContentType.objects.get_for_model(Invoice), object_id=str(invoice.pk),
        )
        for att in attachments:
            try:
                att.file.delete(save=False)
            except Exception:  # noqa: BLE001 — fichier déjà absent du stockage
                logger.warning('Pièce jointe %s introuvable au stockage', att.pk)
            att.delete()
        entries = JournalEntry.objects.filter(source_invoice=invoice)
        n_entries = entries.count()
        entries.delete()  # lignes en cascade
        number = invoice.invoice_number
        invoice.delete(user=user, ip_address=ip_address)  # versements et reçus en cascade
    invalidate_dashboards()
    return {'invoice': number, 'payments': len(payment_ids), 'journal_entries': n_entries,
            'service_period': period_id}


def invalidate_dashboards(*args, **kwargs):
    """Analytique Finance et tableau de bord global : données réelles après
    toute écriture, facture ou versement (création, modification, suppression)."""
    from django.core.cache import cache
    # Tout de suite, puis de nouveau après commit : entre les deux, une
    # requête concurrente a pu remettre en cache les anciens chiffres.
    cache.delete_many(DASHBOARD_CACHE_KEYS)
    transaction.on_commit(lambda: cache.delete_many(DASHBOARD_CACHE_KEYS))
