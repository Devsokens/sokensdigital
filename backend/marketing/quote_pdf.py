"""PDF du devis envoyé au client en pièce jointe (WeasyPrint, comme les bons
de demande de décaissement — voir treasury/pdf.py)."""
from decimal import Decimal, ROUND_HALF_UP

from django.template.loader import render_to_string
from django.utils import timezone

from marketing.models import DEFAULT_VAT_RATE, QuoteSettings, SiteSettings


def _fcfa(value) -> str:
    """12 345 678 — espaces insécables comme séparateur de milliers."""
    amount = Decimal(value or 0).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    return f'{amount:,.0f}'.replace(',', ' ')


def _qty(value) -> str:
    value = Decimal(value or 0)
    return f'{value.normalize():f}' if value == value.to_integral() else f'{value:.2f}'.replace('.', ',')


def build_quote_pdf(quote) -> bytes:
    """Rend le devis en PDF. Lève ImportError si WeasyPrint (ou sa lib
    native) est indisponible sur ce serveur."""
    from treasury.pdf import _require_weasyprint
    _require_weasyprint()
    from weasyprint import HTML

    return HTML(string=render_quote_html(quote)).write_pdf()


def render_quote_html(quote) -> str:
    """HTML du devis, avant conversion en PDF — séparé pour être testé sans
    WeasyPrint (indisponible en dev Windows)."""
    settings_obj = QuoteSettings.load()
    site = SiteSettings.load()
    lines = list(quote.lines.all())
    subtotal = sum((line.total_line for line in lines), Decimal('0'))
    total_ht = Decimal(quote.total_ht or 0)
    payment_terms = []
    for term in quote.payment_terms or []:
        if not isinstance(term, dict):
            continue
        pct = Decimal(str(term.get('percentage') or 0))
        payment_terms.append({
            'label': term.get('label', ''),
            'percentage': _qty(pct),
            'amount': _fcfa(total_ht * pct / 100),
        })
    methods = [
        m.get('label', '') if isinstance(m, dict) else str(m)
        for m in (settings_obj.payment_methods or [])
    ]

    context = {
        'quote': quote,
        'settings': settings_obj,
        'logo_url': getattr(site, 'logo_url', ''),
        'lines': [
            {
                'service_title': line.service_title,
                'description': line.description,
                'quantity': _qty(line.quantity),
                'unit_price': _fcfa(line.unit_price),
                'total_line': _fcfa(line.total_line),
            }
            for line in lines
        ],
        'subtotal': _fcfa(subtotal),
        'discount': _fcfa(quote.discount_amount),
        'total_ht': _fcfa(total_ht),
        'total_ttc': _fcfa(quote.total_ttc),
        'vat_percent': _qty(DEFAULT_VAT_RATE * 100),
        'vat_amount': _fcfa(Decimal(quote.total_ttc or 0) - total_ht),
        'payment_terms': payment_terms,
        'payment_methods': ', '.join(m for m in methods if m),
        'show_ttc': settings_obj.amount_basis != QuoteSettings.AmountBasis.HT,
        'now': timezone.now(),
    }
    return render_to_string('marketing/quote_pdf.html', context)
