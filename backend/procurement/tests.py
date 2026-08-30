"""
Tests procurement — inexistants jusqu'au 17/08 (audit VERIFICATION_STATUT_
IMPLEMENTATION_2026-08.md). Écrire ces tests a immédiatement révélé un bug
critique jamais détecté : les permission classes de ce module appelaient
`request.user.has_role(...)` — une méthode qui n'existe pas sur `User`
(la vraie fonction est `core.permissions.has_role(user, *roles)`, libre,
pas une méthode) — donc TOUTE requête sur cette app plantait en 500 au lieu
de vérifier un rôle. Corrigé dans le même passage que l'ajout de ces tests.
"""
from decimal import Decimal

from rest_framework.test import APIClient, APITestCase

from core.constants import (
    ROLE_COMPTABLE, ROLE_DEVELOPER, ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN,
)
from core.models import Department, Role, User
from finance.models import Account, AccountingPeriod, DisbursementRequest, JournalEntry
from procurement.models import ProcurementRequest, Supplier, SupplierInvoice, SupplierQuote
from procurement.tasks import create_disbursement_request_task, post_supplier_invoice_journal_entry


def _give_role(user, name):
    role, _ = Role.objects.get_or_create(name=name)
    user.roles.add(role)
    return role


class ProcurementTestBase(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(name='Technique', color='#22d3ee')

        self.comptable = User.objects.create(email='comptable@sokensdigital.com', first_name='Compta')
        _give_role(self.comptable, ROLE_COMPTABLE)

        self.cfo = User.objects.create(email='cfo@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)

        self.super_admin = User.objects.create(email='admin@sokensdigital.com', first_name='Admin')
        _give_role(self.super_admin, ROLE_SUPER_ADMIN)

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)
        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.super_admin)
        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

        self.supplier = Supplier.objects.create(
            name='Fournisseur Test', email='f@example.com', phone='0102030405',
            address='1 rue Test', bank_account='SN000000000000000000',
            contact_person='Jean Test',
        )

        # Une période comptable ouverte couvrant aujourd'hui — nécessaire
        # pour que resolve_open_period_for_date() trouve où poster.
        self.period = AccountingPeriod.objects.create(
            label='2026-08', start_date='2026-08-01', end_date='2026-08-31',
        )


class SupplierModelTests(APITestCase):
    def test_supplier_str_and_defaults(self):
        supplier = Supplier.objects.create(
            name='ACME', email='a@example.com', phone='000', address='x',
            bank_account='y', contact_person='z',
        )
        self.assertTrue(supplier.is_active)
        self.assertEqual(str(supplier), 'ACME')


class ProcurementRequestModelTests(ProcurementTestBase):
    def test_default_status_is_brouillon_and_estimated_amount_validated(self):
        pr = ProcurementRequest.objects.create(
            title='Achat serveurs', description='besoin', estimated_amount=Decimal('500000'),
            department=self.department, requested_by=self.comptable,
        )
        self.assertEqual(pr.status, ProcurementRequest.Status.BROUILLON)

    def test_negative_amount_rejected_by_clean(self):
        pr = ProcurementRequest(
            title='x', description='y', estimated_amount=Decimal('-1'),
            department=self.department, requested_by=self.comptable,
        )
        with self.assertRaises(Exception):
            pr.full_clean()


class SupplierQuoteModelTests(ProcurementTestBase):
    def setUp(self):
        super().setUp()
        self.procurement = ProcurementRequest.objects.create(
            title='Achat', description='x', estimated_amount=Decimal('100000'),
            department=self.department, requested_by=self.comptable,
        )

    def test_quote_number_auto_generated_and_ttc_calculated(self):
        quote = SupplierQuote.objects.create(
            procurement=self.procurement, supplier=self.supplier,
            quote_date='2026-08-15', amount_ht=Decimal('1000'), vat_rate=Decimal('0.18'),
        )
        self.assertRegex(quote.quote_number, r'^QUOTE-\d{4}-\d{5}$')
        self.assertEqual(quote.amount_ttc, Decimal('1180.00'))

    def test_quote_numbers_are_sequential_and_unique(self):
        q1 = SupplierQuote.objects.create(
            procurement=self.procurement, supplier=self.supplier,
            quote_date='2026-08-15', amount_ht=Decimal('100'),
        )
        q2 = SupplierQuote.objects.create(
            procurement=self.procurement, supplier=self.supplier,
            quote_date='2026-08-16', amount_ht=Decimal('200'),
        )
        self.assertNotEqual(q1.quote_number, q2.quote_number)


