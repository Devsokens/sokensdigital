from decimal import Decimal

from rest_framework.test import APIClient, APITestCase

from core.models import Role, User
from core.constants import ROLE_RH_MANAGER, ROLE_DEVELOPER
from hr.models import EmployeeProfile


def _give_role(user, name):
    role, _ = Role.objects.get_or_create(name=name)
    user.roles.add(role)
    return role


class EmployeeProfileViewSetTests(APITestCase):
    def setUp(self):
        self.hr_user = User.objects.create(email='rh@sokensdigital.com', first_name='RH')
        _give_role(self.hr_user, ROLE_RH_MANAGER)

        self.dev_user = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.dev_user, ROLE_DEVELOPER)

        self.other_dev = User.objects.create(email='dev2@sokensdigital.com', first_name='Dev2')
        _give_role(self.other_dev, ROLE_DEVELOPER)

        self.dev_profile = EmployeeProfile.objects.create(
            user=self.dev_user, position='Développeur Backend', gross_monthly_salary=Decimal('600000')
        )
        self.other_profile = EmployeeProfile.objects.create(user=self.other_dev, position='Développeuse Frontend')

        self.client_hr = APIClient()
        self.client_hr.force_authenticate(user=self.hr_user)

        self.client_dev = APIClient()
        self.client_dev.force_authenticate(user=self.dev_user)

    def test_base_hourly_cost_auto_computed(self):
        self.dev_profile.refresh_from_db()
        expected = (Decimal('600000') / Decimal('151.67')).quantize(Decimal('0.01'))
        self.assertEqual(self.dev_profile.base_hourly_cost, expected)

    def test_hr_sees_all_employees(self):
        ids = [e['id'] for e in self.client_hr.get('/api/v1/hr/employees/').json()['results']]
        self.assertIn(str(self.dev_profile.id), ids)
        self.assertIn(str(self.other_profile.id), ids)

    def test_dev_sees_only_own_profile(self):
        ids = [e['id'] for e in self.client_dev.get('/api/v1/hr/employees/').json()['results']]
        self.assertEqual(ids, [str(self.dev_profile.id)])

    def test_dev_response_hides_salary(self):
        response = self.client_dev.get(f'/api/v1/hr/employees/{self.dev_profile.id}/')
        self.assertNotIn('gross_monthly_salary', response.json())
        self.assertNotIn('base_hourly_cost', response.json())

    def test_dev_cannot_create_employee_profile(self):
        response = self.client_dev.post(
            '/api/v1/hr/employees/',
            {'user_id': str(self.other_dev.id), 'position': 'Test'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_dev_cannot_edit_salary(self):
        response = self.client_dev.patch(
            f'/api/v1/hr/employees/{self.dev_profile.id}/',
            {'gross_monthly_salary': '999999'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_hr_can_add_contract(self):
        response = self.client_hr.post(
            f'/api/v1/hr/employees/{self.dev_profile.id}/contracts/',
            {'contract_type': 'CDI', 'start_date': '2026-01-01'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.dev_profile.refresh_from_db()
        self.assertEqual(self.dev_profile.contracts.count(), 1)

    def test_dev_cannot_add_contract(self):
        response = self.client_dev.post(
            f'/api/v1/hr/employees/{self.dev_profile.id}/contracts/',
            {'contract_type': 'CDI', 'start_date': '2026-01-01'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_hr_can_add_payslip(self):
        response = self.client_hr.post(
            f'/api/v1/hr/employees/{self.dev_profile.id}/payslips/',
            {'period_month': 6, 'period_year': 2026, 'file_url': 'https://drive.google.com/x'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)

    def test_dev_cannot_see_other_employee_profile(self):
        response = self.client_dev.get(f'/api/v1/hr/employees/{self.other_profile.id}/')
        self.assertEqual(response.status_code, 404)
