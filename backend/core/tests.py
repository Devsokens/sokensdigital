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
