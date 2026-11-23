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
    """Relance INTERNE des factures échues non soldées : aucun e-mail au
    client — le département concerné et la Comptabilité & Finance sont
    notifiés et relancent le client manuellement. Même logique que la
    tâche quotidienne (core send_quote_and_invoice_reminders)."""
    from core.management.commands.send_quote_and_invoice_reminders import notify_overdue_invoices

    notify_overdue_invoices(timezone.now().date())
    return 'Invoice reminders sent'


@app.task(bind=True, max_retries=3)
def generate_payment_receipt_pdf(self, receipt_id: str):
    """
    Génère un PDF reçu de versement.

    Args:
        receipt_id: UUID de PaymentReceipt
    """
    from finance.models import PaymentReceipt

    try:
        receipt = PaymentReceipt.objects.get(id=receipt_id)
    except PaymentReceipt.DoesNotExist:
        return f'Receipt {receipt_id} not found'

    try:
        from finance.pdf import generate_receipt_pdf

        generate_receipt_pdf(receipt)

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
    vat_amount = invoice.vat_amount

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

    if invoice.css_amount:
        TransactionLine.objects.create(
            entry=entry,
            account_id=Account.objects.get_or_create(
                code=settings.default_css_collected_account_code or '4478',
                defaults={'name': 'CSS collectée', 'account_class': Account.AccountClass.TVA},
            )[0].id,
            label=f'CSS {invoice.css_rate*100:.0f}%',
            credit=invoice.css_amount,
        )

    for tax in invoice.extra_taxes or []:
        amount = Decimal(str(tax.get('amount') or 0))
        if amount:
            TransactionLine.objects.create(
                entry=entry,
                account_id=Account.objects.get_or_create(
                    code=settings.default_other_taxes_account_code or '447',
                    defaults={'name': 'État, autres impôts et taxes', 'account_class': Account.AccountClass.TVA},
                )[0].id,
                label=f"{tax.get('name', 'Taxe')} {tax.get('percent')}%",
                credit=amount,
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