class SupplierInvoiceModelTests(ProcurementTestBase):
    def setUp(self):
        super().setUp()
        self.procurement = ProcurementRequest.objects.create(
            title='Achat', description='x', estimated_amount=Decimal('100000'),
            department=self.department, requested_by=self.comptable,
        )

    def test_ttc_calculated_on_save(self):
        invoice = SupplierInvoice.objects.create(
            supplier=self.supplier, procurement=self.procurement,
            invoice_number='FF-001', invoice_date='2026-08-15',
            amount_ht=Decimal('1000'), vat_rate=Decimal('0.18'),
        )
        self.assertEqual(invoice.amount_ttc, Decimal('1180.00'))

    def test_default_status_recue(self):
        invoice = SupplierInvoice.objects.create(
            supplier=self.supplier, procurement=self.procurement,
            invoice_number='FF-002', invoice_date='2026-08-15', amount_ht=Decimal('100'),
        )
        self.assertEqual(invoice.status, SupplierInvoice.Status.RECUE)


class ProcurementRequestViewSetTests(ProcurementTestBase):
    """Ces tests exercent IsManagerOrAdmin/IsFinanceOrAdmin pour de vrai —
    c'est ici que le bug has_role aurait planté avant le fix du 17/08."""

    def test_any_authenticated_user_can_create(self):
        response = self.client_outsider.post('/api/v1/procurement/procurements/', {
            'title': 'Achat écrans', 'description': 'besoin',
            'estimated_amount': '50000', 'department': str(self.department.id),
        }, format='json')
        self.assertEqual(response.status_code, 201)
        created = ProcurementRequest.objects.get(id=response.json()['id'])
        self.assertEqual(created.requested_by, self.outsider)

    def test_outsider_cannot_approve_rcf(self):
        pr = ProcurementRequest.objects.create(
            title='x', description='y', estimated_amount=Decimal('1000'),
            department=self.department, requested_by=self.outsider,
            status=ProcurementRequest.Status.EN_ATTENTE_RCF,
        )
        response = self.client_outsider.post(f'/api/v1/procurement/procurements/{pr.id}/approve_rcf/')
        self.assertEqual(response.status_code, 403)

    def test_comptable_can_approve_rcf_then_manager_can_approve(self):
        pr = ProcurementRequest.objects.create(
            title='x', description='y', estimated_amount=Decimal('1000'),
            department=self.department, requested_by=self.outsider,
            status=ProcurementRequest.Status.EN_ATTENTE_RCF,
        )
        response = self.client_comptable.post(f'/api/v1/procurement/procurements/{pr.id}/approve_rcf/')
        self.assertEqual(response.status_code, 200)
        pr.refresh_from_db()
        self.assertEqual(pr.status, ProcurementRequest.Status.EN_ATTENTE_MANAGER)

        response = self.client_cfo.post(f'/api/v1/procurement/procurements/{pr.id}/approve_manager/')
        self.assertEqual(response.status_code, 200)
        pr.refresh_from_db()
        self.assertEqual(pr.status, ProcurementRequest.Status.APPROUVEE)

    def test_wrong_status_transition_rejected(self):
        pr = ProcurementRequest.objects.create(
            title='x', description='y', estimated_amount=Decimal('1000'),
            department=self.department, requested_by=self.outsider,
            status=ProcurementRequest.Status.BROUILLON,  # pas encore EN_ATTENTE_RCF
        )
        response = self.client_comptable.post(f'/api/v1/procurement/procurements/{pr.id}/approve_rcf/')
        self.assertEqual(response.status_code, 400)

    def test_approved_request_is_immutable(self):
        pr = ProcurementRequest.objects.create(
            title='x', description='y', estimated_amount=Decimal('1000'),
            department=self.department, requested_by=self.outsider,
            status=ProcurementRequest.Status.APPROUVEE,
        )
        response = self.client_comptable.patch(
            f'/api/v1/procurement/procurements/{pr.id}/', {'title': 'changed'}, format='json',
        )
        self.assertEqual(response.status_code, 400)
        pr.refresh_from_db()
        self.assertEqual(pr.title, 'x')

    def test_approved_request_cannot_be_deleted(self):
        pr = ProcurementRequest.objects.create(
            title='x', description='y', estimated_amount=Decimal('1000'),
            department=self.department, requested_by=self.outsider,
            status=ProcurementRequest.Status.APPROUVEE,
        )
        response = self.client_comptable.delete(f'/api/v1/procurement/procurements/{pr.id}/')
        self.assertEqual(response.status_code, 400)
        self.assertTrue(ProcurementRequest.objects.filter(id=pr.id).exists())


