from unittest.mock import patch

from rest_framework.test import APIClient, APITestCase

from core.models import Role, User
from core.constants import ROLE_PROJECT_MANAGER, ROLE_DEVELOPER


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
