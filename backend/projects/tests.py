from rest_framework.test import APIClient, APITestCase

from core.models import Role, User
from projects.models import Project, ProjectMember


class ProjectViewSetTests(APITestCase):
    def setUp(self):
        self.chef_role = Role.objects.create(name='Chef de Projet', permissions={})
        self.dev_role = Role.objects.create(name='Développeur', permissions={})

        self.chef = User.objects.create(email='chef@sokensdigital.com', first_name='Chef')
        self.chef.roles.add(self.chef_role)

        self.dev = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        self.dev.roles.add(self.dev_role)

        self.outsider = User.objects.create(email='outsider@sokensdigital.com', first_name='Outsider')
        self.outsider.roles.add(self.dev_role)

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
