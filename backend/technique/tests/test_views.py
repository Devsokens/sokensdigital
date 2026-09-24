from django.utils import timezone
from rest_framework.test import APITestCase
from django.urls import reverse
from technique.models import MaintainedApp, MaintenanceReport, TimeEntry
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

    def test_project_detail_dev_hides_budget(self):
        """Un Développeur ne voit ni budget, ni cost_rate en lecture."""
        self.project.members.add(self.dev)
        self.client.force_authenticate(user=self.dev)
        url = reverse('project-detail', kwargs={'pk': self.project.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('budget', response.data)
        self.assertNotIn('cost_rate', response.data)

    def test_project_detail_admin_sees_budget(self):
        """Un Admin voit toujours budget et cost_rate."""
        self.client.force_authenticate(user=self.admin)
        url = reverse('project-detail', kwargs={'pk': self.project.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        self.assertIn('budget', response.data)
        self.assertIn('cost_rate', response.data)

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

    def test_project_manage_members_non_manager_forbidden(self):
        """Un ChefProjet qui ne gère pas ce projet ne peut pas gérer ses membres —
        404 et non 403 : il n'est ni manager ni membre, donc hors de son
        queryset (get_queryset le filtre avant même d'atteindre l'action)."""
        other_pm = UserFactory()
        other_pm.roles.add(self.pm_role)
        self.client.force_authenticate(user=other_pm)
        url = reverse('project-manage-members', kwargs={'pk': self.project.pk})
        response = self.client.post(url, {'user_ids': [str(self.dev.id)]}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_project_manage_members_dev_forbidden(self):
        """Un Développeur ne peut pas gérer les membres d'un projet — 404 s'il
        n'est pas membre du projet (hors queryset)."""
        self.client.force_authenticate(user=self.dev)
        url = reverse('project-manage-members', kwargs={'pk': self.project.pk})
        response = self.client.post(url, {'user_ids': [str(self.dev.id)]}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_project_manage_members_dev_member_forbidden(self):
        """Un Développeur MEMBRE du projet ne peut pas non plus gérer ses
        membres (rôle insuffisant, pas un problème de visibilité)."""
        self.project.members.add(self.dev)
        self.client.force_authenticate(user=self.dev)
        url = reverse('project-manage-members', kwargs={'pk': self.project.pk})
        response = self.client.post(url, {'user_ids': [str(self.dev.id)]}, format='json')
        self.assertEqual(response.status_code, 403)

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
        response = self.client.patch(detail_url, {'status': 'EN_COURS'})
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
        """Un Chef de Projet qui ne gère pas ce projet ne peut pas le modifier —
        404 : hors de son queryset (ni manager, ni membre)."""
        other_pm = UserFactory()
        other_pm.roles.add(self.pm_role)
        self.client.force_authenticate(user=other_pm)
        url = reverse('project-detail', kwargs={'pk': self.project.pk})
        response = self.client.patch(url, {'name': 'Hacked'})
        self.assertEqual(response.status_code, 404)

    def test_project_update_pm_member_but_not_manager_forbidden(self):
        """Un Chef de Projet MEMBRE (mais pas manager) du projet ne peut pas
        le modifier non plus — 403, refus explicite dans perform_update."""
        other_pm = UserFactory()
        other_pm.roles.add(self.pm_role)
        self.project.members.add(other_pm)
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
        response = self.client.patch(url, {'status': 'EN_COURS'})
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


class TimeEntryValidationTests(APITestCase):
    """Validation des heures par le chef de projet (matrice des roles 3.1).

    Une entree validee alimente la facturation : elle doit se figer, et
    personne ne doit pouvoir valider ses propres heures.
    """

    def setUp(self):
        self.pm_role = RoleFactory(name=ROLE_PROJECT_MANAGER)
        self.dev_role = RoleFactory(name=ROLE_DEVELOPER)

        self.pm = UserFactory()
        self.pm.roles.add(self.pm_role)
        self.dev = UserFactory()
        self.dev.roles.add(self.dev_role)

        self.project = ProjectFactory(project_manager=self.pm)
        self.task = TaskFactory(project=self.project)
        self.entry = TimeEntryFactory(task=self.task, user=self.dev, hours=4)

    def _url(self, action):
        return reverse(
            f'task-timeentries-{action}',
            kwargs={'task_pk': self.task.pk, 'pk': self.entry.pk},
        )

    def test_project_manager_validates(self):
        self.client.force_authenticate(user=self.pm)
        response = self.client.post(self._url('valider'))

        self.assertEqual(response.status_code, 200)
        self.entry.refresh_from_db()
        self.assertTrue(self.entry.is_validated)
        self.assertEqual(self.entry.validated_by_id, self.pm.id)
        self.assertIsNotNone(self.entry.validated_at)

    def test_developer_cannot_validate_own_hours(self):
        self.client.force_authenticate(user=self.dev)
        response = self.client.post(self._url('valider'))

        self.assertEqual(response.status_code, 403)
        self.entry.refresh_from_db()
        self.assertFalse(self.entry.is_validated)

    def test_manager_of_another_project_cannot_validate(self):
        other_pm = UserFactory()
        other_pm.roles.add(self.pm_role)
        self.client.force_authenticate(user=other_pm)

        response = self.client.post(self._url('valider'))
        # 404 et non 403 : get_queryset ne lui expose deja pas cette entree,
        # donc il n'apprend meme pas qu'elle existe.
        self.assertEqual(response.status_code, 404)
        self.entry.refresh_from_db()
        self.assertFalse(self.entry.is_validated)

    def test_validated_entry_is_frozen(self):
        self.client.force_authenticate(user=self.pm)
        self.client.post(self._url('valider'))

        self.client.force_authenticate(user=self.dev)
        response = self.client.patch(self._url('detail'), {'hours': '9.00'}, format='json')

        self.assertEqual(response.status_code, 400)
        self.entry.refresh_from_db()
        self.assertEqual(str(self.entry.hours), '4.00')

    def test_validated_entry_cannot_be_deleted(self):
        self.client.force_authenticate(user=self.pm)
        self.client.post(self._url('valider'))

        self.client.force_authenticate(user=self.dev)
        response = self.client.delete(self._url('detail'))

        self.assertEqual(response.status_code, 403)
        self.assertTrue(TimeEntry.objects.filter(pk=self.entry.pk).exists())

    def test_validation_flag_is_not_writable_through_patch(self):
        # Sans read_only_fields, un simple PATCH suffirait a s'auto-valider.
        self.client.force_authenticate(user=self.dev)
        response = self.client.patch(
            self._url('detail'), {'is_validated': True}, format='json',
        )

        self.assertEqual(response.status_code, 200)
        self.entry.refresh_from_db()
        self.assertFalse(self.entry.is_validated)

    def test_unvalidate_reopens_the_entry(self):
        self.client.force_authenticate(user=self.pm)
        self.client.post(self._url('valider'))
        response = self.client.post(self._url('devalider'))

        self.assertEqual(response.status_code, 200)
        self.entry.refresh_from_db()
        self.assertFalse(self.entry.is_validated)
        self.assertIsNone(self.entry.validated_by_id)

        self.client.force_authenticate(user=self.dev)
        patch = self.client.patch(self._url('detail'), {'hours': '5.00'}, format='json')
        self.assertEqual(patch.status_code, 200)


class ProjectAccessPentestTests(APITestCase):
    """Régression du pentest du 24/09/2026 — les vues nested sous un projet
    (documents, tâches, entrées de temps) filtraient par project_pk/task_pk
    seul, sans jamais vérifier que l'utilisateur a un rapport avec CE
    projet précis : n'importe quel compte authentifié lisait le cahier des
    charges de n'importe quel projet, et n'importe quel Chef de Projet
    pouvait agir sur le projet d'un autre."""

    def setUp(self):
        pm_role = RoleFactory(name=ROLE_PROJECT_MANAGER)
        dev_role = RoleFactory(name=ROLE_DEVELOPER)
        self.pm_a = UserFactory()
        self.pm_a.roles.add(pm_role)
        self.pm_b = UserFactory()
        self.pm_b.roles.add(pm_role)
        self.dev_in = UserFactory()
        self.dev_in.roles.add(dev_role)
        self.dev_out = UserFactory()
        self.dev_out.roles.add(dev_role)
        self.plain = UserFactory()

        self.project_a = ProjectFactory(project_manager=self.pm_a)
        self.project_a.members.add(self.pm_a, self.dev_in)
        self.project_b = ProjectFactory(project_manager=self.pm_b)
        self.doc_b = ProjectDocumentFactory(
            project=self.project_b, file_path='gs://secret/cdc.pdf', uploaded_by=self.pm_b,
        )
        self.task_b = TaskFactory(project=self.project_b)

    def test_plain_user_cannot_list_or_read_foreign_project_documents(self):
        self.client.force_authenticate(user=self.plain)
        list_url = reverse('project-documents-list', kwargs={'project_pk': self.project_b.pk})
        response = self.client.get(list_url)
        self.assertEqual(response.status_code, 200)
        self.assertNotIn('gs://secret/cdc.pdf', str(response.data))

        detail_url = reverse('project-documents-detail', kwargs={'project_pk': self.project_b.pk, 'pk': self.doc_b.pk})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, 404)

    def test_outside_developer_cannot_read_foreign_project_document(self):
        self.client.force_authenticate(user=self.dev_out)
        detail_url = reverse('project-documents-detail', kwargs={'project_pk': self.project_b.pk, 'pk': self.doc_b.pk})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, 404)

    def test_pm_a_cannot_modify_or_delete_pm_b_document(self):
        self.client.force_authenticate(user=self.pm_a)
        detail_url = reverse('project-documents-detail', kwargs={'project_pk': self.project_b.pk, 'pk': self.doc_b.pk})
        response = self.client.patch(detail_url, {'file_path': 'https://evil/x.pdf'}, format='json')
        self.assertEqual(response.status_code, 403)
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, 403)

    def test_pm_a_cannot_create_task_in_pm_b_project(self):
        self.client.force_authenticate(user=self.pm_a)
        url = reverse('project-tasks-list', kwargs={'project_pk': self.project_b.pk})
        response = self.client.post(url, {
            'name': 'injected', 'estimated_hours': '5', 'due_date': str(timezone.now().date()),
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_outside_developer_cannot_log_time_on_foreign_task(self):
        self.client.force_authenticate(user=self.dev_out)
        url = reverse('task-timeentries-list', kwargs={'task_pk': self.task_b.pk})
        response = self.client.post(url, {
            'hours': '8', 'date': str(timezone.now().date()), 'description': 'x',
        }, format='json')
        self.assertEqual(response.status_code, 403)
        self.task_b.refresh_from_db()
        self.assertEqual(float(self.task_b.actual_hours or 0), 0.0)

    def test_member_developer_cannot_change_project_status(self):
        self.client.force_authenticate(user=self.dev_in)
        url = reverse('project-change-status', kwargs={'pk': self.project_a.pk})
        response = self.client.post(url, {'status': 'CLOS'}, format='json')
        self.assertEqual(response.status_code, 403)
        self.project_a.refresh_from_db()
        self.assertNotEqual(self.project_a.status, 'CLOS')

    def test_pm_b_cannot_change_project_a_status(self):
        # 404, pas 403 : project_a est hors du queryset de pm_b (ni
        # manager, ni membre) — get_object() le rejette avant même
        # d'atteindre le contrôle de gestion.
        self.client.force_authenticate(user=self.pm_b)
        url = reverse('project-change-status', kwargs={'pk': self.project_a.pk})
        response = self.client.post(url, {'status': 'CLOS'}, format='json')
        self.assertEqual(response.status_code, 404)

    def test_outsider_cannot_delete_someone_elses_maintenance_report(self):
        app = MaintainedApp.objects.create(name='App')
        report = MaintenanceReport.objects.create(app=app, performed_by=self.dev_in, summary='ok')
        self.client.force_authenticate(user=self.dev_out)
        response = self.client.delete(f'/api/technique/maintenance/reports/{report.pk}/')
        self.assertEqual(response.status_code, 403)
        self.assertTrue(MaintenanceReport.objects.filter(pk=report.pk).exists())
