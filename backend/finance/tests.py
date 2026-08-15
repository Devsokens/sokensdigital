import datetime
from decimal import Decimal

from rest_framework.test import APIClient, APITestCase

from core.constants import ROLE_COMPTABLE, ROLE_DEVELOPER, ROLE_DIRECTEUR_FINANCIER, ROLE_PROJECT_MANAGER
from core.models import Role, User
from finance.models import (
    Account,
    AccountingPeriod,
    BankStatementImport,
    BankTransaction,
    DisbursementRequest,
    Invoice,
    JournalEntry,
    TaxDeclaration,
    TransactionLine,
)
from projects.models import Project


def _give_role(user, name):
    role, _ = Role.objects.get_or_create(name=name)
    user.roles.add(role)
    return role


class DisbursementRequestViewSetTests(APITestCase):
    def setUp(self):
        self.chef_a = User.objects.create(email='chef-a@sokensdigital.com', first_name='ChefA')
        _give_role(self.chef_a, ROLE_PROJECT_MANAGER)

        self.chef_b = User.objects.create(email='chef-b@sokensdigital.com', first_name='ChefB')
        _give_role(self.chef_b, ROLE_PROJECT_MANAGER)

        self.cfo = User.objects.create(email='cfo@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.project_a = Project.objects.create(name='Projet A', lead_project_manager=self.chef_a)
        self.project_b = Project.objects.create(name='Projet B', lead_project_manager=self.chef_b)

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.chef_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.chef_b)

        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def payload(self, **overrides):
        data = {
            'project_id': str(self.project_a.id),
            'amount': '150000',
            'beneficiary': 'Fournisseur Cloud SA',
            'reason': "Renouvellement de l'hébergement.",
        }
        data.update(overrides)
        return data

    def test_chef_can_initiate_for_own_project(self):
        response = self.client_a.post('/api/v1/finance/disbursement-requests/', self.payload(), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['status'], 'EN_ATTENTE_N1')

    def test_chef_cannot_initiate_for_other_chefs_project(self):
        response = self.client_a.post(
            '/api/v1/finance/disbursement-requests/',
            self.payload(project_id=str(self.project_b.id)),
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_outsider_forbidden(self):
        response = self.client_outsider.post('/api/v1/finance/disbursement-requests/', self.payload(), format='json')
        self.assertEqual(response.status_code, 403)

    def test_negative_amount_rejected(self):
        response = self.client_a.post(
            '/api/v1/finance/disbursement-requests/', self.payload(amount='-100'), format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_chef_sees_only_own_project_requests(self):
        DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000,
            beneficiary='X', reason='Y',
        )
        DisbursementRequest.objects.create(
            project=self.project_b, requested_by=self.chef_b, amount=2000,
            beneficiary='X', reason='Y',
        )
        response = self.client_a.get('/api/v1/finance/disbursement-requests/')
        self.assertEqual(response.json()['count'], 1)

    def test_cfo_sees_all_requests(self):
        DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000,
            beneficiary='X', reason='Y',
        )
        DisbursementRequest.objects.create(
            project=self.project_b, requested_by=self.chef_b, amount=2000,
            beneficiary='X', reason='Y',
        )
        response = self.client_cfo.get('/api/v1/finance/disbursement-requests/')
        self.assertEqual(response.json()['count'], 2)

    def test_cfo_cannot_create_request(self):
        response = self.client_cfo.post('/api/v1/finance/disbursement-requests/', self.payload(), format='json')
        self.assertEqual(response.status_code, 403)

    def test_cfo_can_approve_then_comptable_can_execute(self):
        self.comptable = User.objects.create(email='comptable@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        client_comptable = APIClient()
        client_comptable.force_authenticate(user=self.comptable)

        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000, beneficiary='X', reason='Y',
        )

        response = self.client_cfo.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'APPROUVE')

        response = client_comptable.post(f'/api/v1/finance/disbursement-requests/{disbursement.id}/execute/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'EXECUTE')

    def test_chef_cannot_approve(self):
        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000, beneficiary='X', reason='Y',
        )
        response = self.client_a.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE'}, format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_cannot_execute_before_approval(self):
        self.comptable = User.objects.create(email='comptable2@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        client_comptable = APIClient()
        client_comptable.force_authenticate(user=self.comptable)

        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000, beneficiary='X', reason='Y',
        )
        response = client_comptable.post(f'/api/v1/finance/disbursement-requests/{disbursement.id}/execute/')
        self.assertEqual(response.status_code, 400)


