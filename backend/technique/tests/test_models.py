from django.test import TestCase
from django.core.exceptions import ValidationError
from django.utils import timezone
from .factories import ProjectFactory, ProjectPhaseFactory, TaskFactory, TimeEntryFactory

class ModelTests(TestCase):
    def test_project_total_cost(self):
        project = ProjectFactory(cost_rate=100)
        task = TaskFactory(project=project)
        TimeEntryFactory(task=task, hours=5)
        self.assertEqual(project.total_cost, 500)
        
    def test_project_is_over_budget(self):
        project = ProjectFactory(budget=400, cost_rate=100)
        task = TaskFactory(project=project)
        TimeEntryFactory(task=task, hours=5)
        self.assertTrue(project.is_over_budget)

    def test_phase_clean(self):
        project = ProjectFactory(end_date=timezone.now().date())
        phase = ProjectPhaseFactory.build(project=project, end_date=timezone.now().date() + timezone.timedelta(days=1))
        with self.assertRaises(ValidationError):
            phase.clean()

    def test_timeentry_clean(self):
        entry = TimeEntryFactory.build(date=timezone.now().date() + timezone.timedelta(days=1))
        with self.assertRaises(ValidationError):
            entry.clean()

    def test_str_methods(self):
        project = ProjectFactory(name="Test Project")
        self.assertEqual(str(project), "Test Project")
