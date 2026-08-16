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
from django.utils import timezone

from core.notifications import notify
from finance.models import Invoice
from marketing.models import Quote

QUOTE_REMINDER_AFTER_DAYS = 5


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

        overdue_invoices = Invoice.objects.filter(
            status=Invoice.Status.VALIDEE,
            due_date__lt=today,
        ).select_related('created_by')
        invoice_count = 0
        for invoice in overdue_invoices:
            if not invoice.created_by:
                continue
            days_overdue = (today - invoice.due_date).days
            notify(
                invoice.created_by,
                title=f'Facture {invoice.invoice_number} impayée',
                message=f'« {invoice.client_name} » — échéance dépassée de {days_overdue} jour{"s" if days_overdue > 1 else ""}.',
                notification_type='GENERAL',
                link='/admin/finance/facturation',
            )
            invoice_count += 1

        self.stdout.write(f'{quote_count} devis relancé(s), {invoice_count} facture(s) impayée(s) signalée(s).')
