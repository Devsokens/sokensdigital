"""
Tests treasury — inexistants jusqu'au 17/08. Même bug has_role trouvé et
corrigé qu'en procurement (voir procurement/tests.py docstring) — cette app
a le même pattern de permission classes copié depuis procurement.
"""
from decimal import Decimal

from rest_framework.test import APIClient, APITestCase

from core.constants import ROLE_CAISSIER, ROLE_DEVELOPER, ROLE_DIRECTEUR_FINANCIER, ROLE_SUPER_ADMIN
from core.models import Role, User
from finance.models import Account, AccountingPeriod, DisbursementRequest, JournalEntry
from treasury.models import BankEntry, CapitalContribution, CashEntry
from treasury.tasks import (
    post_bank_entry_journal_entry, post_capital_contribution_journal_entry, post_cash_entry_journal_entry,
)


def _give_role(user, name):
    role, _ = Role.objects.get_or_create(name=name)
    user.roles.add(role)
    return role


class TreasuryTestBase(APITestCase):
    def setUp(self):
        self.caissier = User.objects.create(email='caissier@sokensdigital.com', first_name='Caisse')
        _give_role(self.caissier, ROLE_CAISSIER)

        self.cfo = User.objects.create(email='cfo@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)

        self.super_admin = User.objects.create(email='admin@sokensdigital.com', first_name='Admin')
        _give_role(self.super_admin, ROLE_SUPER_ADMIN)

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.client_caissier = APIClient()
        self.client_caissier.force_authenticate(user=self.caissier)
        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)
        self.client_admin = APIClient()
        self.client_admin.force_authenticate(user=self.super_admin)
        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

        self.period = AccountingPeriod.objects.create(
            label='2026-08', start_date='2026-08-01', end_date='2026-08-31',
        )


class CashEntryModelTests(TreasuryTestBase):
    def test_voucher_number_auto_generated(self):
        entry = CashEntry.objects.create(
            type=CashEntry.Type.ENTREE, source=CashEntry.Source.CLIENT_ESPECES,
            amount=Decimal('1000'), date='2026-08-15', created_by=self.caissier,
        )
        self.assertRegex(entry.voucher_number, r'^PC-\d{4}-\d{5}$')

    def test_negative_amount_rejected(self):
        entry = CashEntry(
            type=CashEntry.Type.ENTREE, source=CashEntry.Source.CLIENT_ESPECES,
            amount=Decimal('-1'), date='2026-08-15', created_by=self.caissier,
        )
        with self.assertRaises(Exception):
            entry.full_clean()


