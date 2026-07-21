from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from core.models import User
from django.contrib.auth.models import Group # Placeholder for Role if it's based on Group
from .factories import ClientFactory, UserFactory, ClientDocumentFactory

class ClientViewSetTest(APITestCase):
    def setUp(self):
        self.user = UserFactory()
        self.client.force_authenticate(user=self.user)

    def test_delete_not_allowed(self):
        client = ClientFactory()
        url = reverse('client-detail', kwargs={'pk': client.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

# Example role based test
# Since Role model implementation isn't provided, this is a conceptual test structure
class ClientDocumentViewSetTest(APITestCase):
    def setUp(self):
        self.admin_user = UserFactory()
        # assign superadmin role somehow
        
        self.normal_user = UserFactory()
        self.client_model = ClientFactory()
        self.doc_contrat = ClientDocumentFactory(client=self.client_model, file_type='CONTRAT')
        self.doc_autre = ClientDocumentFactory(client=self.client_model, file_type='AUTRE_JURIDIQUE')

    def test_hide_contrat_for_unauthorized(self):
        self.client.force_authenticate(user=self.normal_user)
        url = reverse('client-documents-list', kwargs={'client_pk': self.client_model.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        # Should only see 'AUTRE_JURIDIQUE'
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['file_type'], 'AUTRE_JURIDIQUE')

# Additional parametrized tests can be added here