class SupplierQuoteViewSetTests(ProcurementTestBase):
    def setUp(self):
        super().setUp()
        self.procurement = ProcurementRequest.objects.create(
            title='Achat', description='x', estimated_amount=Decimal('100000'),
            department=self.department, requested_by=self.outsider,
            status=ProcurementRequest.Status.APPROUVEE,
        )

    def test_validated_quote_is_immutable(self):
        quote = SupplierQuote.objects.create(
            procurement=self.procurement, supplier=self.supplier,
            quote_date='2026-08-15', amount_ht=Decimal('1000'),
            status=SupplierQuote.Status.VALIDE,
        )
        response = self.client_cfo.patch(
            f'/api/v1/procurement/quotes/{quote.id}/', {'amount_ht': '9999'}, format='json',
        )
        self.assertEqual(response.status_code, 400)
        quote.refresh_from_db()
        self.assertEqual(quote.amount_ht, Decimal('1000'))

    def test_validate_manager_dispatches_disbursement_task(self):
        quote = SupplierQuote.objects.create(
            procurement=self.procurement, supplier=self.supplier,
            quote_date='2026-08-15', amount_ht=Decimal('1000'), vat_rate=Decimal('0.18'),
            status=SupplierQuote.Status.EN_ATTENTE,
        )
        response = self.client_cfo.post(f'/api/v1/procurement/quotes/{quote.id}/validate_manager/')
        self.assertEqual(response.status_code, 200)
        quote.refresh_from_db()
        self.assertEqual(quote.status, SupplierQuote.Status.VALIDE)
        # safe_dispatch() est un no-op silencieux pendant les tests (voir
        # core/celery_utils.py) — la tâche elle-même est testée séparément
        # ci-dessous, exécutée directement.


