from rest_framework.test import APITestCase
from django.urls import reverse
from .factories import (
    UserFactory, ProjectFactory, RoleFactory, ProjectPhaseFactory,
    ProjectDocumentFactory, TaskFactory, TimeEntryFactory, TicketFactory, KnowledgeBaseFactory
)

from core.constants import (
    ROLE_ADMIN, ROLE_DEVELOPER, ROLE_PROJECT_MANAGER, ROLE_CONSULTANT,
)

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

    # --- Tests RBAC ajoutés (pass 1) ---

    def test_project_update_pm_not_manager_forbidden(self):
        """Un Chef de Projet qui ne gère pas ce projet ne peut pas le modifier."""
        other_pm = UserFactory()
        other_pm.roles.add(self.pm_role)
        self.client.force_authenticate(user=other_pm)
        url = reverse('project-detail', kwargs={'pk': self.project.pk})
        response = self.client.patch(url, {'name': 'Hacked'})
        self.assertEqual(response.status_code, 403)

    def test_project_update_pm_owner_allowed(self):
        """Le Chef de Projet qui gère le projet peut le modifier."""
        self.client.force_authenticate(user=self.pm)
        url = reverse('project-detail', kwargs={'pk': self.project.pk})
        response = self.client.patch(url, {'name': 'Nouveau nom'})
        self.assertEqual(response.status_code, 200)

    def test_project_phases_list_non_member_dev_empty(self):
        """Un Dev non-membre du projet ne voit pas ses phases."""
        ProjectPhaseFactory(project=self.project)
        outsider = UserFactory()
        outsider.roles.add(self.dev_role)
        self.client.force_authenticate(user=outsider)
        url = reverse('project-phases-list', kwargs={'project_pk': self.project.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(results), 0)

    def test_project_document_dev_without_linked_task_forbidden(self):
        """Un Dev sans tâche liée à la phase ne peut pas uploader un document."""
        phase = ProjectPhaseFactory(project=self.project)
        self.project.members.add(self.dev)
        self.client.force_authenticate(user=self.dev)
        url = reverse('project-documents-list', kwargs={'project_pk': self.project.pk})
        response = self.client.post(url, {
            'name': 'Livrable.pdf', 'file_path': '/x', 'phase': str(phase.pk),
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_project_document_dev_with_linked_task_allowed(self):
        """Un Dev avec une tâche liée à la phase peut uploader un document."""
        phase = ProjectPhaseFactory(project=self.project)
        TaskFactory(project=self.project, phase=phase, assigned_to=self.dev)
        self.project.members.add(self.dev)
        self.client.force_authenticate(user=self.dev)
        url = reverse('project-documents-list', kwargs={'project_pk': self.project.pk})
        response = self.client.post(url, {
            'name': 'Livrable.pdf', 'file_path': '/x', 'phase': str(phase.pk),
        }, format='json')
        self.assertEqual(response.status_code, 201)

    def test_task_patch_unassigned_dev_forbidden(self):
        """Un Dev non-assigné à la tâche ne peut pas la modifier."""
        task = TaskFactory(project=self.project, assigned_to=self.dev)
        other_dev = UserFactory()
        other_dev.roles.add(self.dev_role)
        self.project.members.add(other_dev)
        self.client.force_authenticate(user=other_dev)
        url = reverse('project-tasks-detail', kwargs={'project_pk': self.project.pk, 'pk': task.pk})
        response = self.client.patch(url, {'status': 'IN_PROGRESS'})
        self.assertEqual(response.status_code, 403)

    def test_time_entries_pm_other_project_scoped_to_own_entries(self):
        """Un ChefProjet d'un autre projet ne voit que ses propres entrées, pas celles du projet A."""
        task = TaskFactory(project=self.project)
        TimeEntryFactory(task=task, user=self.dev)
        other_pm = UserFactory()
        other_pm.roles.add(self.pm_role)
        self.client.force_authenticate(user=other_pm)
        url = reverse('task-timeentries-list', kwargs={'task_pk': task.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(results), 0)

    def test_ticket_create_no_role_forbidden(self):
        """Un utilisateur authentifié sans rôle habilité ne peut pas créer de ticket."""
        plain_user = UserFactory()
        self.client.force_authenticate(user=plain_user)
        url = reverse('ticket-list')
        response = self.client.post(url, {'title': 'Bug', 'description': 'x'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_ticket_list_non_member_scoped(self):
        """Un utilisateur non-membre du projet et non-assigné ne voit pas le ticket."""
        TicketFactory(project=self.project)
        outsider = UserFactory()
        outsider.roles.add(self.dev_role)
        self.client.force_authenticate(user=outsider)
        url = reverse('ticket-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(results), 0)

    def test_knowledge_base_write_non_consultant_forbidden(self):
        """Un utilisateur non-Consultant/non-Admin/non-PM ne peut pas écrire en KB."""
        plain_dev = UserFactory()
        plain_dev.roles.add(self.dev_role)
        self.client.force_authenticate(user=plain_dev)
        url = reverse('knowledgebase-list')
        response = self.client.post(url, {'title': 'Article', 'content': 'x'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_knowledge_base_write_consultant_allowed(self):
        """Un Consultant peut écrire en KB."""
        consultant_role = RoleFactory(name=ROLE_CONSULTANT)
        consultant = UserFactory()
        consultant.roles.add(consultant_role)
        self.client.force_authenticate(user=consultant)
        url = reverse('knowledgebase-list')
        response = self.client.post(url, {'title': 'Article', 'content': 'x'}, format='json')
        self.assertEqual(response.status_code, 201)
