"""Désignation du gérant (User.is_gerant) : route réservée aux Super-Admins,
un seul gérant à la fois, visibilité limitée, droits au palier Gérant."""
from rest_framework.test import APIClient, APITestCase

from core.constants import ROLE_COMPTABLE, ROLE_DEVELOPER, ROLE_SUPER_ADMIN
from core.models import AuditLog, Role, User
from core.permissions import gerant_recipients, is_gerant


def _user(email, role=None):
    user = User.objects.create(email=email, first_name=email.split('@')[0])
    if role:
        user.roles.add(Role.objects.get_or_create(name=role)[0])
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class GerantTests(APITestCase):
    def setUp(self):
        self.admin = _user('admin@x.dev', ROLE_SUPER_ADMIN)
        self.compta = _user('compta@x.dev', ROLE_COMPTABLE)
        self.dev = _user('dev@x.dev', ROLE_DEVELOPER)

    def url(self, user):
        return f'/api/v1/users/{user.pk}/gerant/'

    def test_only_super_admin_can_designate(self):
        for user in (self.compta, self.dev):
            res = _client(user).post(self.url(self.compta), {'is_gerant': True}, format='json')
            self.assertEqual(res.status_code, 403)
        self.assertFalse(User.objects.filter(is_gerant=True).exists())
        self.assertEqual(APIClient().post(self.url(self.compta), {'is_gerant': True}, format='json').status_code, 401)

    def test_designation_is_unique_and_audited(self):
        client = _client(self.admin)
        self.assertEqual(client.post(self.url(self.compta), {'is_gerant': True}, format='json').status_code, 200)
        self.assertEqual(client.post(self.url(self.dev), {'is_gerant': True}, format='json').status_code, 200)
        self.assertEqual(list(User.objects.filter(is_gerant=True)), [self.dev])
        self.assertEqual(AuditLog.objects.filter(action='GERANT_DESIGNE').count(), 2)

    def test_rejects_non_boolean_and_inactive(self):
        client = _client(self.admin)
        self.assertEqual(client.post(self.url(self.dev), {'is_gerant': 'yes'}, format='json').status_code, 400)
        self.dev.is_active = False
        self.dev.save()
        self.assertEqual(client.post(self.url(self.dev), {'is_gerant': True}, format='json').status_code, 400)

    def test_gerant_rights_and_recipients(self):
        self.assertFalse(is_gerant(self.compta))
        self.assertTrue(is_gerant(self.admin))  # repli Super-Admin
        self.assertEqual(list(gerant_recipients()), [self.admin])
        self.compta.is_gerant = True
        self.compta.save()
        self.assertTrue(is_gerant(self.compta))
        self.assertEqual(list(gerant_recipients()), [self.compta])

    def test_flag_hidden_from_non_super_admin(self):
        self.compta.is_gerant = True
        self.compta.save()
        rows = _client(self.admin).get('/api/v1/users/').json()['results']
        self.assertTrue(any('is_gerant' in r for r in rows))
        res = _client(self.compta).get('/api/v1/users/')
        if res.status_code == 200:
            self.assertFalse(any('is_gerant' in r for r in res.json()['results']))
