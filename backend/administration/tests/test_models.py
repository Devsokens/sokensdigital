from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone
from datetime import timedelta
from administration.models import (
    Client, LeaveRequest, AdministrativeRecord, ContractGenerator, ClientInteraction
)
from .factories import (
    UserFactory, ClientFactory, ContactFactory, LeaveRequestFactory,
    AdministrativeRecordFactory, ContractGeneratorFactory, ClientInteractionFactory
)

class ClientModelTest(TestCase):
    def test_siret_validation(self):
        client = Client(company_name="Test", siret="123")
        with self.assertRaises(ValidationError):
            client.clean()

class LeaveRequestModelTest(TestCase):
    def test_start_end_date_validation(self):
        user = UserFactory()
        leave = LeaveRequest(user=user, start_date=timezone.now().date() + timedelta(days=2), end_date=timezone.now().date())
        with self.assertRaises(ValidationError):
            leave.clean()

    def test_overlap_validation(self):
        user = UserFactory()
        leave1 = LeaveRequestFactory(user=user)
        leave2 = LeaveRequest(user=user, start_date=leave1.start_date, end_date=leave1.end_date)
        with self.assertRaises(ValidationError):
            leave2.clean()

class AdministrativeRecordTest(TestCase):
    def test_block_file_path_after_finalized(self):
        record = AdministrativeRecordFactory(is_finalized=True, file_path="/old")
        record.save()
        record.file_path = "/new"
        with self.assertRaises(ValidationError):
            record.clean()

class ContractGeneratorTest(TestCase):
    def test_block_mods_after_en_attente(self):
        contract = ContractGeneratorFactory(signing_status=ContractGenerator.SigningStatus.EN_ATTENTE_DE_SIGNATURE, template_data={})
        contract.save()
        contract.template_data = {"new": "data"}
        with self.assertRaises(ValidationError):
            contract.clean()

class ClientInteractionTest(TestCase):
    def test_is_locked_property(self):
        interaction = ClientInteractionFactory()
        self.assertFalse(interaction.is_locked)
        interaction.created_at = timezone.now() - timedelta(hours=25)
        interaction.save()
        self.assertTrue(interaction.is_locked)

    def test_contact_must_belong_to_same_client(self):
        client_a = ClientFactory()
        client_b = ClientFactory()
        contact_b = ContactFactory(client=client_b)
        interaction = ClientInteraction(
            client=client_a, contact=contact_b, user=UserFactory(),
            interaction_type='CALL', subject='x', notes='x',
        )
        with self.assertRaises(ValidationError):
            interaction.clean()
