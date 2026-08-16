"""PDF generation for invoices — uses weasyprint for reliable rendering."""

from io import BytesIO
from datetime import datetime
from django.template.loader import render_to_string
from django.utils.text import slugify

try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except ImportError:
    WEASYPRINT_AVAILABLE = False


def generate_invoice_pdf(invoice):
    """
    Generate a PDF invoice from an Invoice model instance.

    Args:
        invoice: finance.Invoice instance

    Returns:
        BytesIO PDF content, or None if weasyprint not installed

    Raises:
        ImportError if weasyprint not available
    """
    if not WEASYPRINT_AVAILABLE:
        raise ImportError('weasyprint not installed. Install via: pip install weasyprint')

    # Get client name from either Client FK or legacy client_name field
    client_display = ''
    if invoice.client:
        client_display = f"{invoice.client.company_name}"
        if invoice.client.siret:
            client_display += f" (SIRET: {invoice.client.siret})"
    else:
        client_display = invoice.client_name

    context = {
        'invoice': invoice,
        'client_display': client_display,
        'issue_date': invoice.issue_date.strftime('%d/%m/%Y'),
        'due_date': invoice.due_date.strftime('%d/%m/%Y') if invoice.due_date else 'À l\'établissement',
        'vat_amount': invoice.amount_ttc - invoice.amount_ht,
        'generated_at': datetime.now().strftime('%Y-%m-%d %H:%M'),
    }

    # Render HTML template
    html_string = render_to_string('finance/invoice_pdf.html', context)

    # Convert to PDF
    pdf_file = BytesIO()
    HTML(string=html_string, base_url=None).write_pdf(pdf_file)
    pdf_file.seek(0)

    return pdf_file


def get_invoice_filename(invoice):
    """Generate a filename for the invoice PDF."""
    return f"{invoice.invoice_number}.pdf"
