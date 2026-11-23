from io import BytesIO
from django.template.loader import render_to_string
from django.utils import timezone
from decimal import Decimal

try:
    from weasyprint import HTML, CSS
    WEASYPRINT_AVAILABLE = True
except (ImportError, OSError):
    # OSError (pas seulement ImportError): weasyprint plante au chargement
    # si la lib native GTK/Pango (libgobject-2.0-0 etc) n'est pas présente
    # sur la machine — cas courant en dev Windows sans GTK installé. Un
    # module PDF optionnel ne doit pas empêcher tout Django de démarrer
    # (ni bloquer manage.py migrate) juste parce que cette lib système
    # manque localement.
    WEASYPRINT_AVAILABLE = False


def _require_weasyprint():
    if not WEASYPRINT_AVAILABLE:
        raise ImportError(
            'weasyprint indisponible (lib native GTK/Pango manquante). '
            'Sous Windows : installer GTK3 runtime, ou utiliser WSL/Docker pour la génération PDF.'
        )


def generate_cash_voucher_pdf(voucher):
    """Générer PDF pièce de caisse (entrée/sortie)."""
    _require_weasyprint()
    context = {
        'voucher': voucher,
        **_brand_and_qr('caisse', voucher),
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
    _require_weasyprint()

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
        'logo_uri': _logo(),
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
    _require_weasyprint()
    from core.models import User
    # Gérant actuel (désigné dans Administration > Utilisateurs) : toujours
    # nommé sur la fiche, même avant sa décision.
    current_gerant = disbursement.assigned_gerant or User.objects.filter(is_gerant=True, is_active=True).first()
    context = {
        'disbursement': disbursement,
        'current_gerant': current_gerant,
        'current_rcf': disbursement.assigned_rcf or User.objects.filter(is_rcf=True, is_active=True).first(),
        **_brand_and_qr('besoin', disbursement),
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



def _logo() -> str:
    from finance.fiscal import brand_logo_data_uri
    return brand_logo_data_uri()


def _brand_and_qr(kind: str, obj) -> dict:
    """Logo et QR code d'authentification (signé, vérifiable en ligne)."""
    from finance.fiscal import document_qr_data_uri, document_verification_url, sign_document
    try:
        qr = document_qr_data_uri(kind, obj)
    except ImportError:
        qr = ''
    return {
        'logo_uri': _logo(),
        'qr_uri': qr,
        'control_code': sign_document(kind, obj),
        'verification_url': document_verification_url(kind, obj),
    }
