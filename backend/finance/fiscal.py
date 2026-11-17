"""QR code fiscal des factures.

Chaque facture validée porte un QR code qui ouvre la page publique de
vérification. Le lien contient le numéro de facture et une signature HMAC
calculée sur les données fiscales (émetteur, client, date, montants HT, TVA,
CSS, TTC) avec une clé connue du seul serveur :

- non falsifiable : sans la clé, impossible de produire une signature
  valide pour une facture inventée ou modifiée ;
- intègre : la page de vérification recalcule la signature à partir de la
  facture en base ; si un montant a changé depuis l'émission, la signature
  ne correspond plus et la facture est signalée comme non conforme ;
- rapide : un scan suffit, sans compte ni application.
"""
import base64
import hashlib
import hmac
from decimal import Decimal

from django.conf import settings

SIGNATURE_LENGTH = 20  # caractères base32 (100 bits)


def _signing_key() -> bytes:
    key = getattr(settings, 'INVOICE_SIGNING_KEY', '') or settings.SECRET_KEY
    return hashlib.sha256(f'invoice-fiscal-qr:{key}'.encode()).digest()


def _money(value) -> str:
    return f'{Decimal(value or 0):.2f}'


def _iso_date(value) -> str:
    # issue_date vaut un datetime tant que l'objet n'a pas été relu en base
    # (default=timezone.now) : on ne signe que la date.
    if not value:
        return ''
    if hasattr(value, 'date') and callable(value.date):
        value = value.date()
    return value.isoformat()


def canonical_payload(invoice) -> str:
    """Données fiscales signées, dans un ordre fixe."""
    from marketing.models import QuoteSettings
    supplier_nif = QuoteSettings.load().company_nif or ''
    client_nif = (invoice.client.nif if invoice.client_id else '') or ''
    return '|'.join([
        'v1',
        invoice.invoice_number,
        _iso_date(invoice.issue_date),
        supplier_nif.replace(' ', ''),
        client_nif.replace(' ', ''),
        _money(invoice.amount_ht),
        _money(invoice.vat_amount),
        _money(invoice.css_amount),
        _money(invoice.amount_ttc),
    ])


def sign_invoice(invoice) -> str:
    digest = hmac.new(_signing_key(), canonical_payload(invoice).encode(), hashlib.sha256).digest()
    return base64.b32encode(digest).decode().rstrip('=')[:SIGNATURE_LENGTH]


def verify_signature(invoice, signature: str) -> bool:
    return hmac.compare_digest(sign_invoice(invoice), (signature or '').strip().upper())


def verification_url(invoice) -> str:
    base = getattr(settings, 'PUBLIC_SITE_URL', '').rstrip('/')
    return f'{base}/verification-facture?n={invoice.invoice_number}&s={sign_invoice(invoice)}'


def qr_code_svg_data_uri(invoice) -> str:
    """QR code (SVG en data URI) à intégrer au PDF."""
    import segno
    qr = segno.make(verification_url(invoice), error='m')
    return qr.svg_data_uri(scale=4, border=1)
