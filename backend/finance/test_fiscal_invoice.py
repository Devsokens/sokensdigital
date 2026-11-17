"""Mentions fiscales des factures : CSS, montants, QR code signé, vérification publique."""
from decimal import Decimal

from rest_framework.test import APIClient, APITestCase

from administration.models import Client
from finance.fiscal import canonical_payload, sign_invoice, verify_signature
from finance.models import Invoice
from finance.pdf import render_invoice_html


class FiscalInvoiceTests(APITestCase):
    def setUp(self):
        self.client_obj = Client.objects.create(company_name='ACME SA', address='BP 123\nLibreville', city='Libreville', country='Gabon', nif='123456A')
        self.invoice = Invoice.objects.create(
            client=self.client_obj, lines=[{'description': 'Site web', 'quantity': 2, 'unit_price': 50000}],
        )

    def test_amounts_include_vat_and_css(self):
        self.assertEqual(self.invoice.amount_ht, Decimal('100000'))
        self.assertEqual(self.invoice.vat_amount, Decimal('18000.00'))
        self.assertEqual(self.invoice.css_amount, Decimal('1000.00'))
        self.assertEqual(self.invoice.amount_ttc, Decimal('119000.00'))

    def test_number_is_sequential(self):
        second = Invoice.objects.create(client=self.client_obj, amount_ht=Decimal('1000'))
        first_seq = int(self.invoice.invoice_number.split('-')[2])
        self.assertEqual(int(second.invoice_number.split('-')[2]), first_seq + 1)

    def test_signature_detects_tampering(self):
        sig = sign_invoice(self.invoice)
        self.assertTrue(verify_signature(self.invoice, sig))
        self.assertFalse(verify_signature(self.invoice, 'A' * len(sig)))
        Invoice.objects.filter(pk=self.invoice.pk).update(amount_ttc=Decimal('1'))
        self.invoice.refresh_from_db()
        self.assertFalse(verify_signature(self.invoice, sig))
        self.assertIn('123456A', canonical_payload(self.invoice))

    def test_pdf_html_has_mandatory_mentions(self):
        html = render_invoice_html(self.invoice)
        for needle in ('NIF : 123456A', 'BP 123', 'CSS 1 %', 'TVA 18 %', 'QR code fiscal', self.invoice.invoice_number, 'XAF'):
            self.assertIn(needle, html)
        self.assertIn('data:image/svg+xml', html)

    def test_public_verification(self):
        url = '/api/v1/public/invoices/verify/'
        sig = sign_invoice(self.invoice)
        # Brouillon : jamais confirmé.
        self.assertFalse(APIClient().get(url, {'n': self.invoice.invoice_number, 's': sig}).json()['valid'])
        Invoice.objects.filter(pk=self.invoice.pk).update(status=Invoice.Status.VALIDEE)
        body = APIClient().get(url, {'n': self.invoice.invoice_number, 's': sig}).json()
        self.assertTrue(body['valid'])
        self.assertEqual(body['client_nif'], '123456A')
        self.assertEqual(Decimal(body['css_amount']), Decimal('1000.00'))
        bad = APIClient().get(url, {'n': self.invoice.invoice_number, 's': 'FAKE'}).json()
        self.assertEqual(bad, {'valid': False})
