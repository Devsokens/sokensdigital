"""PDF du devis (téléchargement admin et pièce jointe du mail client),
généré par WeasyPrint comme les bons de décaissement (treasury/pdf.py).

Le gabarit marketing/quote_pdf.html reproduit l'aperçu de l'admin
(frontend/components/admin/marketing/quote-document-pages.tsx) : mêmes trois
pages A4, même bandeau à la couleur du devis, mêmes calculs. Toute
modification de l'un doit être reportée dans l'autre."""
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

from django.template.loader import render_to_string

from marketing.models import DEFAULT_VAT_RATE, QuoteSettings

# Copie de frontend/public/assets/logo-sokens-digital-white.png : le serveur
# ne voit pas les fichiers du site, et un fichier local évite un appel réseau
# à chaque PDF.
LOGO_PATH = Path(__file__).resolve().parent / 'static' / 'marketing' / 'logo-sokens-digital-white.png'


def _fcfa(value) -> str:
    """« 1 250 000 FCFA » — arrondi à l'unité, comme formatFCFA côté site."""
    amount = Decimal(value or 0).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
    return f'{amount:,.0f}'.replace(',', ' ') + ' FCFA'


def _paragraphs(text: str) -> list[list[str]]:
    """Paragraphes séparés par une ligne vide, chacun découpé en lignes
    (même règle que <Paragraphs> dans l'aperçu)."""
    blocks = [block for block in (text or '').split('\n\n') if block.strip()]
    return [block.strip('\n').split('\n') for block in blocks]


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
    lines = list(quote.lines.all())
    # Même calcul que l'aperçu : total des lignes moins la remise (HT).
    total = sum((line.total_line for line in lines), Decimal('0')) - Decimal(quote.discount_amount or 0)
    terms = quote.payment_terms or settings_obj.default_payment_terms or []

    payment_terms = []
    for term in terms:
        if not isinstance(term, dict):
            continue
        pct = Decimal(str(term.get('percentage') or 0))
        payment_terms.append({
            'label': term.get('label', ''),
            'percentage': f'{pct.normalize():f}',
            'amount': _fcfa(total * pct / 100),
        })

    context = {
        'quote': quote,
        'settings': settings_obj,
        'accent': quote.document_color or '#123f91',
        'logo_uri': LOGO_PATH.as_uri() if LOGO_PATH.exists() else '',
        'client_label': quote.client_name or 'Client',
        'intro_paragraphs': _paragraphs(quote.intro_message),
        'description_paragraphs': _paragraphs(quote.description),
        'address_lines': [line for line in (settings_obj.company_address or '').split('\n')],
        'lines': [
            {
                'service_title': line.service_title,
                'description': line.description,
                'amount': line.amount_label or _fcfa(line.total_line),
            }
            for line in lines
        ],
        'show_ttc': settings_obj.amount_basis != QuoteSettings.AmountBasis.HT,
        'total_ht': _fcfa(total),
        'vat_percent': f'{(DEFAULT_VAT_RATE * 100).normalize():f}',
        'vat_amount': _fcfa(total * DEFAULT_VAT_RATE),
        'total_ttc': _fcfa(total * (1 + DEFAULT_VAT_RATE)),
        'payment_terms': payment_terms,
        'payment_methods': [
            m.get('label', '') if isinstance(m, dict) else str(m)
            for m in (settings_obj.payment_methods or [])
        ],
    }
    return render_to_string('marketing/quote_pdf.html', context)