class CashEntryViewSetTests(TreasuryTestBase):
    def test_outsider_cannot_create(self):
        response = self.client_outsider.post('/api/v1/treasury/cash-entries/', {
            'type': 'ENTREE', 'source': 'CLIENT_ESPECES', 'amount': '1000', 'date': '2026-08-15',
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_caissier_can_create_and_reconcile(self):
        response = self.client_caissier.post('/api/v1/treasury/cash-entries/', {
            'type': 'ENTREE', 'source': 'CLIENT_ESPECES', 'amount': '1000', 'date': '2026-08-15',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        entry = CashEntry.objects.get(id=response.json()['id'])
        self.assertEqual(entry.created_by, self.caissier)

        response = self.client_caissier.post(f'/api/v1/treasury/cash-entries/{entry.id}/reconcile/')
        self.assertEqual(response.status_code, 200)
        entry.refresh_from_db()
        self.assertIsNotNone(entry.reconciled_at)
        self.assertEqual(entry.reconciled_by, self.caissier)

    def test_reconciled_entry_is_immutable(self):
        entry = CashEntry.objects.create(
            type=CashEntry.Type.ENTREE, source=CashEntry.Source.CLIENT_ESPECES,
            amount=Decimal('1000'), date='2026-08-15', created_by=self.caissier,
        )
        from django.utils import timezone
        entry.reconciled_at = timezone.now()
        entry.reconciled_by = self.cfo
        entry.save()

        response = self.client_cfo.patch(
            f'/api/v1/treasury/cash-entries/{entry.id}/', {'amount': '1'}, format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_reconciled_entry_cannot_be_deleted(self):
        entry = CashEntry.objects.create(
            type=CashEntry.Type.ENTREE, source=CashEntry.Source.CLIENT_ESPECES,
            amount=Decimal('1000'), date='2026-08-15', created_by=self.caissier,
        )
        from django.utils import timezone
        entry.reconciled_at = timezone.now()
        entry.save()

        response = self.client_cfo.delete(f'/api/v1/treasury/cash-entries/{entry.id}/')
        self.assertEqual(response.status_code, 400)


class BankEntryViewSetTests(TreasuryTestBase):
    def test_caissier_cannot_access_bank_entries(self):
        # Le Caissier tient la caisse, pas la banque (cahier des charges §3).
        response = self.client_caissier.post('/api/v1/treasury/bank-entries/', {
            'type': 'ENTREE', 'source': 'CLIENT_VIREMENT', 'amount': '1000',
            'date': '2026-08-15', 'reference': 'VIR-001',
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_cfo_can_create_and_reconcile(self):
        response = self.client_cfo.post('/api/v1/treasury/bank-entries/', {
            'type': 'ENTREE', 'source': 'CLIENT_VIREMENT', 'amount': '1000',
            'date': '2026-08-15', 'reference': 'VIR-001',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        entry = BankEntry.objects.get(id=response.json()['id'])

        response = self.client_cfo.post(f'/api/v1/treasury/bank-entries/{entry.id}/reconcile/')
        self.assertEqual(response.status_code, 200)
        entry.refresh_from_db()
        self.assertIsNotNone(entry.reconciled_at)

    def test_reconciled_bank_entry_is_immutable(self):
        entry = BankEntry.objects.create(
            type=BankEntry.Type.ENTREE, source=BankEntry.Source.CLIENT_VIREMENT,
            amount=Decimal('1000'), date='2026-08-15', reference='VIR-002', created_by=self.cfo,
        )
        from django.utils import timezone
        entry.reconciled_at = timezone.now()
        entry.save()

        response = self.client_cfo.patch(
            f'/api/v1/treasury/bank-entries/{entry.id}/', {'amount': '1'}, format='json',
        )
        self.assertEqual(response.status_code, 400)


class CapitalContributionViewSetTests(TreasuryTestBase):
    def test_full_validation_chain(self):
        # CapitalContributionViewSet est IsFinanceOrAdmin sur toute la vue
        # (contrairement à ProcurementRequest, ouvert à tout authentifié) —
        # même la création est réservée Finance/Admin.
        response = self.client_cfo.post('/api/v1/treasury/capital-contributions/', {
            'amount': '1000000', 'contribution_date': '2026-08-15',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        contribution = CapitalContribution.objects.get(id=response.json()['id'])
        self.assertEqual(contribution.status, CapitalContribution.Status.BROUILLON)

        response = self.client_cfo.post(f'/api/v1/treasury/capital-contributions/{contribution.id}/validate/')
        self.assertEqual(response.status_code, 200)
        contribution.refresh_from_db()
        self.assertEqual(contribution.status, CapitalContribution.Status.VALIDEE)
        self.assertEqual(contribution.validated_by, self.cfo)

        response = self.client_cfo.post(
            f'/api/v1/treasury/capital-contributions/{contribution.id}/submit_for_legal_registration/'
        )
        self.assertEqual(response.status_code, 200)
        contribution.refresh_from_db()
        self.assertEqual(contribution.status, CapitalContribution.Status.ENREGISTREE)

    def test_comptabilisee_is_immutable(self):
        contribution = CapitalContribution.objects.create(
            amount=Decimal('1000'), contribution_date='2026-08-15',
            status=CapitalContribution.Status.COMPTABILISEE,
        )
        response = self.client_cfo.patch(
            f'/api/v1/treasury/capital-contributions/{contribution.id}/', {'amount': '1'}, format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_wrong_status_transition_rejected(self):
        contribution = CapitalContribution.objects.create(
            amount=Decimal('1000'), contribution_date='2026-08-15',
            status=CapitalContribution.Status.BROUILLON,
        )
        # Ne peut pas s'enregistrer légalement sans être VALIDEE d'abord.
        response = self.client_cfo.post(
            f'/api/v1/treasury/capital-contributions/{contribution.id}/submit_for_legal_registration/'
        )
        self.assertEqual(response.status_code, 400)


class TreasuryTasksTests(TreasuryTestBase):
    """Tâches exécutées directement (.apply()) — safe_dispatch() est un
    no-op pendant les tests."""

    def test_post_cash_entry_journal_entry_client_especes(self):
        entry = CashEntry.objects.create(
            type=CashEntry.Type.ENTREE, source=CashEntry.Source.CLIENT_ESPECES,
            amount=Decimal('5000'), date='2026-08-15', created_by=self.caissier,
        )
        from django.utils import timezone
        entry.reconciled_at = timezone.now()
        entry.save()

        post_cash_entry_journal_entry.apply(args=(str(entry.id),)).get()

        entry_journal = JournalEntry.objects.get(journal_code=JournalEntry.JournalCode.OPERATIONS_DIVERSES)
        lines = list(entry_journal.lines.all())
        self.assertEqual(len(lines), 2)
        self.assertEqual(sum(l.debit for l in lines), sum(l.credit for l in lines))
        self.assertEqual(sum(l.debit for l in lines), Decimal('5000'))

    def test_post_cash_entry_journal_entry_noop_if_not_reconciled(self):
        entry = CashEntry.objects.create(
            type=CashEntry.Type.ENTREE, source=CashEntry.Source.CLIENT_ESPECES,
            amount=Decimal('5000'), date='2026-08-15', created_by=self.caissier,
        )
        post_cash_entry_journal_entry.apply(args=(str(entry.id),)).get()
        self.assertEqual(JournalEntry.objects.count(), 0)

    def test_post_bank_entry_journal_entry_apport_capital(self):
        entry = BankEntry.objects.create(
            type=BankEntry.Type.ENTREE, source=BankEntry.Source.APPORT_CAPITAL,
            amount=Decimal('1000000'), date='2026-08-15', reference='APPORT-001', created_by=self.cfo,
        )
        from django.utils import timezone
        entry.reconciled_at = timezone.now()
        entry.save()

        post_bank_entry_journal_entry.apply(args=(str(entry.id),)).get()

        entry_journal = JournalEntry.objects.get(journal_code=JournalEntry.JournalCode.BANQUE)
        lines = list(entry_journal.lines.all())
        self.assertEqual(sum(l.debit for l in lines), sum(l.credit for l in lines))
        self.assertEqual(sum(l.debit for l in lines), Decimal('1000000'))

    def test_post_capital_contribution_journal_entry_marks_comptabilisee(self):
        contribution = CapitalContribution.objects.create(
            amount=Decimal('2000000'), contribution_date='2026-08-15',
            status=CapitalContribution.Status.ENREGISTREE,
        )
        post_capital_contribution_journal_entry.apply(args=(str(contribution.id),)).get()

        contribution.refresh_from_db()
        self.assertEqual(contribution.status, CapitalContribution.Status.COMPTABILISEE)
        self.assertIsNotNone(contribution.posted_at)

        entry_journal = JournalEntry.objects.get(label__icontains='Augmentation capital')
        lines = list(entry_journal.lines.all())
        self.assertEqual(sum(l.debit for l in lines), sum(l.credit for l in lines))
        self.assertEqual(sum(l.debit for l in lines), Decimal('2000000'))


class TreasuryFullWorkflowIntegrationTest(TreasuryTestBase):
    def test_cash_entry_to_journal_entry_cycle(self):
        response = self.client_caissier.post('/api/v1/treasury/cash-entries/', {
            'type': 'ENTREE', 'source': 'CLIENT_ESPECES', 'amount': '25000',
            'date': '2026-08-15', 'description': 'Règlement facture FAC-2026-00042',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        entry = CashEntry.objects.get(id=response.json()['id'])

        response = self.client_caissier.post(f'/api/v1/treasury/cash-entries/{entry.id}/reconcile/')
        self.assertEqual(response.status_code, 200)

        # En pratique le safe_dispatch() déclenché par reconcile() aurait
        # posté l'écriture ; en test on l'exécute directement pour vérifier
        # le résultat comptable.
        post_cash_entry_journal_entry.apply(args=(str(entry.id),)).get()
        self.assertEqual(JournalEntry.objects.count(), 1)

        # Immutabilité : la pièce rapprochée ne peut plus être éditée.
        response = self.client_cfo.patch(
            f'/api/v1/treasury/cash-entries/{entry.id}/', {'amount': '1'}, format='json',
        )
        self.assertEqual(response.status_code, 400)
