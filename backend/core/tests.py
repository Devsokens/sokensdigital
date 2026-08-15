import io
from unittest.mock import MagicMock, patch

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APIClient, APITestCase

from core.models import AuditLog, Department, Role, User
from core.constants import (
    ROLE_SUPER_ADMIN, ROLE_RH_MANAGER, ROLE_DEVELOPER, ROLE_COMMERCIAL,
    ROLE_PROJECT_MANAGER, ROLE_RESPONSABLE_MARKETING, ROLE_COMPTABLE,
)


def _give_role(user, name):
    """Legacy tests set user.firestore_role (dynamic attribute, read by the
    old Firestore-backed auth flow). RBAC is Django-side now (user.roles,
    core.permissions.has_role) — this helper does the equivalent via a
    real Role row instead."""
    role, _ = Role.objects.get_or_create(name=name)
    user.roles.add(role)
    return role



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
        _give_role(self.rh_user, ROLE_RH_MANAGER)

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

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
            'avatarUrl': None,
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
        _give_role(super_admin, ROLE_SUPER_ADMIN)
        client = APIClient()
        client.force_authenticate(user=super_admin)

        response = client.post('/api/v1/users/provision/', self.payload(role='SUPER_ADMIN'), format='json')
        self.assertEqual(response.status_code, 201)

    @patch('core.views.create_profile')
    @patch('firebase_admin.auth.create_user')
    def test_provisioning_grants_the_matching_django_role(self, mock_create_user, mock_create_profile):
        """Regression test: has_role() checks user.roles (Django), not the
        Firestore profile — a provisioned account with no Django role gets
        403'd on every permission-gated endpoint despite Firestore saying
        it has one. See core.serializers.APP_ROLE_TO_DJANGO_ROLE."""
        mock_create_user.return_value = MagicMock(uid='firebase-uid-role-sync')

        response = self.client_rh.post(
            '/api/v1/users/provision/', self.payload(role='CHEF_DE_PROJET'), format='json',
        )

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(firebase_uid='firebase-uid-role-sync')
        self.assertEqual(list(user.roles.values_list('name', flat=True)), [ROLE_PROJECT_MANAGER])

    @patch('core.views.create_profile')
    @patch('firebase_admin.auth.create_user')
    def test_provisioning_with_autre_grants_no_django_role(self, mock_create_user, mock_create_profile):
        mock_create_user.return_value = MagicMock(uid='firebase-uid-autre')

        response = self.client_rh.post('/api/v1/users/provision/', self.payload(role='AUTRE'), format='json')

        self.assertEqual(response.status_code, 201)
        user = User.objects.get(firebase_uid='firebase-uid-autre')
        self.assertEqual(list(user.roles.values_list('name', flat=True)), [])