class AccountingPeriodViewSetTests(APITestCase):
    def setUp(self):
        self.cfo = User.objects.create(email='cfo2@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)
        self.comptable = User.objects.create(email='comptable3@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)

        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)
        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)

    def test_cfo_can_create_and_close_period(self):
        response = self.client_cfo.post('/api/v1/finance/accounting-periods/', {
            'label': '2026-07', 'start_date': '2026-07-01', 'end_date': '2026-07-31',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        period_id = response.json()['id']

        response = self.client_cfo.post(f'/api/v1/finance/accounting-periods/{period_id}/close/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'CLOTUREE')

    def test_comptable_cannot_create_period(self):
        response = self.client_comptable.post('/api/v1/finance/accounting-periods/', {
            'label': '2026-08', 'start_date': '2026-08-01', 'end_date': '2026-08-31',
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_comptable_can_read_periods(self):
        AccountingPeriod.objects.create(label='2026-06', start_date='2026-06-01', end_date='2026-06-30')
        response = self.client_comptable.get('/api/v1/finance/accounting-periods/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)


class JournalEntryViewSetTests(APITestCase):
    def setUp(self):
        self.comptable = User.objects.create(email='comptable4@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        self.outsider = User.objects.create(email='dev2@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)
        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

        self.period = AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')
        self.closed_period = AccountingPeriod.objects.create(
            label='2026-06', start_date='2026-06-01', end_date='2026-06-30',
            status=AccountingPeriod.Status.CLOTUREE,
        )
        self.bank = Account.objects.create(code='512', name='Banque', account_class=Account.AccountClass.ACTIF)
        self.sales = Account.objects.create(code='706', name='Prestations', account_class=Account.AccountClass.PRODUIT)

    def payload(self, period_id):
        return {
            'period': str(period_id), 'journal_code': 'VE', 'date': '2026-07-10', 'label': 'Vente',
            'lines': [
                {'account': str(self.bank.id), 'debit': '1000', 'credit': '0'},
                {'account': str(self.sales.id), 'debit': '0', 'credit': '1000'},
            ],
        }

    def test_comptable_can_post_balanced_entry(self):
        response = self.client_comptable.post('/api/v1/finance/journal-entries/', self.payload(self.period.id), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()['lines']), 2)

    def test_unbalanced_entry_rejected(self):
        data = self.payload(self.period.id)
        data['lines'][1]['credit'] = '900'
        response = self.client_comptable.post('/api/v1/finance/journal-entries/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_closed_period_rejects_new_entry(self):
        response = self.client_comptable.post(
            '/api/v1/finance/journal-entries/', self.payload(self.closed_period.id), format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_outsider_forbidden(self):
        response = self.client_outsider.post('/api/v1/finance/journal-entries/', self.payload(self.period.id), format='json')
        self.assertEqual(response.status_code, 403)


class InvoiceViewSetTests(APITestCase):
    def setUp(self):
        self.comptable = User.objects.create(email='comptable5@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)

        self.period = AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')

    def test_create_invoice_computes_ttc(self):
        response = self.client_comptable.post('/api/v1/finance/invoices/', {
            'client_name': 'Acme SARL', 'issue_date': '2026-07-15', 'amount_ht': '1000', 'vat_rate': '0.18',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.json()['amount_ttc']), Decimal('1180.00'))
        self.assertEqual(response.json()['status'], 'BROUILLON')

    def test_validate_posts_balanced_journal_entry(self):
        invoice = Invoice.objects.create(client_name='Acme SARL', issue_date=datetime.date(2026, 7, 15), amount_ht=Decimal('1000'))
        response = self.client_comptable.post(f'/api/v1/finance/invoices/{invoice.id}/validate/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'VALIDEE')

        entry = JournalEntry.objects.get(source_invoice=invoice)
        lines = list(entry.lines.all())
        total_debit = sum((line.debit for line in lines), Decimal('0'))
        total_credit = sum((line.credit for line in lines), Decimal('0'))
        self.assertEqual(total_debit, total_credit)

    def test_validate_without_open_period_rejected(self):
        self.period.status = AccountingPeriod.Status.CLOTUREE
        self.period.save(update_fields=['status'])
        invoice = Invoice.objects.create(client_name='Acme SARL', issue_date=datetime.date(2026, 7, 15), amount_ht=Decimal('1000'))
        response = self.client_comptable.post(f'/api/v1/finance/invoices/{invoice.id}/validate/')
        self.assertEqual(response.status_code, 400)


class BankReconciliationTests(APITestCase):
    def setUp(self):
        self.comptable = User.objects.create(email='comptable6@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)

        self.period = AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')
        self.bank_account = Account.objects.create(code='512', name='Banque', account_class=Account.AccountClass.ACTIF)
        self.sales_account = Account.objects.create(code='706', name='Prestations', account_class=Account.AccountClass.PRODUIT)
        entry = JournalEntry.objects.create(period=self.period, journal_code='VE', date='2026-07-10', label='Vente', created_by=self.comptable)
        self.line = TransactionLine.objects.create(entry=entry, account=self.bank_account, debit=Decimal('500'), credit=Decimal('0'))
        TransactionLine.objects.create(entry=entry, account=self.sales_account, debit=Decimal('0'), credit=Decimal('500'))

    def test_import_creates_transactions(self):
        response = self.client_comptable.post('/api/v1/finance/bank-imports/', {
            'filename': 'releve-juillet.csv',
            'rows': [{'date': '2026-07-11', 'label': 'Virement client', 'amount': '500'}],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()['transactions']), 1)

    def test_suggestions_finds_matching_amount_line(self):
        statement = BankStatementImport.objects.create(filename='r.csv', imported_by=self.comptable)
        transaction_row = BankTransaction.objects.create(statement_import=statement, date='2026-07-11', label='Virement', amount=Decimal('500'))
        response = self.client_comptable.get(f'/api/v1/finance/bank-imports/{statement.id}/transactions/{transaction_row.id}/suggestions/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]['id'], str(self.line.id))

    def test_match_marks_transaction_lettre(self):
        statement = BankStatementImport.objects.create(filename='r.csv', imported_by=self.comptable)
        transaction_row = BankTransaction.objects.create(statement_import=statement, date='2026-07-11', label='Virement', amount=Decimal('500'))
        response = self.client_comptable.post(
            f'/api/v1/finance/bank-imports/{statement.id}/transactions/{transaction_row.id}/match/',
            {'line_id': str(self.line.id)}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'LETTRE')
        self.line.refresh_from_db()
        self.assertTrue(self.line.lettrage_code)


class TaxDeclarationViewSetTests(APITestCase):
    def setUp(self):
        self.cfo = User.objects.create(email='cfo3@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)
        self.comptable = User.objects.create(email='comptable7@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)

        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)
        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)

        self.period = AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')
        vat_collected_account = Account.objects.create(code='4457', name='TVA collectée', account_class=Account.AccountClass.TVA)
        vat_deductible_account = Account.objects.create(code='4456', name='TVA déductible', account_class=Account.AccountClass.TVA)
        entry = JournalEntry.objects.create(period=self.period, journal_code='OD', date='2026-07-10', label='TVA', created_by=self.comptable)
        TransactionLine.objects.create(entry=entry, account=vat_collected_account, debit=Decimal('0'), credit=Decimal('180'))
        TransactionLine.objects.create(entry=entry, account=vat_deductible_account, debit=Decimal('50'), credit=Decimal('0'))

    def test_comptable_can_generate_declaration(self):
        response = self.client_comptable.post('/api/v1/finance/tax-declarations/generate/', {'period_id': str(self.period.id)}, format='json')
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(Decimal(body['collected_vat']), Decimal('180'))
        self.assertEqual(Decimal(body['deductible_vat']), Decimal('50'))
        self.assertEqual(Decimal(body['net_vat']), Decimal('130'))
        self.assertEqual(body['status'], 'BROUILLON')

    def test_only_cfo_can_validate_declaration(self):
        declaration = TaxDeclaration.objects.create(period=self.period, collected_vat=180, deductible_vat=50, net_vat=130)

        response = self.client_comptable.post(f'/api/v1/finance/tax-declarations/{declaration.id}/validate/')
        self.assertEqual(response.status_code, 403)

        response = self.client_cfo.post(f'/api/v1/finance/tax-declarations/{declaration.id}/validate/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'VALIDEE')


class FecExportAndDashboardTests(APITestCase):
    def setUp(self):
        self.cfo = User.objects.create(email='cfo4@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)
        self.comptable = User.objects.create(email='comptable8@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        self.outsider = User.objects.create(email='dev3@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)
        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)
        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

        self.period = AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')
        bank_account = Account.objects.create(code='512', name='Banque', account_class=Account.AccountClass.ACTIF)
        sales_account = Account.objects.create(code='706', name='Prestations', account_class=Account.AccountClass.PRODUIT)
        entry = JournalEntry.objects.create(period=self.period, journal_code='VE', date='2026-07-10', label='Vente', created_by=self.comptable)
        TransactionLine.objects.create(entry=entry, account=bank_account, debit=Decimal('1000'), credit=Decimal('0'))
        TransactionLine.objects.create(entry=entry, account=sales_account, debit=Decimal('0'), credit=Decimal('1000'))

    def test_fec_export_returns_text(self):
        response = self.client_comptable.get(f'/api/v1/finance/accounting-periods/{self.period.id}/fec-export/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('JournalCode', response.content.decode())
        self.assertIn('706', response.content.decode())

    def test_dashboard_computes_cash_balance(self):
        response = self.client_cfo.get('/api/v1/finance/dashboard/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.json()['cash_balance']), Decimal('1000'))

    def test_dashboard_forbidden_for_comptable(self):
        response = self.client_comptable.get('/api/v1/finance/dashboard/')
        self.assertEqual(response.status_code, 403)

    def test_dashboard_forbidden_for_outsider(self):
        response = self.client_outsider.get('/api/v1/finance/dashboard/')
        self.assertEqual(response.status_code, 403)
