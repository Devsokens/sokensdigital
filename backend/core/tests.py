from unittest.mock import MagicMock, patch

from rest_framework.test import APIClient, APITestCase

from core.models import Department, User


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
