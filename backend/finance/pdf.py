"""PDF des factures (WeasyPrint), d'après le modèle papier de Soken's Digital.

Même mise en page que l'aperçu de l'admin
(frontend/components/admin/finance/invoice-document.tsx). Les coordonnées de
la société, les moyens de paiement et le cachet viennent des paramètres des
devis (marketing.QuoteSettings), partagés par tous les documents commerciaux.
"""

from decimal import Decimal, ROUND_HALF_UP
from io import BytesIO

from django.template.loader import render_to_string

try:
    from weasyprint import HTML
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError):
    # OSError (pas seulement ImportError): weasyprint plante au chargement
    # si la lib native GTK/Pango manque sur la machine (courant en dev
    # Windows sans GTK3 installé) — pas juste quand le paquet pip est absent.
    WEASYPRINT_AVAILABLE = False


def _amount(value) -> str:
    """« 10 000 » — arrondi à l'unité, espace fine comme séparateur."""
    amount = Decimal(value or 0).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    return f'{amount:,.0f}'.replace(',', ' ')


def _quantity(value) -> str:
    value = Decimal(str(value or 0))
    return f'{value.normalize():f}' if value == value.to_integral() else f'{value:.2f}'.replace('.', ',')


def render_invoice_html(invoice) -> str:
    """HTML de la facture, avant conversion en PDF — séparé pour être testé
    sans WeasyPrint."""
    from marketing.models import QuoteSettings
    from marketing.quote_pdf import LOGO_PATH

    settings_obj = QuoteSettings.load()
    if invoice.lines:
        lines = [
            {
                'description': (line.get('description') or '').strip(),
                'quantity': _quantity(line.get('quantity')),
                'unit_price': _amount(line.get('unit_price')),
                'total': _amount(Decimal(str(line.get('quantity') or 0)) * Decimal(str(line.get('unit_price') or 0))),
                'note': line.get('note', ''),
            }
            for line in invoice.lines
        ]
    else:
        # Facture saisie avec un montant global (ancien format) : une ligne.
        label = f'Prestations — devis {invoice.quote.quote_number}' if invoice.quote_id else 'Prestations'
        lines = [{'description': label, 'quantity': '1', 'unit_price': _amount(invoice.amount_ht), 'total': _amount(invoice.amount_ht)}]

    amount_paid = invoice.amount_paid
    discount = Decimal(invoice.discount_amount or 0)
    client_label = invoice.client.company_name if invoice.client_id else (invoice.client_name or 'Client')
    context = {
        'invoice': invoice,
        'settings': settings_obj,
        'accent': invoice.document_color or '#123f91',
        'logo_uri': LOGO_PATH.as_uri() if LOGO_PATH.exists() else '',
        'display_number': invoice.invoice_number,
        'client_label': client_label,
        'address_lines': (settings_obj.company_address or '').split('\n'),
        'lines': lines,
        'quote_number': invoice.quote.quote_number if invoice.quote_id else '',
        'show_discount': discount > 0,
        'subtotal': f'{_amount(invoice.amount_ht + discount)} FCFA',
        'discount': f'{_amount(discount)} FCFA',
        'discount_reason': invoice.discount_reason,
        'show_vat': bool(invoice.vat_rate),
        'vat_percent': _quantity(Decimal(invoice.vat_rate) * 100),
        'amount_ht': f'{_amount(invoice.amount_ht)} FCFA',
        'vat_amount': f'{_amount(invoice.amount_ttc - invoice.amount_ht)} FCFA',
        'amount_ttc': f'{_amount(invoice.amount_ttc)} FCFA',
        'amount_paid': f'{_amount(amount_paid)} FCFA',
        'amount_due': f'{_amount(max(invoice.amount_ttc - amount_paid, Decimal("0")))} FCFA',
        'payment_methods': [
            m.get('label', '') if isinstance(m, dict) else str(m)
            for m in (settings_obj.payment_methods or [])
        ],
    }
    return render_to_string('finance/invoice_pdf.html', context)


def render_receipt_html(receipt) -> str:
    """HTML du reçu d'un versement : montant reçu, et situation de la facture
    en comptant les versements reçus jusqu'à celui-ci inclus."""
    from django.utils import timezone
    from finance.models import Payment
    from marketing.models import QuoteSettings
    from marketing.quote_pdf import LOGO_PATH

    payment = receipt.payment
    invoice = payment.invoice
    settings_obj = QuoteSettings.load()
    received = invoice.payments.filter(
        status__in=[Payment.Status.RECU, Payment.Status.ENREGISTRE],
        created_at__lte=payment.created_at,
    )
    paid_to_date = sum((p.amount for p in received), Decimal('0'))
    remaining = max(invoice.amount_ttc - paid_to_date, Decimal('0'))
    client_label = invoice.client.company_name if invoice.client_id else (invoice.client_name or 'Client')
    context = {
        'receipt': receipt,
        'payment': payment,
        'invoice': invoice,
        'settings': settings_obj,
        'accent': invoice.document_color or '#123f91',
        'logo_uri': LOGO_PATH.as_uri() if LOGO_PATH.exists() else '',
        'client_label': client_label,
        'address_lines': (settings_obj.company_address or '').split('\n'),
        'payment_date': payment.payment_date.strftime('%d/%m/%Y'),
        'method': payment.get_payment_method_display(),
        'amount': f'{_amount(payment.amount)} FCFA',
        'invoice_total': f'{_amount(invoice.amount_ttc)} FCFA',
        'paid_to_date': f'{_amount(paid_to_date)} FCFA',
        'remaining': f'{_amount(remaining)} FCFA',
        'settled': remaining <= 0,
        'issued_on': timezone.localtime(receipt.created_at).strftime('%d/%m/%Y'),
    }
    return render_to_string('finance/payment_receipt_pdf.html', context)


def generate_receipt_pdf(receipt) -> bytes:
    """PDF du reçu. Lève ImportError si WeasyPrint est indisponible."""
    if not WEASYPRINT_AVAILABLE:
        raise ImportError('weasyprint not installed. Install via: pip install weasyprint')
    return HTML(string=render_receipt_html(receipt), base_url=None).write_pdf()


def generate_invoice_pdf(invoice):
    """PDF de la facture, en BytesIO. Lève ImportError si WeasyPrint (ou sa
    lib native) est indisponible sur ce serveur."""
    if not WEASYPRINT_AVAILABLE:
        raise ImportError('weasyprint not installed. Install via: pip install weasyprint')

    pdf_file = BytesIO()
    HTML(string=render_invoice_html(invoice), base_url=None).write_pdf(pdf_file)
    pdf_file.seek(0)
    return pdf_file


def get_invoice_filename(invoice):
    """Generate a filename for the invoice PDF."""
    return f"{invoice.invoice_number}.pdf"
