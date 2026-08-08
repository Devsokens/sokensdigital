from rest_framework.test import APITestCase
from django.urls import reverse
from .factories import (
    UserFactory, ProjectFactory, RoleFactory, ProjectPhaseFactory,
    ProjectDocumentFactory, TaskFactory, TimeEntryFactory, TicketFactory, KnowledgeBaseFactory
)

from core.constants import ROLE_ADMIN, ROLE_DEVELOPER, ROLE_PROJECT_MANAGER

class ViewTests(APITestCase):
    def setUp(self):
        self.admin_role = RoleFactory(name=ROLE_ADMIN)
        self.dev_role = RoleFactory(name=ROLE_DEVELOPER)
        self.pm_role = RoleFactory(name=ROLE_PROJECT_MANAGER)
        self.admin = UserFactory()
        self.admin.roles.add(self.admin_role)
        self.dev = UserFactory()
        self.dev.roles.add(self.dev_role)
        self.pm = UserFactory()
        self.pm.roles.add(self.pm_role)
        self.project = ProjectFactory(project_manager=self.pm)

    def test_project_list_admin(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('project-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_project_list_dev_not_member(self):
        self.client.force_authenticate(user=self.dev)
        url = reverse('project-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(results), 0)

    def test_project_list_dev_member(self):
        self.project.members.add(self.dev)
        self.client.force_authenticate(user=self.dev)
        url = reverse('project-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(results), 1)

    def test_project_detail(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('project-detail', kwargs={'pk': self.project.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_project_change_status(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('project-change-status', kwargs={'pk': self.project.pk})
        response = self.client.post(url, {'status': 'EN_COURS'})
        self.assertEqual(response.status_code, 200)

    def test_project_manage_members(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('project-manage-members', kwargs={'pk': self.project.pk})
        response = self.client.post(url, {'user_ids': [str(self.dev.id)]}, format='json')
        self.assertEqual(response.status_code, 200)

    def test_project_phases_list(self):
        phase = ProjectPhaseFactory(project=self.project)
        self.client.force_authenticate(user=self.admin)
        url = reverse('project-phases-list', kwargs={'project_pk': self.project.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_project_documents_list(self):
        doc = ProjectDocumentFactory(project=self.project)
        self.client.force_authenticate(user=self.admin)
        url = reverse('project-documents-list', kwargs={'project_pk': self.project.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_tasks_list_and_patch(self):
        task = TaskFactory(project=self.project, assigned_to=self.dev)
        self.client.force_authenticate(user=self.dev)
        url = reverse('project-tasks-list', kwargs={'project_pk': self.project.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

        detail_url = reverse('project-tasks-detail', kwargs={'project_pk': self.project.pk, 'pk': task.pk})
        response = self.client.patch(detail_url, {'status': 'IN_PROGRESS'})
        self.assertEqual(response.status_code, 200)

    def test_time_entries(self):
        task = TaskFactory(project=self.project)
        entry = TimeEntryFactory(task=task, user=self.dev)
        self.client.force_authenticate(user=self.dev)
        url = reverse('task-timeentries-list', kwargs={'task_pk': task.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_tickets_crud(self):
        ticket = TicketFactory(project=self.project)
        self.client.force_authenticate(user=self.admin)
        url = reverse('ticket-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)

    def test_knowledge_base_crud(self):
        kb = KnowledgeBaseFactory(created_by=self.admin)
        self.client.force_authenticate(user=self.admin)
        url = reverse('knowledgebase-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
