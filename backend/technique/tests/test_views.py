from rest_framework.test import APITestCase
from django.urls import reverse
from .factories import UserFactory, ProjectFactory, RoleFactory

from core.constants import ROLE_ADMIN, ROLE_DEVELOPER

class ViewTests(APITestCase):
    def setUp(self):
        self.admin_role = RoleFactory(name=ROLE_ADMIN)
        self.dev_role = RoleFactory(name=ROLE_DEVELOPER)
        self.admin = UserFactory()
        self.admin.roles.add(self.admin_role)
        self.dev = UserFactory()
        self.dev.roles.add(self.dev_role)
        self.project = ProjectFactory()

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
