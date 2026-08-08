import factory
from factory.django import DjangoModelFactory
from django.utils import timezone
import datetime

from core.models import Department, User
from technique.models import Project
from administration.models import Client
from messaging.models import ChannelMetadata, ChannelParticipant


class DepartmentFactory(DjangoModelFactory):
    class Meta:
        model = Department
    name = factory.Sequence(lambda n: f"Dept {n}")


class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
    email = factory.Sequence(lambda n: f"user{n}@example.com")


class ClientFactory(DjangoModelFactory):
    class Meta:
        model = Client
    company_name = factory.Sequence(lambda n: f"Client {n}")
    siret = factory.Sequence(lambda n: f"{n:014d}")


class ProjectFactory(DjangoModelFactory):
    class Meta:
        model = Project
    client = factory.SubFactory(ClientFactory)
    name = factory.Sequence(lambda n: f"Project {n}")
    budget = 10000.00
    cost_rate = 100.00
    start_date = factory.LazyFunction(timezone.now().date)
    end_date = factory.LazyFunction(lambda: timezone.now().date() + datetime.timedelta(days=30))
    project_manager = factory.SubFactory(UserFactory)


class ChannelMetadataFactory(DjangoModelFactory):
    class Meta:
        model = ChannelMetadata
    firestore_conversation_id = factory.Sequence(lambda n: f"channel-{n}")
    name = factory.Sequence(lambda n: f"Channel {n}")
    type = ChannelMetadata.ChannelType.GROUP


class ChannelParticipantFactory(DjangoModelFactory):
    class Meta:
        model = ChannelParticipant
    channel = factory.SubFactory(ChannelMetadataFactory)
    user = factory.SubFactory(UserFactory)