class SetUserRoleViewTests(APITestCase):
    def setUp(self):
        self.department = Department.objects.create(name='Finance', color='#22d3ee')
        self.super_admin = User.objects.create(email='super@sokensdigital.com', first_name='Super')
        _give_role(self.super_admin, ROLE_SUPER_ADMIN)

        self.rh_user = User.objects.create(email='rh@sokensdigital.com', first_name='RH')
        _give_role(self.rh_user, ROLE_RH_MANAGER)

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
        self.assertEqual(list(self.employee.roles.values_list('name', flat=True)), [ROLE_COMPTABLE])

    @patch('core.views.update_profile_fields')
    def test_changing_role_replaces_the_previous_django_role(self, mock_update):
        _give_role(self.employee, ROLE_DEVELOPER)
        self.client_super_admin.patch(
            f'/api/v1/users/{self.employee.id}/role/', {'role': 'COMPTABLE'}, format='json',
        )
        self.employee.refresh_from_db()
        self.assertEqual(list(self.employee.roles.values_list('name', flat=True)), [ROLE_COMPTABLE])

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
        _give_role(self.super_admin, ROLE_SUPER_ADMIN)

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

    def test_list_includes_member_count_and_preview(self):
        department = Department.objects.create(name='Technique', color='#22d3ee')
        member_a = User.objects.create(email='a@sokensdigital.com', first_name='Ada', last_name='A')
        member_a.department = department
        member_a.save(update_fields=['department'])
        member_b = User.objects.create(email='b@sokensdigital.com', first_name='Bob', last_name='B')
        member_b.department = department
        member_b.save(update_fields=['department'])

        response = self.client_super_admin.get('/api/v1/departments/')
        self.assertEqual(response.status_code, 200)
        row = next(r for r in response.json()['results'] if r['id'] == str(department.id))
        self.assertEqual(row['member_count'], 2)
        self.assertEqual(len(row['members']), 2)

    def test_cannot_delete_department_with_members(self):
        department = Department.objects.create(name='Technique', color='#22d3ee')
        member = User.objects.create(email='member@sokensdigital.com', first_name='Ada', department=department)

        response = self.client_super_admin.delete(f'/api/v1/departments/{department.id}/')

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Department.objects.filter(id=department.id).exists())
        member.refresh_from_db()
        self.assertEqual(member.department_id, department.id)

    def test_can_delete_department_without_members(self):
        department = Department.objects.create(name='Technique', color='#22d3ee')

        response = self.client_super_admin.delete(f'/api/v1/departments/{department.id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Department.objects.filter(id=department.id).exists())


class AuditLogViewSetTests(APITestCase):
    def setUp(self):
        self.super_admin = User.objects.create(email='super@sokensdigital.com', first_name='Super')
        _give_role(self.super_admin, ROLE_SUPER_ADMIN)

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

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
        _give_role(self.marketing_user, ROLE_RESPONSABLE_MARKETING)

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

    def test_marketing_can_list_users(self):
        client = APIClient()
        client.force_authenticate(user=self.marketing_user)
        response = client.get('/api/v1/users/')
        self.assertEqual(response.status_code, 200)

    def test_super_admin_can_list_users(self):
        super_admin = User.objects.create(email='super@sokensdigital.com', first_name='Super')
        _give_role(super_admin, ROLE_SUPER_ADMIN)
        client = APIClient()
        client.force_authenticate(user=super_admin)
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
        _give_role(self.marketing_user, ROLE_RESPONSABLE_MARKETING)

        self.commercial_a = User.objects.create(email='searchcom-a@sokensdigital.com', first_name='CommercialA')
        _give_role(self.commercial_a, ROLE_COMMERCIAL)

        self.commercial_b = User.objects.create(email='searchcom-b@sokensdigital.com', first_name='CommercialB')
        _give_role(self.commercial_b, ROLE_COMMERCIAL)

        self.outsider = User.objects.create(email='searchdev@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

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


class GetProfileRoleCacheTests(APITestCase):
    """get_profile_role() used to hit Firestore on every call (i.e. every
    authenticated request) — this is the fix: cache the result briefly so
    repeated calls for the same uid don't each pay a Firestore round-trip."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()

    def _mock_snapshot(self, exists, role=None):
        snapshot = MagicMock()
        snapshot.exists = exists
        snapshot.to_dict.return_value = {'role': role} if exists else None
        return snapshot

    def test_second_call_uses_cache_not_firestore(self):
        from core.firestore_client import get_profile_role

        with patch('core.firestore_client._get_client') as mock_get_client:
            mock_get_client.return_value.collection.return_value.document.return_value.get.return_value = (
                self._mock_snapshot(exists=True, role='COMMERCIAL')
            )
            first = get_profile_role('uid-1')
            second = get_profile_role('uid-1')

        self.assertEqual(first, 'COMMERCIAL')
        self.assertEqual(second, 'COMMERCIAL')
        mock_get_client.return_value.collection.return_value.document.return_value.get.assert_called_once()

    def test_no_role_is_cached_too_not_just_a_miss(self):
        from core.firestore_client import get_profile_role

        with patch('core.firestore_client._get_client') as mock_get_client:
            mock_get_client.return_value.collection.return_value.document.return_value.get.return_value = (
                self._mock_snapshot(exists=False)
            )
            first = get_profile_role('uid-2')
            second = get_profile_role('uid-2')

        self.assertIsNone(first)
        self.assertIsNone(second)
        mock_get_client.return_value.collection.return_value.document.return_value.get.assert_called_once()

    def test_invalidate_forces_a_fresh_fetch(self):
        from core.firestore_client import get_profile_role, invalidate_role_cache

        with patch('core.firestore_client._get_client') as mock_get_client:
            mock_get_client.return_value.collection.return_value.document.return_value.get.side_effect = [
                self._mock_snapshot(exists=True, role='COMMERCIAL'),
                self._mock_snapshot(exists=True, role='RESPONSABLE_MARKETING'),
            ]
            first = get_profile_role('uid-3')
            invalidate_role_cache('uid-3')
            second = get_profile_role('uid-3')

        self.assertEqual(first, 'COMMERCIAL')
        self.assertEqual(second, 'RESPONSABLE_MARKETING')

    def test_cache_backend_error_falls_back_to_firestore(self):
        from core.firestore_client import get_profile_role

        with patch('core.firestore_client.cache.get', side_effect=ConnectionError('cache down')), \
             patch('core.firestore_client.cache.set', side_effect=ConnectionError('cache down')), \
             patch('core.firestore_client._get_client') as mock_get_client:
            mock_get_client.return_value.collection.return_value.document.return_value.get.return_value = (
                self._mock_snapshot(exists=True, role='COMMERCIAL')
            )
            role = get_profile_role('uid-4')

        self.assertEqual(role, 'COMMERCIAL')


class AvatarUploadViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create(email='avatar@sokensdigital.com', first_name='Ada')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def image_file(self, size=None):
        if size is not None:
            content = b'\x00' * size
        else:
            buffer = io.BytesIO()
            Image.new('RGB', (10, 10), color='blue').save(buffer, format='PNG')
            content = buffer.getvalue()
        return SimpleUploadedFile('avatar.png', content, content_type='image/png')

    def test_unauthenticated_request_is_rejected(self):
        response = APIClient().post('/api/v1/uploads/avatar/', {'file': self.image_file()}, format='multipart')
        self.assertEqual(response.status_code, 401)

    def test_no_file_rejected(self):
        response = self.client.post('/api/v1/uploads/avatar/', {}, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_oversized_file_rejected(self):
        response = self.client.post(
            '/api/v1/uploads/avatar/', {'file': self.image_file(size=6 * 1024 * 1024)}, format='multipart',
        )
        self.assertEqual(response.status_code, 400)

    @patch.dict('os.environ', {
        'CLOUDINARY_CLOUD_NAME': 'test-cloud', 'CLOUDINARY_API_KEY': 'test-key', 'CLOUDINARY_API_SECRET': 'test-secret',
    })
    @patch('core.storage.cloudinary.uploader.upload')
    def test_authenticated_user_can_upload_avatar(self, mock_upload):
        mock_upload.return_value = {'secure_url': 'https://res.cloudinary.com/test-cloud/image/upload/v1/avatars/abc.jpg'}
        response = self.client.post('/api/v1/uploads/avatar/', {'file': self.image_file()}, format='multipart')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['url'], 'https://res.cloudinary.com/test-cloud/image/upload/v1/avatars/abc.jpg')
        self.assertEqual(mock_upload.call_args.kwargs['folder'], 'avatars')


class ChatAttachmentUploadViewTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create(email='attach@sokensdigital.com', first_name='Ada')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def any_file(self, size=100, content_type='application/pdf', name='doc.pdf'):
        return SimpleUploadedFile(name, b'\x00' * size, content_type=content_type)

    def test_unauthenticated_request_is_rejected(self):
        response = APIClient().post('/api/v1/uploads/chat-attachment/', {'file': self.any_file()}, format='multipart')
        self.assertEqual(response.status_code, 401)

    def test_no_file_rejected(self):
        response = self.client.post('/api/v1/uploads/chat-attachment/', {}, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_oversized_file_rejected(self):
        response = self.client.post(
            '/api/v1/uploads/chat-attachment/', {'file': self.any_file(size=21 * 1024 * 1024)}, format='multipart',
        )
        self.assertEqual(response.status_code, 400)

    @patch.dict('os.environ', {
        'CLOUDINARY_CLOUD_NAME': 'test-cloud', 'CLOUDINARY_API_KEY': 'test-key', 'CLOUDINARY_API_SECRET': 'test-secret',
    })
    @patch('core.storage.cloudinary.uploader.upload')
    def test_authenticated_user_can_upload_any_file_type(self, mock_upload):
        mock_upload.return_value = {'secure_url': 'https://res.cloudinary.com/test-cloud/raw/upload/v1/chat-attachments/abc.pdf'}
        response = self.client.post('/api/v1/uploads/chat-attachment/', {'file': self.any_file()}, format='multipart')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['url'], 'https://res.cloudinary.com/test-cloud/raw/upload/v1/chat-attachments/abc.pdf')
        self.assertEqual(mock_upload.call_args.kwargs['folder'], 'chat-attachments')


class RoleViewSetTests(APITestCase):
    def setUp(self):
        self.super_admin = User.objects.create(email='super-role@sokensdigital.com', first_name='Super')
        _give_role(self.super_admin, ROLE_SUPER_ADMIN)
        self.outsider = User.objects.create(email='dev-role@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.client_super_admin = APIClient()
        self.client_super_admin.force_authenticate(user=self.super_admin)
        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def test_super_admin_can_list_roles(self):
        response = self.client_super_admin.get('/api/v1/roles/')
        self.assertEqual(response.status_code, 200)
        names = [r['name'] for r in response.json()['results']]
        self.assertIn('Développeur', names)

    def test_outsider_forbidden(self):
        response = self.client_outsider.get('/api/v1/roles/')
        self.assertEqual(response.status_code, 403)

    def test_super_admin_can_update_permissions(self):
        role = Role.objects.get(name='Développeur')
        response = self.client_super_admin.patch(
            f'/api/v1/roles/{role.id}/', {'permissions': {'projets': ['voir']}}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        role.refresh_from_db()
        self.assertEqual(role.permissions, {'projets': ['voir']})

    def test_invalid_permissions_shape_rejected(self):
        role = Role.objects.get(name='Développeur')
        response = self.client_super_admin.patch(
            f'/api/v1/roles/{role.id}/', {'permissions': {'projets': 'voir'}}, format='json',
        )
        self.assertEqual(response.status_code, 400)
