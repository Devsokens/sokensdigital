from io import BytesIO
from django.template.loader import render_to_string
from django.utils import timezone
from weasyprint import HTML, CSS
from decimal import Decimal


def generate_cash_voucher_pdf(voucher):
    """Générer PDF pièce de caisse (entrée/sortie)."""
    context = {
        'voucher': voucher,
        'company_address': 'Adresse Sokens Digital',
        'company_phone': '+XXX-XXX-XXXX',
        'company_email': 'contact@sokensdigital.com',
        'additional_notes': '',
        'now': timezone.now(),
    }

    html_string = render_to_string('treasury/cash_voucher_pdf.html', context)
    html = HTML(string=html_string)
    pdf_bytes = html.write_pdf()

    return BytesIO(pdf_bytes)


def generate_cash_register_statement_pdf(period_start, period_end, cash_entries, cashier_name):
    """Générer PDF état de caisse (brouillard de caisse)."""

    # Calculer totaux et soldes courants
    total_entries = Decimal('0')
    total_exits = Decimal('0')
    running_balance = Decimal('0')

    entries_with_balance = []
    for entry in cash_entries:
        if entry.type == 'ENTREE':
            total_entries += entry.amount
            running_balance += entry.amount
        else:
            total_exits += entry.amount
            running_balance -= entry.amount

        entry_copy = entry
        entry_copy.running_balance = running_balance
        entries_with_balance.append(entry_copy)

    context = {
        'period_start': period_start,
        'period_end': period_end,
        'cash_entries': entries_with_balance,
        'total_entries': total_entries,
        'total_exits': total_exits,
        'final_balance': running_balance,
        'cashier_name': cashier_name,
        'company_address': 'Adresse Sokens Digital',
        'now': timezone.now(),
    }

    html_string = render_to_string('treasury/cash_register_statement_pdf.html', context)
    html = HTML(string=html_string)
    pdf_bytes = html.write_pdf()

    return BytesIO(pdf_bytes)


def generate_disbursement_request_pdf(disbursement):
    """Générer PDF demande de décaissement."""
    context = {
        'disbursement': disbursement,
        'company_address': 'Adresse Sokens Digital',
        'now': timezone.now(),
    }

    html_string = render_to_string('treasury/disbursement_request_pdf.html', context)
    html = HTML(string=html_string)
    pdf_bytes = html.write_pdf()

    return BytesIO(pdf_bytes)


def get_cash_voucher_filename(voucher):
    """Retourne nom fichier pour pièce de caisse."""
    return f'{voucher.voucher_number}.pdf'


def get_cash_register_statement_filename(period_year, period_month):
    """Retourne nom fichier pour état de caisse."""
    return f'EtatCaisse_{period_year}{period_month:02d}.pdf'


def get_disbursement_request_filename(disbursement):
    """Retourne nom fichier pour demande de décaissement."""
    return f'DecaissementN{disbursement.id}.pdf'