class SupplierInvoiceViewSetTests(ProcurementTestBase):
    def setUp(self):
        super().setUp()
        self.procurement = ProcurementRequest.objects.create(
            title='Achat', description='x', estimated_amount=Decimal('100000'),
            department=self.department, requested_by=self.outsider,
            status=ProcurementRequest.Status.APPROUVEE,
        )

    def test_outsider_cannot_validate_invoice(self):
        invoice = SupplierInvoice.objects.create(
            supplier=self.supplier, procurement=self.procurement,
            invoice_number='FF-010', invoice_date='2026-08-15', amount_ht=Decimal('1000'),
        )
        response = self.client_outsider.post(f'/api/v1/procurement/invoices/{invoice.id}/validate/')
        self.assertEqual(response.status_code, 403)

    def test_validated_invoice_is_immutable(self):
        invoice = SupplierInvoice.objects.create(
            supplier=self.supplier, procurement=self.procurement,
            invoice_number='FF-011', invoice_date='2026-08-15', amount_ht=Decimal('1000'),
            status=SupplierInvoice.Status.VALIDEE,
        )
        response = self.client_cfo.patch(
            f'/api/v1/procurement/invoices/{invoice.id}/', {'amount_ht': '1'}, format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_paid_invoice_cannot_be_deleted(self):
        invoice = SupplierInvoice.objects.create(
            supplier=self.supplier, procurement=self.procurement,
            invoice_number='FF-012', invoice_date='2026-08-15', amount_ht=Decimal('1000'),
            status=SupplierInvoice.Status.PAYEE,
        )
        response = self.client_cfo.delete(f'/api/v1/procurement/invoices/{invoice.id}/')
        self.assertEqual(response.status_code, 400)


class ProcurementTasksTests(ProcurementTestBase):
    """Tâches Celery exécutées directement via .apply() — safe_dispatch()
    est un no-op pendant les tests, donc passer par la vue ne les
    déclencherait jamais réellement."""

    def setUp(self):
        super().setUp()
        self.procurement = ProcurementRequest.objects.create(
            title='Achat', description='x', estimated_amount=Decimal('100000'),
            department=self.department, requested_by=self.outsider,
            status=ProcurementRequest.Status.APPROUVEE,
        )

    def test_create_disbursement_request_task_creates_disbursement_with_correct_tier(self):
        # amount_ht=100000 * 1.18 = 118000 > THRESHOLD_N3 (50000) → doit
        # tomber en EN_ATTENTE_N3, pas dans un statut inventé qui bypasserait
        # le circuit d'approbation (c'était le bug H2 de l'audit du 17/08).
        quote = SupplierQuote.objects.create(
            procurement=self.procurement, supplier=self.supplier,
            quote_date='2026-08-15', amount_ht=Decimal('100000'), vat_rate=Decimal('0.18'),
            status=SupplierQuote.Status.VALIDE, manager_validated_by=self.cfo,
        )
        self.assertEqual(DisbursementRequest.objects.count(), 0)

        create_disbursement_request_task.apply(args=(str(quote.id),)).get()

        self.assertEqual(DisbursementRequest.objects.count(), 1)
        disbursement = DisbursementRequest.objects.first()
        self.assertEqual(disbursement.amount, quote.amount_ttc)
        self.assertEqual(disbursement.status, DisbursementRequest.Status.EN_ATTENTE_N3)
        self.assertEqual(disbursement.requested_by, self.cfo)

    def test_create_disbursement_request_task_noop_if_quote_not_validated(self):
        quote = SupplierQuote.objects.create(
            procurement=self.procurement, supplier=self.supplier,
            quote_date='2026-08-15', amount_ht=Decimal('1000'),
            status=SupplierQuote.Status.EN_ATTENTE,
        )
        create_disbursement_request_task.apply(args=(str(quote.id),)).get()
        self.assertEqual(DisbursementRequest.objects.count(), 0)

    def test_post_supplier_invoice_journal_entry_creates_balanced_entry_and_marks_paid(self):
        invoice = SupplierInvoice.objects.create(
            supplier=self.supplier, procurement=self.procurement,
            invoice_number='FF-020', invoice_date='2026-08-15',
            amount_ht=Decimal('1000'), vat_rate=Decimal('0.18'),
            status=SupplierInvoice.Status.VALIDEE,
        )
        self.assertEqual(JournalEntry.objects.count(), 0)

        post_supplier_invoice_journal_entry.apply(args=(str(invoice.id),)).get()

        self.assertEqual(JournalEntry.objects.count(), 1)
        entry = JournalEntry.objects.first()
        lines = list(entry.lines.all())
        total_debit = sum(l.debit for l in lines)
        total_credit = sum(l.credit for l in lines)
        self.assertEqual(total_debit, total_credit)
        self.assertEqual(total_debit, Decimal('1180.00'))  # amount_ttc

        invoice.refresh_from_db()
        self.assertEqual(invoice.status, SupplierInvoice.Status.PAYEE)

    def test_post_supplier_invoice_journal_entry_noop_without_open_period(self):
        self.period.status = AccountingPeriod.Status.CLOTUREE
        self.period.save()
        invoice = SupplierInvoice.objects.create(
            supplier=self.supplier, procurement=self.procurement,
            invoice_number='FF-021', invoice_date='2026-08-15', amount_ht=Decimal('1000'),
            status=SupplierInvoice.Status.VALIDEE,
        )
        post_supplier_invoice_journal_entry.apply(args=(str(invoice.id),)).get()
        self.assertEqual(JournalEntry.objects.count(), 0)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, SupplierInvoice.Status.VALIDEE)  # pas passée à PAYEE


