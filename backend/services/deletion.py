"""Suppression complète d'un abonnement (Super-Admin) : abonnement,
périodes, livrables, et les factures de ses périodes, supprimées proprement
par finance.invoice_deletion (versements, reçus, pièces jointes, écritures).

Refusée en bloc (rien supprimé) si une seule facture ne peut pas l'être
sans fausser la comptabilité."""
from django.db import transaction


def blocking_reasons(subscription) -> list[str]:
    from finance.invoice_deletion import invoice_blocking_reasons

    reasons = []
    for period in subscription.periods.select_related('invoice'):
        if period.invoice_id:
            reasons += invoice_blocking_reasons(period.invoice)
    return reasons


def delete_subscription(subscription, user, ip_address=None) -> dict:
    """À n'appeler qu'après blocking_reasons() == []."""
    from finance.invoice_deletion import delete_invoice_completely

    removed = {'invoices': [], 'payments': 0, 'journal_entries': 0}
    with transaction.atomic():
        for period in list(subscription.periods.select_related('invoice')):
            if period.invoice_id:
                r = delete_invoice_completely(period.invoice, user, ip_address)  # emporte la période
                removed['invoices'].append(r['invoice'])
                removed['payments'] += r['payments']
                removed['journal_entries'] += r['journal_entries']
            else:
                period.deliverables.all().delete()
                period.delete()
        subscription.delete(user=user, ip_address=ip_address)
    return removed
