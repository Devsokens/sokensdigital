"""Proxy de lecture PostHog (core/analytics.py, core/analytics_views.py).

Aucun appel réel à PostHog : `core.analytics._session.post` est mocké. Ce
qui compte ici, c'est le cloisonnement par département, l'absence de fuite
de la clé API, et le comportement quand PostHog n'est pas configuré ou
tombe en panne.
"""

from unittest.mock import Mock, patch

from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from core.constants import (
    ROLE_COMMERCIAL, ROLE_COMPTABLE, ROLE_DEVELOPER, ROLE_RESPONSABLE_MARKETING, ROLE_SUPER_ADMIN,
)
from core.models import Role, User

POSTHOG_ENV = {
    'POSTHOG_PERSONAL_API_KEY': 'phx_secret_test_key',
    'POSTHOG_PROJECT_ID': '12345',
    'POSTHOG_API_HOST': 'https://eu.posthog.com',
}


def _user(email, role_name):
    user = User.objects.create(email=email, first_name='Test')
    role, _ = Role.objects.get_or_create(name=role_name)
    user.roles.add(role)
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _posthog_ok(rows=None):
    return Mock(status_code=200, json=lambda: {'results': rows if rows is not None else [[42]]})


class AnalyticsAccessTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.marketing = _user('mkt-analytics@sokensdigital.com', ROLE_RESPONSABLE_MARKETING)
        self.commercial = _user('com-analytics@sokensdigital.com', ROLE_COMMERCIAL)
        self.developer = _user('dev-analytics@sokensdigital.com', ROLE_DEVELOPER)
        self.accountant = _user('compta-analytics@sokensdigital.com', ROLE_COMPTABLE)
        self.super_admin = _user('super-analytics@sokensdigital.com', ROLE_SUPER_ADMIN)

    def test_unauthenticated_is_rejected(self):
        response = APIClient().get('/api/v1/analytics/marketing/')
        self.assertIn(response.status_code, (401, 403))

    @patch.dict('os.environ', POSTHOG_ENV)
    @patch('core.analytics._session.post')
    def test_marketing_roles_read_marketing_analytics(self, mock_post):
        mock_post.return_value = _posthog_ok()
        for client in (self.marketing, self.commercial, self.super_admin):
            self.assertEqual(client.get('/api/v1/analytics/marketing/').status_code, 200)

    def test_technical_role_cannot_read_marketing_analytics(self):
        self.assertEqual(self.developer.get('/api/v1/analytics/marketing/').status_code, 403)

    @patch.dict('os.environ', POSTHOG_ENV)
    @patch('core.analytics._session.post')
    def test_technique_roles_read_technique_analytics(self, mock_post):
        mock_post.return_value = _posthog_ok()
        for client in (self.developer, self.super_admin):
            self.assertEqual(client.get('/api/v1/analytics/technique/').status_code, 200)

    def test_marketing_role_cannot_read_technique_analytics(self):
        self.assertEqual(self.marketing.get('/api/v1/analytics/technique/').status_code, 403)

    def test_unrelated_department_reads_neither(self):
        self.assertEqual(self.accountant.get('/api/v1/analytics/marketing/').status_code, 403)
        self.assertEqual(self.accountant.get('/api/v1/analytics/technique/').status_code, 403)


class AnalyticsBehaviourTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client_mkt = _user('mkt-behaviour@sokensdigital.com', ROLE_RESPONSABLE_MARKETING)

    @patch.dict('os.environ', {'POSTHOG_PERSONAL_API_KEY': '', 'POSTHOG_PROJECT_ID': ''})
    def test_not_configured_is_explicit_not_an_error(self):
        response = self.client_mkt.get('/api/v1/analytics/marketing/')
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.json()['configured'])

    def test_invalid_period_rejected(self):
        response = self.client_mkt.get('/api/v1/analytics/marketing/?days=365')
        self.assertEqual(response.status_code, 400)

    @patch.dict('os.environ', POSTHOG_ENV)
    @patch('core.analytics._session.post')
    def test_posthog_outage_returns_503_without_leaking_details(self, mock_post):
        mock_post.return_value = Mock(status_code=500, text='internal query detail phx_secret_test_key')
        response = self.client_mkt.get('/api/v1/analytics/marketing/')
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('phx_secret_test_key', response.content.decode())

    @patch.dict('os.environ', POSTHOG_ENV)
    @patch('core.analytics._session.post')
    def test_api_key_is_sent_server_side_and_never_returned(self, mock_post):
        mock_post.return_value = _posthog_ok()
        response = self.client_mkt.get('/api/v1/analytics/marketing/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(mock_post.call_args.kwargs['headers']['Authorization'], 'Bearer phx_secret_test_key')
        self.assertNotIn('phx_secret_test_key', response.content.decode())

    @patch.dict('os.environ', POSTHOG_ENV)
    @patch('core.analytics._session.post')
    def test_results_are_cached_between_requests(self, mock_post):
        mock_post.return_value = _posthog_ok()
        self.client_mkt.get('/api/v1/analytics/marketing/')
        calls_after_first = mock_post.call_count
        self.client_mkt.get('/api/v1/analytics/marketing/')
        self.assertEqual(mock_post.call_count, calls_after_first)

    @patch.dict('os.environ', POSTHOG_ENV)
    @patch('core.analytics._session.post')
    def test_conversion_rate_computed_from_visitors_and_leads(self, mock_post):
        mock_post.return_value = _posthog_ok([[200]])
        data = self.client_mkt.get('/api/v1/analytics/marketing/').json()
        self.assertTrue(data['configured'])
        # Chaque scalaire vaut 200 dans ce mock : 200 demandes / 200 visiteurs.
        self.assertEqual(data['conversion_rate'], 100.0)
        self.assertEqual(len(data['funnel']), 4)
