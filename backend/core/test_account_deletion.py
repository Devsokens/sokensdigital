from unittest.mock import patch

from rest_framework.test import APIClient, APITestCase

from core.constants import ROLE_DEVELOPER, ROLE_RH_MANAGER, ROLE_SUPER_ADMIN
from core.models import Role, User
from hr.models import Contract, EmployeeProfile


def _user(email, *roles, firebase_uid=None):
    user = User.objects.create(email=email, first_name=email.split('@')[0], firebase_uid=firebase_uid)
    for name in roles:
        role, _ = Role.objects.get_or_create(name=name)
        user.roles.add(role)
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@patch('core.accounts.delete_profile')
@patch('firebase_admin.auth.delete_user')
class DeleteUserAccountTests(APITestCase):
    def setUp(self):
        self.admin = _user('admin@sokensdigital.com', ROLE_SUPER_ADMIN)
        self.dev = _user('dev@sokensdigital.com', ROLE_DEVELOPER, firebase_uid='uid-dev')
        self.profile = EmployeeProfile.objects.create(user=self.dev, position='Développeur')

    def _url(self, user):
        return f'/api/v1/users/{user.pk}/account/'

    def test_deleting_user_keeps_employee_record(self, firebase_delete, profile_delete):
        response = _client(self.admin).delete(self._url(self.dev))

        self.assertEqual(response.status_code, 204)
        firebase_delete.assert_called_once_with('uid-dev')
        profile_delete.assert_called_once_with('uid-dev')
        self.dev.refresh_from_db()
        self.assertIsNotNone(self.dev.account_deleted_at)
        self.assertIsNone(self.dev.firebase_uid)
        self.assertFalse(self.dev.is_active)
        self.assertFalse(self.dev.roles.exists())
        self.assertTrue(EmployeeProfile.objects.filter(pk=self.profile.pk).exists())

    def test_deleted_user_leaves_the_user_list(self, firebase_delete, profile_delete):
        _client(self.admin).delete(self._url(self.dev))
        ids = [u['id'] for u in _client(self.admin).get('/api/v1/users/').json()['results']]
        self.assertNotIn(str(self.dev.pk), ids)

    def test_employee_shows_no_account_after_user_deletion(self, firebase_delete, profile_delete):
        _client(self.admin).delete(self._url(self.dev))
        data = _client(self.admin).get(f'/api/v1/hr/employees/{self.profile.pk}/').json()
        self.assertFalse(data['has_account'])

    def test_only_super_admin_can_delete_a_user(self, firebase_delete, profile_delete):
        rh = _user('rh@sokensdigital.com', ROLE_RH_MANAGER)
        response = _client(rh).delete(self._url(self.dev))
        self.assertEqual(response.status_code, 403)
        firebase_delete.assert_not_called()

    def test_cannot_delete_own_account(self, firebase_delete, profile_delete):
        response = _client(self.admin).delete(self._url(self.admin))
        self.assertEqual(response.status_code, 400)

    def test_firebase_failure_changes_nothing(self, firebase_delete, profile_delete):
        firebase_delete.side_effect = RuntimeError('réseau')
        response = _client(self.admin).delete(self._url(self.dev))

        self.assertEqual(response.status_code, 502)
        self.dev.refresh_from_db()
        self.assertIsNone(self.dev.account_deleted_at)
        self.assertEqual(self.dev.firebase_uid, 'uid-dev')


@patch('core.accounts.delete_profile')
@patch('firebase_admin.auth.delete_user')
class DeleteEmployeeTests(APITestCase):
    def setUp(self):
        self.rh = _user('rh@sokensdigital.com', ROLE_RH_MANAGER)
        self.dev = _user('dev@sokensdigital.com', ROLE_DEVELOPER, firebase_uid='uid-dev')
        self.profile = EmployeeProfile.objects.create(user=self.dev, position='Développeur')
        Contract.objects.create(employee=self.profile, contract_type='CDI', start_date='2026-01-01')

    def test_deleting_employee_deletes_user_account(self, firebase_delete, profile_delete):
        response = _client(self.rh).delete(f'/api/v1/hr/employees/{self.profile.pk}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(EmployeeProfile.objects.filter(pk=self.profile.pk).exists())
        firebase_delete.assert_called_once_with('uid-dev')
        self.dev.refresh_from_db()
        self.assertIsNotNone(self.dev.account_deleted_at)

    def test_rh_cannot_delete_a_super_admin_employee(self, firebase_delete, profile_delete):
        boss = _user('boss@sokensdigital.com', ROLE_SUPER_ADMIN, firebase_uid='uid-boss')
        boss_profile = EmployeeProfile.objects.create(user=boss)

        response = _client(self.rh).delete(f'/api/v1/hr/employees/{boss_profile.pk}/')

        self.assertEqual(response.status_code, 403)
        self.assertTrue(EmployeeProfile.objects.filter(pk=boss_profile.pk).exists())
        firebase_delete.assert_not_called()

    def test_non_hr_cannot_delete_employee(self, firebase_delete, profile_delete):
        response = _client(self.dev).delete(f'/api/v1/hr/employees/{self.profile.pk}/')
        self.assertEqual(response.status_code, 403)
