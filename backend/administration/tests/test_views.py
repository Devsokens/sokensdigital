from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from core.models import User, Role
from core.constants import ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_COMMERCIAL, ROLE_RH_MANAGER
from .factories import (
    ClientFactory, UserFactory, ClientDocumentFactory, ClientInteractionFactory,
    EmployeeDocumentFactory, LeaveRequestFactory, CompanyAssetFactory,
    AdministrativeRecordFactory, ContractGeneratorFactory
)

class ClientViewSetTest(APITestCase):
    def setUp(self):
        self.super_admin_role = Role.objects.create(name=ROLE_SUPER_ADMIN)
        self.admin_role = Role.objects.create(name=ROLE_ADMIN)
        self.super_admin = UserFactory()
        self.super_admin.roles.add(self.super_admin_role)
        self.admin_user = UserFactory()
        self.admin_user.roles.add(self.admin_role)
        self.client_model = ClientFactory()
        self.client.force_authenticate(user=self.super_admin)

    def test_delete_not_allowed(self):
        url = reverse('client-detail', kwargs={'pk': self.client_model.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

    def test_client_list_and_create(self):
        url = reverse('client-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        response = self.client.post(url, {
            'company_name': 'Acme Corp',
            'siret': '12345678901234',
            'status': 'PROSPECT'
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_archive_action(self):
        url = reverse('client-archive', kwargs={'pk': self.client_model.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

class ClientDocumentViewSetTest(APITestCase):
    def setUp(self):
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
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['file_type'], 'AUTRE_JURIDIQUE')

class AdditionalViewTests(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name=ROLE_ADMIN)
        self.rh_role = Role.objects.create(name=ROLE_RH_MANAGER)
        self.admin = UserFactory()
        self.admin.roles.add(self.admin_role)
        self.rh = UserFactory()
        self.rh.roles.add(self.rh_role)
        self.client_model = ClientFactory()

    def test_client_interactions(self):
        interaction = ClientInteractionFactory(client=self.client_model)
        self.client.force_authenticate(user=self.admin)
        url = reverse('client-interactions-list', kwargs={'client_pk': self.client_model.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_employee_documents(self):
        doc = EmployeeDocumentFactory(user=self.rh)
        self.client.force_authenticate(user=self.rh)
        url = reverse('employee-document-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_leave_requests_approve_reject(self):
        leave = LeaveRequestFactory(status='EN_ATTENTE')
        self.client.force_authenticate(user=self.admin)
        url_approve = reverse('leave-request-approve', kwargs={'pk': leave.pk})
        response = self.client.post(url_approve)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        leave.status = 'EN_ATTENTE'
        leave.save()
        url_reject = reverse('leave-request-reject', kwargs={'pk': leave.pk})
        response = self.client.post(url_reject)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_company_assets_assign(self):
        asset = CompanyAssetFactory()
        self.client.force_authenticate(user=self.admin)
        url = reverse('company-asset-assign', kwargs={'pk': asset.pk})
        response = self.client.post(url, {'user_id': str(self.admin.id)})
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_admin_records_finalize(self):
        record = AdministrativeRecordFactory()
        self.client.force_authenticate(user=self.admin)
        url = reverse('administrative-record-finalize', kwargs={'pk': record.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_contract_generator_pdf(self):
        contract = ContractGeneratorFactory(signing_status='BROUILLON')
        self.client.force_authenticate(user=self.admin)
        url = reverse('contract-generate-pdf', kwargs={'pk': contract.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_signature_webhook(self):
        contract = ContractGeneratorFactory(envelope_id='env-123')
        url = reverse('signature-webhook')
        response = self.client.post(url, {'envelope_id': 'env-123', 'status': 'completed'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
