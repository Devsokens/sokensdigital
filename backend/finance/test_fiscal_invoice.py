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


class TaxRatesTests(APITestCase):
    """Taux dynamiques : paramétrables, appliqués aux nouvelles factures, bornés."""

    def setUp(self):
        from core.constants import ROLE_COMPTABLE, ROLE_DIRECTEUR_FINANCIER
        from core.models import Role, User
        self.df = User.objects.create(email='df@x.dev')
        self.df.roles.add(Role.objects.get_or_create(name=ROLE_DIRECTEUR_FINANCIER)[0])
        self.compta = User.objects.create(email='compta@x.dev')
        self.compta.roles.add(Role.objects.get_or_create(name=ROLE_COMPTABLE)[0])
        self.df_client = APIClient()
        self.df_client.force_authenticate(user=self.df)
        self.compta_client = APIClient()
        self.compta_client.force_authenticate(user=self.compta)

    def test_rates_are_configurable_and_applied_to_new_invoices(self):
        url = '/api/v1/finance/settings/tax-rates/'
        from core.constants import ROLE_DEVELOPER
        from core.models import Role, User
        dev = User.objects.create(email='dev@x.dev')
        dev.roles.add(Role.objects.get_or_create(name=ROLE_DEVELOPER)[0])
        dev_client = APIClient()
        dev_client.force_authenticate(user=dev)
        self.assertEqual(dev_client.patch(url, {'css_rate': '0.02'}, format='json').status_code, 403)
        res = self.df_client.patch(url, {'vat_rate': '0.16', 'css_rate': '0.02'}, format='json')
        self.assertEqual(res.status_code, 200, res.content)
        res = self.compta_client.post('/api/v1/finance/invoices/', {
            'client_name': 'X', 'issue_date': '2026-11-01', 'amount_ht': '1000',
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(Decimal(res.json()['vat_rate']), Decimal('0.16'))
        self.assertEqual(Decimal(res.json()['css_rate']), Decimal('0.02'))
        self.assertEqual(Decimal(res.json()['amount_ttc']), Decimal('1180.00'))
        # Taux précisé sur la facture : prioritaire.
        res = self.compta_client.post('/api/v1/finance/invoices/', {
            'client_name': 'Y', 'issue_date': '2026-11-01', 'amount_ht': '1000', 'vat_rate': '0.18', 'css_rate': '0.01',
        }, format='json')
        self.assertEqual(Decimal(res.json()['amount_ttc']), Decimal('1190.00'))

    def test_rates_are_bounded(self):
        url = '/api/v1/finance/settings/tax-rates/'
        for bad in ({'css_rate': '-0.01'}, {'css_rate': '0.5'}, {'vat_rate': '1.5'}):
            self.assertEqual(self.df_client.patch(url, bad, format='json').status_code, 400)
        from finance.serializers import InvoiceSerializer
        base = {'client_name': 'X', 'issue_date': '2026-11-01', 'amount_ht': '1000', 'vat_rate': '0.18'}
        self.assertFalse(InvoiceSerializer(data={**base, 'css_rate': '0.5'}).is_valid())
        self.assertTrue(InvoiceSerializer(data={**base, 'css_rate': '0.015'}).is_valid())


class DashboardTaxTotalsTests(APITestCase):
    def test_tax_totals_from_issued_invoices(self):
        from finance.views import invoice_tax_totals
        Invoice.objects.create(client_name='A', amount_ht=Decimal('100000'), issue_date='2026-03-01', status=Invoice.Status.VALIDEE)
        Invoice.objects.create(client_name='B', amount_ht=Decimal('50000'), issue_date='2026-03-02')  # brouillon : exclu
        t = invoice_tax_totals(2026)['this_year']
        self.assertEqual(t['invoices'], 1)
        self.assertEqual(Decimal(t['vat']), Decimal('18000'))
        self.assertEqual(Decimal(t['css']), Decimal('1000'))
        self.assertEqual(Decimal(t['total_taxes']), Decimal('19000'))


class BesoinSheetGerantTests(APITestCase):
    def test_sheet_names_current_gerant(self):
        from django.template.loader import render_to_string
        from django.utils import timezone
        from core.models import User
        from finance.models import DisbursementRequest
        gerant = User.objects.create(email='g@x.dev', first_name='Jackie', last_name='Moubeyi', is_gerant=True)
        besoin = DisbursementRequest.objects.create(amount=5000, beneficiary='X', reason='Y')
        html = render_to_string('treasury/disbursement_request_pdf.html', {
            'disbursement': besoin, 'current_gerant': gerant, 'company_address': '', 'now': timezone.now(),
        })
        self.assertIn('Jackie Moubeyi', html)
        self.assertIn('Signature à la validation', html)


class TreasuryDocumentQrTests(APITestCase):
    def test_cash_voucher_qr_and_verification(self):
        from django.template.loader import render_to_string
        from django.utils import timezone
        from finance.fiscal import sign_document
        from treasury.models import CashEntry
        from treasury.pdf import _brand_and_qr
        entry = CashEntry.objects.create(type=CashEntry.Type.SORTIE, source=CashEntry.Source.choices[0][0], amount=Decimal('25000'))
        ctx = _brand_and_qr('caisse', entry)
        self.assertTrue(ctx['logo_uri'].startswith('data:image/png;base64,'))
        self.assertTrue(ctx['qr_uri'].startswith('data:image/svg+xml'))
        html = render_to_string('treasury/cash_voucher_pdf.html', {'voucher': entry, **ctx, 'now': timezone.now()})
        self.assertIn(ctx['control_code'], html)
        url = '/api/v1/public/documents/verify/'
        ok = APIClient().get(url, {'t': 'caisse', 'id': str(entry.pk), 's': sign_document('caisse', entry)}).json()
        self.assertTrue(ok['valid'])
        self.assertEqual(Decimal(ok['amount']), Decimal('25000.00'))
        self.assertEqual(APIClient().get(url, {'t': 'caisse', 'id': str(entry.pk), 's': 'FAUX'}).json(), {'valid': False})
        CashEntry.objects.filter(pk=entry.pk).update(amount=Decimal('1'))
        self.assertFalse(APIClient().get(url, {'t': 'caisse', 'id': str(entry.pk), 's': ctx['control_code']}).json()['valid'])
