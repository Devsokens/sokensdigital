from datetime import timedelta

from django.utils import timezone

from core.models import Notification
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


class CheckMaintenanceDueTests(TestCase):
    """La maintenance est contractuelle (3x/semaine) : le retard doit
    remonter tout seul, et continuer de remonter tant qu'il dure."""

    def setUp(self):
        from core.constants import ROLE_PROJECT_MANAGER
        from .factories import RoleFactory, UserFactory

        self.tech = UserFactory()
        self.lead = UserFactory()
        self.lead.roles.add(RoleFactory(name=ROLE_PROJECT_MANAGER))

    def _app(self, **kwargs):
        from technique.models import MaintainedApp

        defaults = {'name': 'Site client', 'assigned_to': self.tech}
        defaults.update(kwargs)
        return MaintainedApp.objects.create(**defaults)

    def _report(self, app, days_ago):
        from technique.models import MaintenanceReport

        return MaintenanceReport.objects.create(
            app=app,
            performed_by=self.tech,
            performed_at=timezone.now() - timedelta(days=days_ago),
            summary='RAS',
        )

    def _notifications_for(self, app):
        return Notification.objects.filter(entity_type='MaintainedApp', entity_id=str(app.pk))

    def test_alerts_assignee_when_never_maintained(self):
        from technique.tasks import check_maintenance_due

        app = self._app()
        check_maintenance_due()

        notification = self._notifications_for(app).get()
        self.assertEqual(notification.user_id, self.tech.id)
        self.assertIn('Site client', notification.title)

    def test_recent_report_silences_alert(self):
        from technique.tasks import check_maintenance_due

        app = self._app()
        # 3x/semaine => intervalle 2.33j + 1j de tolerance : 1 jour est dans
        # les clous.
        self._report(app, days_ago=1)
        check_maintenance_due()

        self.assertFalse(self._notifications_for(app).exists())

    def test_monthly_app_is_not_alerted_after_a_few_days(self):
        from technique.models import MaintenanceFrequency
        from technique.tasks import check_maintenance_due

        app = self._app(maintenance_frequency=MaintenanceFrequency.MENSUELLE)
        self._report(app, days_ago=5)
        check_maintenance_due()

        # La fenetre suit la frequence : 5 jours sur une app mensuelle n'est
        # pas un retard.
        self.assertFalse(self._notifications_for(app).exists())

    def test_unassigned_app_falls_back_to_technical_leads(self):
        from technique.tasks import check_maintenance_due

        app = self._app(assigned_to=None)
        check_maintenance_due()

        notification = self._notifications_for(app).get()
        self.assertEqual(notification.user_id, self.lead.id)
        self.assertIn('aucun technicien', notification.message)

    def test_alert_is_not_duplicated_within_the_same_day(self):
        from technique.tasks import check_maintenance_due

        app = self._app()
        check_maintenance_due()
        check_maintenance_due()

        self.assertEqual(self._notifications_for(app).count(), 1)

    def test_inactive_app_is_ignored(self):
        from technique.tasks import check_maintenance_due

        app = self._app(is_active=False)
        check_maintenance_due()

        self.assertFalse(self._notifications_for(app).exists())
