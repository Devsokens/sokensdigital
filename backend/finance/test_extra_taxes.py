"""Autres taxes des factures, en plus de la TVA et de la CSS."""
from decimal import Decimal

from rest_framework.test import APIClient, APITestCase

from core.constants import ROLE_COMPTABLE, ROLE_DIRECTEUR_FINANCIER
from core.models import Role, User
from finance.models import AccountingPeriod, FinanceSettings, Invoice, JournalEntry
from finance.pdf import render_invoice_html


def _client(email, role):
    user = User.objects.create(email=email, first_name=email.split('@')[0])
    user.roles.add(Role.objects.get_or_create(name=role)[0])
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class ExtraTaxesTests(APITestCase):
    def setUp(self):
        self.df = _client('df@sokensdigital.com', ROLE_DIRECTEUR_FINANCIER)
        self.comptable = _client('compta@sokensdigital.com', ROLE_COMPTABLE)

    def test_settings_add_and_remove_taxes(self):
        response = self.df.patch('/api/v1/finance/settings/tax-rates/', {
            'extra_taxes': [{'name': 'Taxe communale', 'percent': '2.5', 'enabled': True}],
        }, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['extra_taxes'], [{'name': 'Taxe communale', 'percent': '2.5', 'enabled': True}])
        response = self.df.patch('/api/v1/finance/settings/tax-rates/', {'extra_taxes': []}, format='json')
        self.assertEqual(response.json()['extra_taxes'], [])

    def test_vat_and_css_cannot_be_duplicated(self):
        response = self.df.patch('/api/v1/finance/settings/tax-rates/', {
            'extra_taxes': [{'name': 'TVA', 'percent': '18'}],
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_new_invoice_takes_enabled_taxes_and_adds_them(self):
        settings_obj = FinanceSettings.load()
        settings_obj.extra_taxes = [
            {'name': 'Taxe A', 'percent': '2', 'enabled': True},
            {'name': 'Taxe B', 'percent': '5', 'enabled': False},
        ]
        settings_obj.save()
        response = self.comptable.post('/api/v1/finance/invoices/', {
            'client_name': 'Acme', 'issue_date': '2026-07-15',
            'lines': [{'description': 'Site', 'quantity': '1', 'unit_price': '100000'}],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual([t['name'] for t in body['extra_taxes']], ['Taxe A'])
        # HT 100 000 + TVA 18 000 + CSS 1 000 + Taxe A 2 000
        self.assertEqual(Decimal(body['amount_ttc']), Decimal('121000.00'))
        self.assertIn('Taxe A 2 %', render_invoice_html(Invoice.objects.get(pk=body['id'])))

    def test_journal_entry_stays_balanced(self):
        AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')
        invoice = Invoice.objects.create(
            client_name='Acme', issue_date='2026-07-15',
            lines=[{'description': 'Site', 'quantity': 1, 'unit_price': 100000}],
            extra_taxes=[{'name': 'Taxe A', 'percent': '2'}],
        )
        response = self.comptable.post(f'/api/v1/finance/invoices/{invoice.id}/validate/')
        self.assertEqual(response.status_code, 200, response.content)
        lines = list(JournalEntry.objects.get(source_invoice=invoice).lines.select_related('account'))
        self.assertEqual(sum(l.debit for l in lines), sum(l.credit for l in lines))
        self.assertIn('447', [l.account.code for l in lines])
