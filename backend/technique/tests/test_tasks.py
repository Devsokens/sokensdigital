from django.test import TestCase
from technique.models import Ticket, Project
from technique.tasks import auto_close_ticket, check_budget_alerts, send_ticket_resolution_email
from technique.tests.factories import TicketFactory, ProjectFactory, TaskFactory, TimeEntryFactory

class TaskTests(TestCase):
    def test_auto_close_ticket(self):
        ticket = TicketFactory(status='RESOLVED')
        auto_close_ticket(ticket.id)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, 'CLOSED')

    def test_auto_close_ticket_not_resolved(self):
        ticket = TicketFactory(status='NEW')
        auto_close_ticket(ticket.id)
        ticket.refresh_from_db()
        self.assertEqual(ticket.status, 'NEW')

    def test_auto_close_ticket_non_existent(self):
        auto_close_ticket('00000000-0000-0000-0000-000000000000')

    def test_check_budget_alerts(self):
        project = ProjectFactory(status='EN_COURS', budget=100, cost_rate=50)
        task = TaskFactory(project=project)
        TimeEntryFactory(task=task, hours=3)
        check_budget_alerts()

    def test_send_ticket_resolution_email(self):
        send_ticket_resolution_email('00000000-0000-0000-0000-000000000000')
