from unittest.mock import MagicMock, patch

from rest_framework.test import APIClient, APITestCase

from core.models import AuditLog, Department, User


class MeViewTests(APITestCase):
    """
    Exercises GET/PATCH /api/v1/auth/me/ with `force_authenticate`, i.e.
    bypassing FirebaseAuthentication itself (that part is Firebase's
    contract, not ours) — what we're actually verifying is that once a user
    IS authenticated, the endpoint returns the right shape and enforces the
    right write boundary.
    """

    def setUp(self):
        self.department = Department.objects.create(name='Ingénierie', color='#22d3ee')
        self.user = User.objects.create(
            email='dev@sokensdigital.com',
            first_name='Ada',
            last_name='Lovelace',
            department=self.department,
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_get_me_returns_profile_with_department(self):
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data['email'], 'dev@sokensdigital.com')
        self.assertEqual(data['first_name'], 'Ada')
        self.assertEqual(data['department']['name'], 'Ingénierie')

    def test_unauthenticated_request_is_rejected(self):
        anon_client = APIClient()
        response = anon_client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, 401)

    def test_patch_updates_self_editable_fields_only(self):
        response = self.client.patch(
            '/api/v1/auth/me/',
            {
                'first_name': 'Grace',
                'is_staff': True,  # must be silently ignored, not applied
                'email': 'someone-else@sokensdigital.com',  # must be ignored too
            },
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertEqual(self.user.first_name, 'Grace')
        self.assertFalse(self.user.is_staff)
        self.assertEqual(self.user.email, 'dev@sokensdigital.com')


class ProvisionUserViewTests(APITestCase):
    """Firebase Admin SDK + Firestore are mocked — this environment has no
    real credentials configured. What's under test is the Django-side
    orchestration (permissions, rollback-on-failure, User row creation),
    not Firebase itself."""

    def setUp(self):
        self.department = Department.objects.create(name='Technique', color='#22d3ee')
        self.rh_user = User.objects.create(email='rh@sokensdigital.com', first_name='RH')
        self.rh_user.firestore_role = 'RESPONSABLE_RH'

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        self.outsider.firestore_role = 'DEVELOPPEUR'

        self.client_rh = APIClient()
        self.client_rh.force_authenticate(user=self.rh_user)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def payload(self, **overrides):
        data = {
            'email': 'new.employee@sokensdigital.com',
            'password': 'a-strong-password',
            'first_name': 'New',
            'last_name': 'Employee',
            'role': 'DEVELOPPEUR',
            'department_id': str(self.department.id),
        }
        data.update(overrides)
        return data

    @patch('core.views.create_profile')
    @patch('firebase_admin.auth.create_user')
    def test_rh_can_provision_user(self, mock_create_user, mock_create_profile):
        mock_create_user.return_value = MagicMock(uid='firebase-uid-123')

        response = self.client_rh.post('/api/v1/users/provision/', self.payload(), format='json')

        self.assertEqual(response.status_code, 201)
        mock_create_user.assert_called_once()
        mock_create_profile.assert_called_once_with('firebase-uid-123', {
            'email': 'new.employee@sokensdigital.com',
            'firstName': 'New',
            'lastName': 'Employee',
            'role': 'DEVELOPPEUR',
            'departmentId': str(self.department.id),
        })
        user = User.objects.get(email_hash__isnull=False, firebase_uid='firebase-uid-123')
        self.assertEqual(user.first_name, 'New')
        self.assertEqual(user.department_id, self.department.id)

    @patch('firebase_admin.auth.create_user')
    def test_outsider_forbidden(self, mock_create_user):
        response = self.client_outsider.post('/api/v1/users/provision/', self.payload(), format='json')
        self.assertEqual(response.status_code, 403)
        mock_create_user.assert_not_called()

    @patch('core.views.create_profile')
    @patch('firebase_admin.auth.delete_user')
    @patch('firebase_admin.auth.create_user')
    def test_firestore_failure_rolls_back_firebase_user(self, mock_create_user, mock_delete_user, mock_create_profile):
        mock_create_user.return_value = MagicMock(uid='firebase-uid-456')
        mock_create_profile.side_effect = RuntimeError('Firestore unreachable')

        with self.assertRaises(RuntimeError):
            self.client_rh.post('/api/v1/users/provision/', self.payload(), format='json')

        mock_delete_user.assert_called_once_with('firebase-uid-456')
        self.assertFalse(User.objects.filter(firebase_uid='firebase-uid-456').exists())

    @patch('firebase_admin.auth.create_user')
    def test_rh_cannot_provision_super_admin(self, mock_create_user):
        response = self.client_rh.post('/api/v1/users/provision/', self.payload(role='SUPER_ADMIN'), format='json')
        self.assertEqual(response.status_code, 403)
        mock_create_user.assert_not_called()

    @patch('core.views.create_profile')
    @patch('firebase_admin.auth.create_user')
    def test_super_admin_can_provision_super_admin(self, mock_create_user, mock_create_profile):
        mock_create_user.return_value = MagicMock(uid='firebase-uid-789')
        super_admin = User.objects.create(email='super@sokensdigital.com', first_name='Super')
        super_admin.firestore_role = 'SUPER_ADMIN'
        client = APIClient()
        client.force_authenticate(user=super_admin)

        response = client.post('/api/v1/users/provision/', self.payload(role='SUPER_ADMIN'), format='json')
        self.assertEqual(response.status_code, 201)


class SetUserRoleViewTests(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(name='Finance', color='#22d3ee')
        self.super_admin = User.objects.create(email='super@sokensdigital.com', first_name='Super')
        self.super_admin.firestore_role = 'SUPER_ADMIN'

        self.rh_user = User.objects.create(email='rh@sokensdigital.com', first_name='RH')
        self.rh_user.firestore_role = 'RESPONSABLE_RH'

        self.employee = User.objects.create(
            email='employee@sokensdigital.com', first_name='Employee', firebase_uid='firebase-uid-existing',
        )

        self.client_super_admin = APIClient()
        self.client_super_admin.force_authenticate(user=self.super_admin)

        self.client_rh = APIClient()
        self.client_rh.force_authenticate(user=self.rh_user)

    @patch('core.views.update_profile_fields')
    def test_super_admin_can_change_role(self, mock_update):
        response = self.client_super_admin.patch(
            f'/api/v1/users/{self.employee.id}/role/',
            {'role': 'COMPTABLE', 'department_id': str(self.department.id)},
            format='json',
        )
        self.assertEqual(response.status_code, 200)
        mock_update.assert_called_once_with('firebase-uid-existing', {
            'role': 'COMPTABLE',
            'departmentId': str(self.department.id),
        })
        self.employee.refresh_from_db()
        self.assertEqual(self.employee.department_id, self.department.id)

    @patch('core.views.update_profile_fields')
    def test_rh_cannot_change_role(self, mock_update):
        response = self.client_rh.patch(
            f'/api/v1/users/{self.employee.id}/role/', {'role': 'COMPTABLE'}, format='json',
        )
        self.assertEqual(response.status_code, 403)
        mock_update.assert_not_called()

    def test_user_without_firebase_account_rejected(self):
        no_firebase_user = User.objects.create(email='no-firebase@sokensdigital.com', first_name='NoFirebase')
        response = self.client_super_admin.patch(
            f'/api/v1/users/{no_firebase_user.id}/role/', {'role': 'COMPTABLE'}, format='json',
        )
        self.assertEqual(response.status_code, 400)


class DepartmentViewSetTests(APITestCase):
    def setUp(self):
        self.super_admin = User.objects.create(email='super@sokensdigital.com', first_name='Super')
        self.super_admin.firestore_role = 'SUPER_ADMIN'

        self.client_super_admin = APIClient()
        self.client_super_admin.force_authenticate(user=self.super_admin)

    @patch('core.views.upsert_chat_room')
    def test_create_pushes_firestore_chat_room(self, mock_upsert):
        response = self.client_super_admin.post('/api/v1/departments/', {'name': 'Technique'}, format='json')
        self.assertEqual(response.status_code, 201)
        department_id = response.json()['id']
        mock_upsert.assert_called_once_with(f'dept-{department_id}', {
            'name': 'Salon Technique',
            'roomType': 'DEPARTMENT',
            'departmentId': department_id,
        })


class AuditLogViewSetTests(APITestCase):
    def setUp(self):
        self.super_admin = User.objects.create(email='super@sokensdigital.com', first_name='Super')
        self.super_admin.firestore_role = 'SUPER_ADMIN'

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        self.outsider.firestore_role = 'DEVELOPPEUR'

        Department.objects.create(name='À supprimer').delete(user=self.super_admin)

        self.client_super_admin = APIClient()
        self.client_super_admin.force_authenticate(user=self.super_admin)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def test_super_admin_can_list_audit_logs(self):
        response = self.client_super_admin.get('/api/v1/audit-logs/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], AuditLog.objects.count())
        self.assertGreaterEqual(AuditLog.objects.count(), 1)

    def test_outsider_forbidden(self):
        response = self.client_outsider.get('/api/v1/audit-logs/')
        self.assertEqual(response.status_code, 403)


class UserListViewTests(APITestCase):
    def setUp(self):
        User.objects.create(email='someone@sokensdigital.com', first_name='Someone')

        self.marketing_user = User.objects.create(email='marketing@sokensdigital.com', first_name='Marketing')
        self.marketing_user.firestore_role = 'RESPONSABLE_MARKETING'

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        self.outsider.firestore_role = 'DEVELOPPEUR'

    def test_marketing_can_list_users(self):
        client = APIClient()
        client.force_authenticate(user=self.marketing_user)
        response = client.get('/api/v1/users/')
        self.assertEqual(response.status_code, 200)

    def test_outsider_forbidden(self):
        client = APIClient()
        client.force_authenticate(user=self.outsider)
        response = client.get('/api/v1/users/')
        self.assertEqual(response.status_code, 403)


class GlobalSearchTests(APITestCase):
    def setUp(self):
        from marketing.models import Lead
        from projects.models import Project

        self.marketing_user = User.objects.create(email='searchmkt@sokensdigital.com', first_name='Marketing')
        self.marketing_user.firestore_role = 'RESPONSABLE_MARKETING'

        self.commercial_a = User.objects.create(email='searchcom-a@sokensdigital.com', first_name='CommercialA')
        self.commercial_a.firestore_role = 'COMMERCIAL'

        self.commercial_b = User.objects.create(email='searchcom-b@sokensdigital.com', first_name='CommercialB')
        self.commercial_b.firestore_role = 'COMMERCIAL'

        self.outsider = User.objects.create(email='searchdev@sokensdigital.com', first_name='Dev')
        self.outsider.firestore_role = 'DEVELOPPEUR'

        self.lead_a = Lead.objects.create(
            first_name='Zelda', last_name='Fitzgerald', email='zelda@example.com',
            source='SITE_WEB', assigned_to=self.commercial_a,
        )
        self.lead_b = Lead.objects.create(
            first_name='Zelig', last_name='Smith', email='zelig@example.com',
            source='SITE_WEB', assigned_to=self.commercial_b,
        )
        Project.objects.create(name='Zenith Cloud Migration', lead_project_manager=self.marketing_user)

        self.client_marketing = APIClient()
        self.client_marketing.force_authenticate(user=self.marketing_user)
        self.client_commercial_a = APIClient()
        self.client_commercial_a.force_authenticate(user=self.commercial_a)
        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def test_short_query_returns_empty(self):
        response = self.client_marketing.get('/api/v1/search/?q=z')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), [])

    def test_marketing_finds_both_leads(self):
        response = self.client_marketing.get('/api/v1/search/?q=Zel')
        labels = [r['label'] for r in response.json() if r['category'] == 'Leads']
        self.assertIn('Zelda Fitzgerald', labels)
        self.assertIn('Zelig Smith', labels)

    def test_commercial_only_finds_own_lead(self):
        response = self.client_commercial_a.get('/api/v1/search/?q=Zel')
        labels = [r['label'] for r in response.json() if r['category'] == 'Leads']
        self.assertIn('Zelda Fitzgerald', labels)
        self.assertNotIn('Zelig Smith', labels)

    def test_outsider_sees_no_lead_results_but_no_error(self):
        response = self.client_outsider.get('/api/v1/search/?q=Zel')
        self.assertEqual(response.status_code, 200)
        self.assertEqual([r for r in response.json() if r['category'] == 'Leads'], [])

    def test_project_search_visible_to_lead(self):
        response = self.client_marketing.get('/api/v1/search/?q=Zenith')
        labels = [r['label'] for r in response.json() if r['category'] == 'Projets']
        self.assertIn('Zenith Cloud Migration', labels)

    def test_project_search_not_visible_to_non_member(self):
        response = self.client_commercial_a.get('/api/v1/search/?q=Zenith')
        labels = [r['label'] for r in response.json() if r['category'] == 'Projets']
        self.assertNotIn('Zenith Cloud Migration', labels)
