import factory
from factory.django import DjangoModelFactory
from core.models import User
from administration.models import (
    Client, ClientInteraction, ClientDocument, EmployeeDocument,
    LeaveRequest, CompanyAsset, AdministrativeRecord, ContractGenerator
)
from django.utils import timezone

class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    # password = ...

class ClientFactory(DjangoModelFactory):
    class Meta:
        model = Client
    company_name = factory.Sequence(lambda n: f"Company {n}")
    siret = factory.Sequence(lambda n: f"{n:014d}")
    status = Client.Status.PROSPECT

class ClientInteractionFactory(DjangoModelFactory):
    class Meta:
        model = ClientInteraction
    client = factory.SubFactory(ClientFactory)
    user = factory.SubFactory(UserFactory)
    interaction_type = ClientInteraction.InteractionType.CALL
    subject = "Subject"
    notes = "Notes"

class ClientDocumentFactory(DjangoModelFactory):
    class Meta:
        model = ClientDocument
    client = factory.SubFactory(ClientFactory)
    name = "Doc"
    file_path = "/path"
    file_type = ClientDocument.FileType.AUTRE_JURIDIQUE

class EmployeeDocumentFactory(DjangoModelFactory):
    class Meta:
        model = EmployeeDocument
    user = factory.SubFactory(UserFactory)
    document_name = "Doc"
    file_path = "/path"
    document_type = EmployeeDocument.DocumentType.AUTRE

class LeaveRequestFactory(DjangoModelFactory):
    class Meta:
        model = LeaveRequest
    user = factory.SubFactory(UserFactory)
    leave_type = LeaveRequest.LeaveType.CONGE_PAYE
    start_date = factory.LazyFunction(timezone.now)
    end_date = factory.LazyFunction(lambda: timezone.now() + timezone.timedelta(days=1))

class CompanyAssetFactory(DjangoModelFactory):
    class Meta:
        model = CompanyAsset
    asset_name = "Asset"
    serial_number = factory.Sequence(lambda n: f"SN{n}")
    asset_type = CompanyAsset.AssetType.AUTRE
    condition_status = CompanyAsset.ConditionStatus.NEUF

class AdministrativeRecordFactory(DjangoModelFactory):
    class Meta:
        model = AdministrativeRecord
    title = "Record"
    record_type = AdministrativeRecord.RecordType.NOTE_SERVICE

class ContractGeneratorFactory(DjangoModelFactory):
    class Meta:
        model = ContractGenerator
    contract_type = ContractGenerator.ContractType.NDA
    signing_status = ContractGenerator.SigningStatus.BROUILLON
