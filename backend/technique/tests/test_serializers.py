from django.test import TestCase
from django.utils import timezone
from technique.serializers import ProjectSerializer, ProjectPhaseSerializer, TimeEntrySerializer
from .factories import ProjectFactory, UserFactory, TaskFactory, TimeEntryFactory

class SerializerTests(TestCase):
    def test_project_budget_validation(self):
        serializer = ProjectSerializer(data={'budget': 0}, partial=True)
        serializer.is_valid()
        self.assertIn('budget', serializer.errors)

    def test_project_date_validation(self):
        data = {
            'start_date': timezone.now().date() + timezone.timedelta(days=1),
            'end_date': timezone.now().date()
        }
        serializer = ProjectSerializer(data=data, partial=True)
        serializer.is_valid()
        self.assertIn('start_date', serializer.errors)

    def test_timeentry_24h_limit(self):
        user = UserFactory()
        task = TaskFactory()
        TimeEntryFactory(user=user, task=task, date=timezone.now().date(), hours=20)
        
        data = {
            'user': user.id,
            'task': task.id,
            'date': timezone.now().date(),
            'hours': 5,
            'description': 'test'
        }
        serializer = TimeEntrySerializer(data=data)
        serializer.is_valid()
        self.assertIn('hours', serializer.errors)
