import factory
from factory.django import DjangoModelFactory
from core.models import User, Department, Role
from administration.models import Client
from technique.models import Project, ProjectPhase, ProjectDocument, Task, TimeEntry, Ticket, KnowledgeBase
from django.utils import timezone

class DepartmentFactory(DjangoModelFactory):
    class Meta:
        model = Department
    name = factory.Sequence(lambda n: f"Dept {n}")

class RoleFactory(DjangoModelFactory):
    class Meta:
        model = Role
        # core.migrations.0003_seed_role_permissions pre-seeds every real
        # role name on a fresh test DB — get_or_create on `name` so
        # RoleFactory(name=ROLE_ADMIN) reuses that row instead of colliding
        # with it on the unique constraint.
        django_get_or_create = ('name',)
    name = factory.Sequence(lambda n: f"Role {n}")

class UserFactory(DjangoModelFactory):
    class Meta:
        model = User
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    department = factory.SubFactory(DepartmentFactory)

class ClientFactory(DjangoModelFactory):
    class Meta:
        model = Client
    company_name = factory.Sequence(lambda n: f"Client {n}")
    email = factory.Sequence(lambda n: f"client{n}@example.com")

class ProjectFactory(DjangoModelFactory):
    class Meta:
        model = Project
    client = factory.SubFactory(ClientFactory)
    name = factory.Sequence(lambda n: f"Project {n}")
    budget = 10000.00
    cost_rate = 100.00
    start_date = timezone.now().date()
    end_date = timezone.now().date() + timezone.timedelta(days=30)
    project_manager = factory.SubFactory(UserFactory)

class ProjectPhaseFactory(DjangoModelFactory):
    class Meta:
        model = ProjectPhase
    project = factory.SubFactory(ProjectFactory)
    name = factory.Sequence(lambda n: f"Phase {n}")
    order = factory.Sequence(lambda n: n)
    start_date = timezone.now().date()
    end_date = timezone.now().date() + timezone.timedelta(days=10)

class ProjectDocumentFactory(DjangoModelFactory):
    class Meta:
        model = ProjectDocument
    project = factory.SubFactory(ProjectFactory)
    name = factory.Sequence(lambda n: f"Doc {n}")
    file_path = "/path/to/doc"
    uploaded_by = factory.SubFactory(UserFactory)

class TaskFactory(DjangoModelFactory):
    class Meta:
        model = Task
    project = factory.SubFactory(ProjectFactory)
    name = factory.Sequence(lambda n: f"Task {n}")
    estimated_hours = 10.00
    due_date = timezone.now().date()

class TimeEntryFactory(DjangoModelFactory):
    class Meta:
        model = TimeEntry
    task = factory.SubFactory(TaskFactory)
    user = factory.SubFactory(UserFactory)
    hours = 2.00
    date = timezone.now().date()

class TicketFactory(DjangoModelFactory):
    class Meta:
        model = Ticket
    title = factory.Sequence(lambda n: f"Ticket {n}")

class KnowledgeBaseFactory(DjangoModelFactory):
    class Meta:
        model = KnowledgeBase
    title = factory.Sequence(lambda n: f"KB {n}")
    created_by = factory.SubFactory(UserFactory)
