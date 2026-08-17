"""Celery tasks pour le module Finance — relances factures, exports, etc."""

from datetime import datetime, timedelta
from django.utils import timezone
from django.core.mail import EmailMessage
from django.db.models import Q

from core.celery_utils import safe_dispatch
from core.notifications import notify
from finance.models import Invoice
from finance.pdf import generate_invoice_pdf, get_invoice_filename
from sokens_backend.celery import app


@app.task(bind=True, max_retries=3)
def send_invoice_pdf_email(self, invoice_id: str):
    """
    Envoie une facture par email au client avec PDF en pièce jointe.

    Args:
        invoice_id: UUID de la facture

    Retry: jusqu'à 3 fois en cas d'erreur (délai exponentiel)
    """
    from finance.models import Invoice

    try:
        invoice = Invoice.objects.get(id=invoice_id)
    except Invoice.DoesNotExist:
        return f'Invoice {invoice_id} not found'

    # Déterminer adresse email client
    client_email = None
    if invoice.client and invoice.client.email:
        client_email = invoice.client.email
    elif invoice.quote and invoice.quote.lead and invoice.quote.lead.email:
        client_email = invoice.quote.lead.email

    if not client_email:
        return f'No client email found for invoice {invoice.invoice_number}'

    try:
        # Générer PDF
        pdf_bytes = generate_invoice_pdf(invoice)

        # Préparer email
        subject = f'Facture {invoice.invoice_number} - Sokens Digital'
        message = f"""
Bonjour,

Veuillez trouver en pièce jointe votre facture n°{invoice.invoice_number}, datée du {invoice.issue_date.strftime('%d/%m/%Y')}.

Montant TTC: {invoice.amount_ttc} FCFA
Date d'échéance: {invoice.due_date.strftime('%d/%m/%Y') if invoice.due_date else 'À l\'établissement'}

Nous vous remercions de votre confiance.

Cordialement,
Sokens Digital
"""

        email = EmailMessage(
            subject=subject,
            body=message,
            from_email=None,  # Utilise DEFAULT_FROM_EMAIL de settings
            to=[client_email],
        )
        email.attach(get_invoice_filename(invoice), pdf_bytes.getvalue(), 'application/pdf')
        email.send()

        return f'Invoice {invoice.invoice_number} sent to {client_email}'

    except Exception as exc:
        # Retry avec backoff exponentiel (2^retries secondes)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@app.task
def send_invoice_reminders():
    """
    Envoie des relances pour factures impayées.

    Logique:
    - Factures VALIDEE avec due_date < aujourd'hui
    - Première relance: due_date + 7 jours
    - Deuxième relance: due_date + 14 jours
    - Pas de 3e relance (arrêter après 14 jours)

    Safe dispatch: log en cas d'erreur, ne bloque pas le cron.
    """

    def _do_send():
        now = timezone.now().date()
        invoices = Invoice.objects.filter(
            status=Invoice.Status.VALIDEE,
            due_date__lt=now,
        ).select_related('client', 'quote__lead', 'created_by')

        for invoice in invoices:
            days_overdue = (now - invoice.due_date).days

            # Première relance: 7-14 jours
            if 7 <= days_overdue < 14:
                subject = f'Rappel: Facture {invoice.invoice_number} en retard'
                message = f"""
Facture {invoice.invoice_number} due le {invoice.due_date.strftime('%d/%m/%Y')} n'a pas été payée.

Montant: {invoice.amount_ttc} FCFA

Nous vous demandons de régulariser votre situation au plus tôt.
"""
                try:
                    safe_dispatch(
                        send_invoice_pdf_email.apply_async,
                        args=[str(invoice.id)],
                    )
                except Exception as e:
                    print(f'Failed to send reminder for {invoice.invoice_number}: {e}')

            # Notification interne après 30 jours
            if days_overdue >= 30:
                if invoice.created_by:
                    notify(
                        user=invoice.created_by,
                        title='Facture en impayé critique',
                        message=f'Facture {invoice.invoice_number}: {days_overdue} jours de retard',
                        notification_type='INVOICE_OVERDUE',
                        link=f'/admin/finance/facturation/{invoice.id}/',
                        email=True,
                    )

    safe_dispatch(_do_send)
    return 'Invoice reminders sent'


@app.task(bind=True, max_retries=3)
def generate_payment_receipt_pdf(self, receipt_id: str):
    """
    Génère un PDF reçu de versement.

    Args:
        receipt_id: UUID de PaymentReceipt
    """
    from finance.models import PaymentReceipt
    from finance.pdf import generate_invoice_pdf  # Réutiliser template pour version "receipt"
    from django.template.loader import render_to_string
    from django.utils import timezone

    try:
        receipt = PaymentReceipt.objects.get(id=receipt_id)
    except PaymentReceipt.DoesNotExist:
        return f'Receipt {receipt_id} not found'

    try:
        from weasyprint import HTML

        payment = receipt.payment
        invoice = payment.invoice

        context = {
            'receipt': receipt,
            'payment': payment,
            'invoice': invoice,
            'issue_date': timezone.now().strftime('%d/%m/%Y'),
        }

        html_string = render_to_string('finance/payment_receipt_pdf.html', context)
        pdf_file = HTML(string=html_string, base_url=None).write_pdf()

        return f'Receipt {receipt.receipt_number} generated'

    except Exception as exc:
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)