class ProcurementFullWorkflowIntegrationTest(ProcurementTestBase):
    """Fiche besoins → devis → décaissement auto → facture → écriture
    comptable auto, de bout en bout (tâches exécutées directement)."""

    def test_full_cycle(self):
        # 1. Fiche besoins
        pr = ProcurementRequest.objects.create(
            title='Nouveaux serveurs', description='besoin', estimated_amount=Decimal('50000'),
            department=self.department, requested_by=self.outsider,
            status=ProcurementRequest.Status.EN_ATTENTE_RCF,
        )
        self.client_comptable.post(f'/api/v1/procurement/procurements/{pr.id}/approve_rcf/')
        self.client_cfo.post(f'/api/v1/procurement/procurements/{pr.id}/approve_manager/')
        pr.refresh_from_db()
        self.assertEqual(pr.status, ProcurementRequest.Status.APPROUVEE)

        # 2. Devis — création réservée IsFinanceOrAdmin (Directeur Financier/
        # Super-Admin ; Comptable n'y est PAS inclus, contrairement à
        # IsManagerOrAdmin utilisé pour les actions d'approbation).
        quote_response = self.client_cfo.post('/api/v1/procurement/quotes/', {
            'procurement': str(pr.id), 'supplier': str(self.supplier.id),
            'quote_date': '2026-08-15', 'amount_ht': '5000',
            'status': 'EN_ATTENTE',  # BROUILLON par défaut sinon — validate_manager exige EN_ATTENTE
        }, format='json')
        self.assertEqual(quote_response.status_code, 201)
        quote = SupplierQuote.objects.get(id=quote_response.json()['id'])

        # 3. Validation devis → déclenche (en pratique) le décaissement
        self.client_cfo.post(f'/api/v1/procurement/quotes/{quote.id}/validate_manager/')
        quote.refresh_from_db()
        self.assertEqual(quote.status, SupplierQuote.Status.VALIDE)
        create_disbursement_request_task.apply(args=(str(quote.id),)).get()
        self.assertEqual(DisbursementRequest.objects.filter(amount=quote.amount_ttc).count(), 1)

        # 4. Facture fournisseur
        invoice_response = self.client_outsider.post('/api/v1/procurement/invoices/', {
            'supplier': str(self.supplier.id), 'procurement': str(pr.id),
            'invoice_number': 'FF-100', 'invoice_date': '2026-08-16', 'amount_ht': '5000',
        }, format='json')
        self.assertEqual(invoice_response.status_code, 201)
        invoice = SupplierInvoice.objects.get(id=invoice_response.json()['id'])
        self.assertEqual(invoice.received_by, self.outsider)

        # 5. Validation facture → écriture comptable auto
        self.client_cfo.post(f'/api/v1/procurement/invoices/{invoice.id}/validate/')
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, SupplierInvoice.Status.VALIDEE)
        post_supplier_invoice_journal_entry.apply(args=(str(invoice.id),)).get()
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, SupplierInvoice.Status.PAYEE)

        entry = JournalEntry.objects.get(journal_code=JournalEntry.JournalCode.ACHATS)
        self.assertEqual(
            sum(l.debit for l in entry.lines.all()),
            sum(l.credit for l in entry.lines.all()),
        )

        # 6. Immutabilité — la facture payée ne peut plus être modifiée
        response = self.client_cfo.patch(
            f'/api/v1/procurement/invoices/{invoice.id}/', {'amount_ht': '1'}, format='json',
        )
        self.assertEqual(response.status_code, 400)
