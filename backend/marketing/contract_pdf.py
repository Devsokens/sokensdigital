"""PDF du contrat de prestation de services (téléchargement admin et pièce
jointe du mail au client), généré par WeasyPrint comme les devis.

Le texte vient de marketing.contract_document (blocs) ; la mise en page
reproduit l'aperçu de l'admin (frontend/components/admin/contracts/) :
mêmes marges, mêmes tailles, même bandeau facultatif, même filigrane."""
import base64
import re
from pathlib import Path

from django.template.loader import render_to_string
from django.utils.html import escape
from django.utils.safestring import mark_safe

from marketing.contract_document import contract_blocks
from marketing.models import ContractSettings, QuoteSettings
from marketing.quote_pdf import LOGO_PATH

BALANCE_PATH = Path(__file__).resolve().parent / 'static' / 'marketing' / 'contract-balance.svg'


def _data_uri(path: Path, mime: str) -> str:
    if not path.exists():
        return ''
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode('ascii')


def rich(text: str) -> str:
    """**gras** → <strong>, retours à la ligne → <br>, le reste échappé."""
    parts = re.split(r'\*\*(.+?)\*\*', text or '')
    html = ''.join(
        f'<strong>{escape(part)}</strong>' if i % 2 else escape(part)
        for i, part in enumerate(parts)
    )
    return mark_safe(html.replace('\n', '<br>'))


def contract_settings_dict() -> dict:
    s = ContractSettings.load()
    q = QuoteSettings.load()
    return {
        'provider_identity': s.provider_identity,
        'provider_signatory': s.provider_signatory,
        'city': s.city,
        'watermark': s.watermark,
        'watermark_url': s.watermark_url,
        'watermark_opacity': s.watermark_opacity,
        'apply_stamp': s.apply_stamp,
        'company_address': q.company_address,
        'company_email': q.company_email,
        'company_stamp_url': q.company_stamp_url,
    }


def render_contract_html(contract) -> str:
    """HTML du contrat avant conversion — séparé pour être testé sans
    WeasyPrint (indisponible en dev Windows)."""
    from marketing.serializers import ServiceContractSerializer

    data = ServiceContractSerializer(contract).data
    settings_obj = contract_settings_dict()
    blocks = contract_blocks(data, settings_obj)
    for block in blocks:
        if 'text' in block:
            block['html'] = rich(block['text'])

    watermark_src, watermark_opacity = '', 1
    if settings_obj['watermark'] == ContractSettings.Watermark.BALANCE:
        watermark_src = _data_uri(BALANCE_PATH, 'image/svg+xml')
    elif settings_obj['watermark'] == ContractSettings.Watermark.IMAGE and settings_obj['watermark_url']:
        watermark_src = settings_obj['watermark_url']
        watermark_opacity = max(1, min(settings_obj['watermark_opacity'] or 15, 100)) / 100

    stamp = settings_obj['company_stamp_url'] if settings_obj['apply_stamp'] else ''
    return render_to_string('marketing/contract_pdf.html', {
        'contract': contract,
        'blocks': blocks,
        'accent': contract.document_color or '#1f3864',
        'show_header': contract.show_header,
        'logo_uri': _data_uri(LOGO_PATH, 'image/png'),
        'watermark_src': watermark_src,
        'watermark_opacity': watermark_opacity,
        'stamp_url': stamp,
    })


def build_contract_pdf(contract) -> bytes:
    """Lève ImportError si WeasyPrint (ou sa lib native) est indisponible."""
    from treasury.pdf import _require_weasyprint
    _require_weasyprint()
    from weasyprint import HTML

    return HTML(string=render_contract_html(contract)).write_pdf()