@app.task
def post_invoice_journal_entry(invoice_id: str):
    """
    Enregistre une facture 100% payée en comptabilité (JournalEntry + TransactionLine).

    Appelée quand last payment reçu && invoice.status = VALIDEE.
    """
    from finance.models import Invoice, JournalEntry, TransactionLine, FinanceSettings
    from decimal import Decimal

    try:
        invoice = Invoice.objects.get(id=invoice_id)
    except Invoice.DoesNotExist:
        return f'Invoice {invoice_id} not found'

    # Vérifier si déjà enregistrée
    if JournalEntry.objects.filter(source_invoice=invoice).exists():
        return f'Invoice {invoice.invoice_number} already posted'

    settings = FinanceSettings.load()

    # Créer JournalEntry (Ventes = VE)
    entry = JournalEntry.objects.create(
        period_id=AccountingPeriod.objects.filter(
            start_date__lte=invoice.issue_date,
            end_date__gte=invoice.issue_date,
            status=AccountingPeriod.Status.OUVERTE
        ).first().id if AccountingPeriod.objects.filter(
            start_date__lte=invoice.issue_date,
            end_date__gte=invoice.issue_date
        ).exists() else None,
        journal_code=JournalEntry.JournalCode.VENTES,
        date=invoice.issue_date,
        label=f'Facture {invoice.invoice_number}',
        source_invoice=invoice,
    )

    if not entry.period_id:
        entry.delete()
        return f'No open accounting period for invoice date'

    # Lignes: Débit Client, Crédit Sales, Crédit VAT
    vat_amount = invoice.amount_ttc - invoice.amount_ht

    TransactionLine.objects.create(
        entry=entry,
        account_id=Account.objects.get_or_create(
            code=settings.default_client_account_code,
            defaults={'name': 'Clients', 'account_class': Account.AccountClass.ACTIF}
        )[0].id,
        label=f'Client: {invoice.client.company_name if invoice.client else invoice.client_name}',
        debit=invoice.amount_ttc,
    )

    TransactionLine.objects.create(
        entry=entry,
        account_id=Account.objects.get_or_create(
            code=settings.default_sales_account_code,
            defaults={'name': 'Prestations', 'account_class': Account.AccountClass.PRODUIT}
        )[0].id,
        label='Ventes',
        credit=invoice.amount_ht,
    )

    TransactionLine.objects.create(
        entry=entry,
        account_id=Account.objects.get_or_create(
            code=settings.default_vat_collected_account_code,
            defaults={'name': 'TVA Collectée', 'account_class': Account.AccountClass.TVA}
        )[0].id,
        label=f'TVA {invoice.vat_rate*100:.0f}%',
        credit=vat_amount,
    )

    return f'Invoice {invoice.invoice_number} posted'


@app.task
def export_fec(period_id: str):
    """
    Exporte un fichier FEC simplifié pour une période comptable.

    FEC "Fichier des Écritures Comptables" — format texte simplifié (8 colonnes,
    pas le format DGFiP certifié à 18 colonnes). À utiliser pour archivage seulement,
    pas pour dépôt fiscal.

    Args:
        period_id: UUID de la période (AccountingPeriod)

    Returns:
        Path du fichier généré (ou error message)
    """
    from finance.models import AccountingPeriod, JournalEntry
    from django.core.files.base import ContentFile
    from django.core.files.storage import default_storage
    import csv
    from io import StringIO

    try:
        period = AccountingPeriod.objects.get(id=period_id)
    except AccountingPeriod.DoesNotExist:
        return f'Period {period_id} not found'

    entries = JournalEntry.objects.filter(period=period).prefetch_related('lines').order_by('date')

    # Générer CSV
    output = StringIO()
    writer = csv.writer(output, delimiter='|')

    # Headers FEC simplifié
    writer.writerow([
        'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
        'CompteNum', 'CompteLib', 'DebitCredit', 'EcritureMontant',
    ])

    for entry in entries:
        for line in entry.lines.all():
            debit_credit = 'D' if line.debit > 0 else 'C'
            amount = line.debit or line.credit

            writer.writerow([
                entry.journal_code,
                entry.get_journal_code_display(),
                entry.id.hex[:10],  # Ref unique = début UUID
                entry.date.isoformat(),
                line.account.code,
                line.account.name,
                debit_credit,
                str(amount),
            ])

    # Sauvegarder
    filename = f"FEC_{period.label}_{timezone.now().isoformat()[:10]}.txt"
    path = f"exports/fec/{filename}"
    default_storage.save(path, ContentFile(output.getvalue()))

    return f'FEC exported to {path}'
