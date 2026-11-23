"""Run periodically (e.g. once a day) by an external scheduler — same
reasoning as marketing/management/commands/publish_scheduled_posts.py:
no worker/beat process is deployed, so a plain management command is
what an external cron (GitHub Actions, Render Cron Job) calls.

Cahier des charges §4.7 "Relances — relances automatiques pour les
devis en attente et factures impayées". Notifies (in-app, via
core.notifications.notify) whoever owns the quote/invoice — this is a
reminder to THEM to follow up with the client, not an email sent to the
client directly (no client contact/portal login exists to notify there
yet, see marketing.models.Lead's own "client account" TODO).
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import models
from django.utils import timezone

from core.notifications import notify
from finance.models import Invoice
from marketing.models import Quote

QUOTE_REMINDER_AFTER_DAYS = 5


def overdue_invoice_recipients(invoice):
    """Relance INTERNE : personne n'écrit au client automatiquement. On
    prévient le département qui porte la facture (son auteur ; pour une
    facture d'abonnement, les responsables du pôle) et la Comptabilité &
    Finance (Comptables + RCF désigné), qui relancent le client à la main."""
    from core.constants import ROLE_COMPTABLE
    from core.models import User

    users = {}
    if invoice.created_by_id and invoice.created_by.is_active:
        users[invoice.created_by_id] = invoice.created_by
    # Reverse one-to-one absent : RelatedObjectDoesNotExist (AttributeError) → None.
    period = getattr(invoice, 'service_period', None)
    role_names = [ROLE_COMPTABLE]
    if period is not None:
        from services.permissions import pole_roles
        role_names += list(pole_roles(period.subscription.offer.pole))
    qs = User.objects.filter(is_active=True).filter(
        models.Q(roles__name__in=role_names) | models.Q(is_rcf=True)
    ).distinct()
    for u in qs:
        users.setdefault(u.pk, u)
    return list(users.values())


def notify_overdue_invoices(today):
    """Factures validées, échues ET non soldées (une facture payée garde le
    statut VALIDEE : on compare le payé au TTC)."""
    count = 0
    invoices = Invoice.objects.filter(status=Invoice.Status.VALIDEE, due_date__lt=today).select_related('created_by')
    for invoice in invoices:
        if invoice.amount_paid >= invoice.amount_ttc:
            continue
        days = (today - invoice.due_date).days
        due = invoice.amount_ttc - invoice.amount_paid
        for user in overdue_invoice_recipients(invoice):
            notify(
                user,
                title=f'Facture {invoice.invoice_number} impayée — relance client à faire',
                message=(f'« {invoice.client_name} » — échéance dépassée de {days} jour{"s" if days > 1 else ""}, '
                         f'reste dû {due:,.0f} FCFA. Contactez le client manuellement.').replace(',', ' '),
                notification_type='GENERAL',
                link=f'/admin/finance/facturation/{invoice.id}',
            )
        count += 1
    return count


class Command(BaseCommand):
    help = 'Relance les devis envoyés sans réponse et les factures validées en retard de paiement.'

    def handle(self, *args, **options):
        now = timezone.now()
        today = now.date()

        stale_quotes = Quote.objects.filter(
            status=Quote.Status.ENVOYE,
            sent_at__lte=now - timedelta(days=QUOTE_REMINDER_AFTER_DAYS),
        ).select_related('created_by')
        quote_count = 0
        for quote in stale_quotes:
            if not quote.created_by:
                continue
            days_pending = (now - quote.sent_at).days
            notify(
                quote.created_by,
                title=f'Devis {quote.quote_number} sans réponse',
                message=f'« {quote.client_name or quote.quote_number} » n\'a pas répondu depuis {days_pending} jours — une relance est peut-être nécessaire.',
                notification_type='GENERAL',
                link='/admin/marketing/devis',
            )
            quote_count += 1

        invoice_count = notify_overdue_invoices(today)

        self.stdout.write(f'{quote_count} devis relancé(s), {invoice_count} facture(s) impayée(s) signalée(s).')
