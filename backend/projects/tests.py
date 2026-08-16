from unittest.mock import patch

from rest_framework.test import APIClient, APITestCase

from core.models import Role, User
from core.constants import ROLE_PROJECT_MANAGER, ROLE_DEVELOPER, ROLE_SUPER_ADMIN


def _give_role(user, name):
    role, _ = Role.objects.get_or_create(name=name)
    user.roles.add(role)
    return role

from projects.models import Project, ProjectMember


class ProjectViewSetTests(APITestCase):
    def setUp(self):
        self.chef = User.objects.create(email='chef@sokensdigital.com', first_name='Chef')
        _give_role(self.chef, ROLE_PROJECT_MANAGER)

        self.dev = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.dev, ROLE_DEVELOPER)

        self.outsider = User.objects.create(email='outsider@sokensdigital.com', first_name='Outsider')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.client_chef = APIClient()
        self.client_chef.force_authenticate(user=self.chef)

        self.client_dev = APIClient()
        self.client_dev.force_authenticate(user=self.dev)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

        self.project = Project.objects.create(name='Refonte site vitrine', lead_project_manager=self.chef)
        ProjectMember.objects.create(project=self.project, user=self.dev)

    def test_chef_de_projet_can_create_project(self):
        response = self.client_chef.post('/api/v1/projects/', {'name': 'Nouveau projet'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['lead_project_manager']['id'], str(self.chef.id))

    def test_plain_dev_cannot_create_project(self):
        response = self.client_outsider.post('/api/v1/projects/', {'name': 'Interdit'}, format='json')
        self.assertEqual(response.status_code, 403)

    def test_super_admin_can_create_project(self):
        """Regression: IsProjectManagerOrReadOnly.has_permission used to
        omit ROLE_SUPER_ADMIN on the POST branch, 403'ing project creation
        for a Super-Admin despite the endpoint's own docstring promising it."""
        super_admin = User.objects.create(email='super@sokensdigital.com', first_name='Super')
        _give_role(super_admin, ROLE_SUPER_ADMIN)
        client = APIClient()
        client.force_authenticate(user=super_admin)
        response = client.post('/api/v1/projects/', {'name': 'Projet Super-Admin'}, format='json')
        self.assertEqual(response.status_code, 201)

    def test_super_admin_sees_every_project_in_list(self):
        super_admin = User.objects.create(email='super2@sokensdigital.com', first_name='Super')
        _give_role(super_admin, ROLE_SUPER_ADMIN)
        client = APIClient()
        client.force_authenticate(user=super_admin)
        response = client.get('/api/v1/projects/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)

    def test_member_sees_project_in_list_outsider_does_not(self):
        dev_ids = [p['id'] for p in self.client_dev.get('/api/v1/projects/').json()['results']]
        outsider_ids = [p['id'] for p in self.client_outsider.get('/api/v1/projects/').json()['results']]
        self.assertIn(str(self.project.id), dev_ids)
        self.assertNotIn(str(self.project.id), outsider_ids)

    def test_lead_can_add_member(self):
        response = self.client_chef.post(
            f'/api/v1/projects/{self.project.id}/members/',
            {'user_id': str(self.outsider.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertTrue(ProjectMember.objects.filter(project=self.project, user=self.outsider).exists())

    def test_non_lead_member_cannot_add_member(self):
        response = self.client_dev.post(
            f'/api/v1/projects/{self.project.id}/members/',
            {'user_id': str(self.outsider.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_lead_can_remove_member(self):
        membership = ProjectMember.objects.get(project=self.project, user=self.dev)
        response = self.client_chef.delete(f'/api/v1/projects/{self.project.id}/members/{membership.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ProjectMember.objects.filter(id=membership.id).exists())

    def test_end_date_before_start_date_rejected(self):
        response = self.client_chef.post(
            '/api/v1/projects/',
            {'name': 'Dates invalides', 'start_date': '2026-08-01', 'end_date': '2026-07-01'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    @patch('projects.views.set_chat_room_members')
    @patch('projects.views.upsert_chat_room')
    def test_create_pushes_firestore_chat_room(self, mock_upsert, mock_set_members):
        response = self.client_chef.post('/api/v1/projects/', {'name': 'Nouveau projet'}, format='json')
        project_id = response.json()['id']
        mock_upsert.assert_called_once_with(f'project-{project_id}', {
            'name': 'Salon Nouveau projet',
            'roomType': 'PROJECT',
            'projectId': project_id,
        })
        mock_set_members.assert_called_once()

    @patch('projects.views.set_chat_room_members')
    def test_add_member_resyncs_chat_room_uids(self, mock_set_members):
        self.chef.firebase_uid = 'uid-chef'
        self.chef.save(update_fields=['firebase_uid'])
        self.outsider.firebase_uid = 'uid-outsider'
        self.outsider.save(update_fields=['firebase_uid'])

        self.client_chef.post(
            f'/api/v1/projects/{self.project.id}/members/',
            {'user_id': str(self.outsider.id)},
            format='json',
        )
        last_call_uids = set(mock_set_members.call_args.args[1])
        self.assertEqual(last_call_uids, {'uid-chef', 'uid-outsider'})


class TimesheetTests(APITestCase):
    def setUp(self):
        self.chef = User.objects.create(email='chef@sokensdigital.com', first_name='Chef')
        _give_role(self.chef, ROLE_PROJECT_MANAGER)

        self.dev = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.dev, ROLE_DEVELOPER)

        self.other_dev = User.objects.create(email='dev2@sokensdigital.com', first_name='Dev2')
        _give_role(self.other_dev, ROLE_DEVELOPER)

        self.outsider = User.objects.create(email='outsider@sokensdigital.com', first_name='Outsider')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.project = Project.objects.create(name='Refonte site vitrine', lead_project_manager=self.chef)
        ProjectMember.objects.create(project=self.project, user=self.dev)
        ProjectMember.objects.create(project=self.project, user=self.other_dev)

        self.client_chef = APIClient()
        self.client_chef.force_authenticate(user=self.chef)

        self.client_dev = APIClient()
        self.client_dev.force_authenticate(user=self.dev)

        self.client_other_dev = APIClient()
        self.client_other_dev.force_authenticate(user=self.other_dev)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def test_member_can_submit_own_timesheet(self):
        response = self.client_dev.post(
            f'/api/v1/projects/{self.project.id}/timesheets/',
            {'date': '2026-07-20', 'hours': '7.5', 'description': 'Intégration API'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['status'], 'SOUMIS')
        self.assertEqual(response.json()['user']['id'], str(self.dev.id))

    def test_non_member_cannot_submit_timesheet(self):
        response = self.client_outsider.post(
            f'/api/v1/projects/{self.project.id}/timesheets/',
            {'date': '2026-07-20', 'hours': '7.5'},
            format='json',
        )
        # 404, not 403 — ProjectViewSet.get_queryset() already filters this
        # project out for non-members, same pattern as everywhere else.
        self.assertEqual(response.status_code, 404)

    def test_invalid_hours_rejected(self):
        response = self.client_dev.post(
            f'/api/v1/projects/{self.project.id}/timesheets/',
            {'date': '2026-07-20', 'hours': '30'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_member_sees_only_own_entries_lead_sees_all(self):
        from projects.models import Timesheet
        Timesheet.objects.create(project=self.project, user=self.dev, date='2026-07-20', hours='4')
        Timesheet.objects.create(project=self.project, user=self.other_dev, date='2026-07-20', hours='6')

        dev_entries = self.client_dev.get(f'/api/v1/projects/{self.project.id}/timesheets/').json()
        self.assertEqual(len(dev_entries), 1)

        chef_entries = self.client_chef.get(f'/api/v1/projects/{self.project.id}/timesheets/').json()
        self.assertEqual(len(chef_entries), 2)

    def test_lead_can_validate_timesheet(self):
        from projects.models import Timesheet
        ts = Timesheet.objects.create(project=self.project, user=self.dev, date='2026-07-20', hours='4')

        response = self.client_chef.post(
            f'/api/v1/projects/{self.project.id}/timesheets/{ts.id}/validate/',
            {'status': 'VALIDE'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        ts.refresh_from_db()
        self.assertEqual(ts.status, 'VALIDE')

    def test_dev_cannot_validate_timesheet(self):
        from projects.models import Timesheet
        ts = Timesheet.objects.create(project=self.project, user=self.dev, date='2026-07-20', hours='4')

        response = self.client_dev.post(
            f'/api/v1/projects/{self.project.id}/timesheets/{ts.id}/validate/',
            {'status': 'VALIDE'}, format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_duplicate_entry_same_day_rejected(self):
        self.client_dev.post(
            f'/api/v1/projects/{self.project.id}/timesheets/',
            {'date': '2026-07-20', 'hours': '4'}, format='json',
        )
        response = self.client_dev.post(
            f'/api/v1/projects/{self.project.id}/timesheets/',
            {'date': '2026-07-20', 'hours': '3'}, format='json',
        )
        self.assertEqual(response.status_code, 400)


class ProjectPinTests(APITestCase):
    def setUp(self):
        self.chef = User.objects.create(email='chef@sokensdigital.com', first_name='Chef')
        _give_role(self.chef, ROLE_PROJECT_MANAGER)

        self.dev = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.dev, ROLE_DEVELOPER)

        self.outsider = User.objects.create(email='outsider@sokensdigital.com', first_name='Outsider')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.project = Project.objects.create(name='Refonte site vitrine', lead_project_manager=self.chef)
        ProjectMember.objects.create(project=self.project, user=self.dev)

        self.client_chef = APIClient()
        self.client_chef.force_authenticate(user=self.chef)

        self.client_dev = APIClient()
        self.client_dev.force_authenticate(user=self.dev)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def test_member_can_pin_and_unpin(self):
        response = self.client_dev.post(f'/api/v1/projects/{self.project.id}/pin/')
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()['is_pinned'])
        self.assertTrue(self.project.pinned_by.filter(id=self.dev.id).exists())

        response = self.client_dev.post(f'/api/v1/projects/{self.project.id}/pin/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['is_pinned'])
        self.assertFalse(self.project.pinned_by.filter(id=self.dev.id).exists())

    def test_pin_is_per_user(self):
        self.client_chef.post(f'/api/v1/projects/{self.project.id}/pin/')
        list_for_dev = self.client_dev.get('/api/v1/projects/').json()['results']
        dev_view = next(p for p in list_for_dev if p['id'] == str(self.project.id))
        self.assertFalse(dev_view['is_pinned'])

    def test_non_member_cannot_pin(self):
        response = self.client_outsider.post(f'/api/v1/projects/{self.project.id}/pin/')
        self.assertEqual(response.status_code, 404)


class ProjectTaskTests(APITestCase):
    def setUp(self):
        self.chef = User.objects.create(email='chef@sokensdigital.com', first_name='Chef')
        _give_role(self.chef, ROLE_PROJECT_MANAGER)

        self.dev = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.dev, ROLE_DEVELOPER)

        self.outsider = User.objects.create(email='outsider@sokensdigital.com', first_name='Outsider')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.project = Project.objects.create(name='Refonte site vitrine', lead_project_manager=self.chef)
        ProjectMember.objects.create(project=self.project, user=self.dev)

        self.client_chef = APIClient()
        self.client_chef.force_authenticate(user=self.chef)

        self.client_dev = APIClient()
        self.client_dev.force_authenticate(user=self.dev)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def test_member_can_add_and_list_tasks(self):
        response = self.client_dev.post(
            f'/api/v1/projects/{self.project.id}/tasks/',
            {'title': 'Maquettes', 'due_date': '2026-08-20', 'assignee_ids': [str(self.dev.id)]},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['status'], 'TODO')
        self.assertEqual(response.json()['due_date'], '2026-08-20')
        self.assertEqual(response.json()['assignees'][0]['id'], str(self.dev.id))

        response = self.client_chef.get(f'/api/v1/projects/{self.project.id}/tasks/')
        self.assertEqual(len(response.json()), 1)

    def test_non_member_cannot_add_task(self):
        response = self.client_outsider.post(
            f'/api/v1/projects/{self.project.id}/tasks/', {'title': 'Interdit'}, format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_member_can_move_task_across_statuses(self):
        from projects.models import ProjectTask
        task = ProjectTask.objects.create(project=self.project, title='Maquettes')

        response = self.client_dev.patch(
            f'/api/v1/projects/{self.project.id}/tasks/{task.id}/',
            {'status': 'IN_REVIEW', 'progress': 80}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.status, 'IN_REVIEW')
        self.assertEqual(task.progress, 80)

    def test_progress_out_of_range_rejected(self):
        from projects.models import ProjectTask
        task = ProjectTask.objects.create(project=self.project, title='Maquettes')

        response = self.client_dev.patch(
            f'/api/v1/projects/{self.project.id}/tasks/{task.id}/', {'progress': 150}, format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_member_can_delete_task(self):
        from projects.models import ProjectTask
        task = ProjectTask.objects.create(project=self.project, title='Maquettes')

        response = self.client_chef.delete(f'/api/v1/projects/{self.project.id}/tasks/{task.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertFalse(ProjectTask.objects.filter(id=task.id).exists())

    def test_project_list_reports_tasks_progress(self):
        from projects.models import ProjectTask
        ProjectTask.objects.create(project=self.project, title='Fait', status='DONE')
        ProjectTask.objects.create(project=self.project, title='Pas fait', status='TODO')

        results = self.client_chef.get('/api/v1/projects/').json()['results']
        entry = next(p for p in results if p['id'] == str(self.project.id))
        self.assertEqual(entry['tasks_total'], 2)
        self.assertEqual(entry['tasks_done'], 1)

    def test_member_can_post_and_list_comments(self):
        from projects.models import ProjectTask
        task = ProjectTask.objects.create(project=self.project, title='Maquettes')

        response = self.client_dev.post(
            f'/api/v1/projects/{self.project.id}/tasks/{task.id}/comments/',
            {'body': 'Ça avance bien'}, format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['author']['id'], str(self.dev.id))

        response = self.client_chef.get(f'/api/v1/projects/{self.project.id}/tasks/{task.id}/comments/')
        self.assertEqual(len(response.json()), 1)

    def test_non_member_cannot_post_comment(self):
        from projects.models import ProjectTask
        task = ProjectTask.objects.create(project=self.project, title='Maquettes')

        response = self.client_outsider.post(
            f'/api/v1/projects/{self.project.id}/tasks/{task.id}/comments/',
            {'body': 'Interdit'}, format='json',
        )
        self.assertEqual(response.status_code, 404)


class TeamTimesheetTests(APITestCase):
    def setUp(self):
        from datetime import date, timedelta
        from projects.models import ProjectTask, Timesheet

        self.chef = User.objects.create(email='chef@sokensdigital.com', first_name='Chef')
        _give_role(self.chef, ROLE_PROJECT_MANAGER)

        self.dev = User.objects.create(email='dev@sokensdigital.com', first_name='Dev', last_name='Un')
        _give_role(self.dev, ROLE_DEVELOPER)

        self.outsider = User.objects.create(email='outsider@sokensdigital.com', first_name='Outsider')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.project = Project.objects.create(name='Refonte site vitrine', lead_project_manager=self.chef)
        ProjectMember.objects.create(project=self.project, user=self.dev)
        self.task = ProjectTask.objects.create(project=self.project, title='Maquettes')

        self.monday = date.today() - timedelta(days=date.today().weekday())
        self.tue = self.monday + timedelta(days=1)

        self.entry_soumis = Timesheet.objects.create(
            project=self.project, task=self.task, user=self.dev, date=self.monday, hours='3.50',
        )
        self.entry_valide = Timesheet.objects.create(
            project=self.project, task=None, user=self.dev, date=self.tue, hours='4.00', status='VALIDE',
        )

        self.client_chef = APIClient()
        self.client_chef.force_authenticate(user=self.chef)

        self.client_dev = APIClient()
        self.client_dev.force_authenticate(user=self.dev)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def test_lead_sees_team_week(self):
        response = self.client_chef.get(f'/api/v1/projects/timesheets/team/?week_start={self.monday.isoformat()}')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['week_start'], self.monday.isoformat())
        self.assertEqual(len(data['days']), 7)

        member = next(m for m in data['members'] if m['user']['id'] == str(self.dev.id))
        self.assertEqual(member['week_status'], 'PARTIAL')  # one SOUMIS, one VALIDE
        self.assertEqual(float(member['week_total']), 7.5)
        self.assertEqual(member['daily_status'][self.monday.isoformat()], 'SOUMIS')
        self.assertEqual(member['daily_status'][self.tue.isoformat()], 'VALIDE')
        self.assertEqual(len(member['tasks']), 2)  # one row for the task, one for task=None

    def test_non_lead_sees_no_team_data(self):
        response = self.client_dev.get('/api/v1/projects/timesheets/team/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['members'], [])

    def test_lead_can_approve_day(self):
        response = self.client_chef.post(
            '/api/v1/projects/timesheets/team/day-status/',
            {'user_id': str(self.dev.id), 'date': self.monday.isoformat(), 'status': 'VALIDE'},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.entry_soumis.refresh_from_db()
        self.assertEqual(self.entry_soumis.status, 'VALIDE')

    def test_non_lead_cannot_approve_day(self):
        response = self.client_outsider.post(
            '/api/v1/projects/timesheets/team/day-status/',
            {'user_id': str(self.dev.id), 'date': self.monday.isoformat(), 'status': 'VALIDE'},
            format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_duplicate_entry_same_task_same_day_rejected(self):
        response = self.client_dev.post(
            f'/api/v1/projects/{self.project.id}/timesheets/',
            {'date': self.monday.isoformat(), 'hours': '2', 'task_id': str(self.task.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_second_task_same_day_allowed(self):
        from projects.models import ProjectTask
        other_task = ProjectTask.objects.create(project=self.project, title='Développement')
        response = self.client_dev.post(
            f'/api/v1/projects/{self.project.id}/timesheets/',
            {'date': self.monday.isoformat(), 'hours': '2', 'task_id': str(other_task.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
