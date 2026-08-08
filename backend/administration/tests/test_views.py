import hashlib
import hmac

from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework import status
from django.urls import reverse
from core.models import User, Role
from core.constants import (
    ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_COMMERCIAL, ROLE_RH_MANAGER,
    ROLE_DIRECTEUR_FINANCIER,
)
from .factories import (
    ClientFactory, UserFactory, ContactFactory, ClientDocumentFactory, ClientInteractionFactory,
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

    @override_settings(SIGNATURE_WEBHOOK_SECRET='test-secret')
    def test_signature_webhook_valid_signature(self):
        contract = ContractGeneratorFactory(envelope_id='env-123')
        url = reverse('signature-webhook')
        import json
        body = json.dumps({'envelope_id': 'env-123', 'status': 'completed'}).encode()
        sig = hmac.new(b'test-secret', body, hashlib.sha256).hexdigest()
        response = self.client.post(
            url, data=body, content_type='application/json',
            HTTP_X_SIGNATURE=sig,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @override_settings(SIGNATURE_WEBHOOK_SECRET='test-secret')
    def test_signature_webhook_rejects_unsigned(self):
        contract = ContractGeneratorFactory(envelope_id='env-456')
        url = reverse('signature-webhook')
        response = self.client.post(
            url, {'envelope_id': 'env-456', 'status': 'completed'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_signature_webhook_unconfigured_returns_503(self):
        """Sans secret configuré, le webhook refuse plutôt que d'accepter en clair."""
        contract = ContractGeneratorFactory(envelope_id='env-789')
        url = reverse('signature-webhook')
        response = self.client.post(
            url, {'envelope_id': 'env-789', 'status': 'completed'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)


class ClientRBACTests(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name=ROLE_ADMIN)
        self.commercial_role = Role.objects.create(name=ROLE_COMMERCIAL)
        self.admin = UserFactory()
        self.admin.roles.add(self.admin_role)
        self.commercial = UserFactory()
        self.commercial.roles.add(self.commercial_role)
        self.other_commercial = UserFactory()
        self.other_commercial.roles.add(self.commercial_role)
        self.my_client = ClientFactory(assigned_to=self.commercial)
        self.other_client = ClientFactory(assigned_to=self.other_commercial)

    def test_commercial_create_forces_self_assigned(self):
        self.client.force_authenticate(user=self.commercial)
        url = reverse('client-list')
        response = self.client.post(url, {
            'company_name': 'New Co', 'siret': '99999999999999', 'status': 'PROSPECT',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(str(response.data['assigned_to']), str(self.commercial.id))

    def test_client_interaction_forbidden_on_inaccessible_client(self):
        """Un Commercial ne peut pas créer d'interaction sur le client d'un autre."""
        self.client.force_authenticate(user=self.commercial)
        url = reverse('client-interactions-list', kwargs={'client_pk': self.other_client.pk})
        response = self.client.post(url, {'interaction_type': 'CALL', 'subject': 'x', 'notes': 'x'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_document_commercial_devis_allowed(self):
        self.client.force_authenticate(user=self.commercial)
        url = reverse('client-documents-list', kwargs={'client_pk': self.my_client.pk})
        response = self.client.post(url, {
            'name': 'Devis 1', 'file_path': '/x', 'file_type': 'DEVIS',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_client_document_commercial_contrat_forbidden(self):
        self.client.force_authenticate(user=self.commercial)
        url = reverse('client-documents-list', kwargs={'client_pk': self.my_client.pk})
        response = self.client.post(url, {
            'name': 'Contrat 1', 'file_path': '/x', 'file_type': 'CONTRAT',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_document_plain_user_forbidden(self):
        plain = UserFactory()
        self.client.force_authenticate(user=plain)
        url = reverse('client-documents-list', kwargs={'client_pk': self.my_client.pk})
        response = self.client.post(url, {
            'name': 'Doc', 'file_path': '/x', 'file_type': 'DEVIS',
        })
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_client_document_name_encrypted_at_rest(self):
        """Le nom stocké n'est pas la chaîne en clair en base (colonne chiffrée)."""
        from django.db import connection
        from administration.models import ClientDocument
        self.client.force_authenticate(user=self.commercial)
        url = reverse('client-documents-list', kwargs={'client_pk': self.my_client.pk})
        response = self.client.post(url, {
            'name': 'Devis Secret', 'file_path': '/x', 'file_type': 'DEVIS',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        # Requête brute plutôt que l'ORM (qui déchiffrerait `name` via le
        # descripteur du champ) — pas de filtre sur id : sur SQLite un
        # UUIDField se stocke en hex sans tirets, différent de la
        # représentation str() renvoyée par l'API ; un seul document créé
        # dans ce test, donc pas d'ambiguïté à trier par le plus récent.
        table = ClientDocument._meta.db_table
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT name FROM {table} ORDER BY created_at DESC LIMIT 1")
            raw_name = cursor.fetchone()[0]
        self.assertNotEqual(raw_name, 'Devis Secret')


class ContactRBACTests(APITestCase):
    def setUp(self):
        self.commercial_role = Role.objects.create(name=ROLE_COMMERCIAL)
        self.commercial = UserFactory()
        self.commercial.roles.add(self.commercial_role)
        self.other_commercial = UserFactory()
        self.other_commercial.roles.add(self.commercial_role)
        self.my_client = ClientFactory(assigned_to=self.commercial)

    def test_contact_create_scoped_to_accessible_client(self):
        self.client.force_authenticate(user=self.commercial)
        url = reverse('client-contacts-list', kwargs={'client_pk': self.my_client.pk})
        response = self.client.post(url, {
            'first_name': 'Marie', 'last_name': 'Curie', 'email': 'm@c.com',
        })
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_contact_create_inaccessible_client_forbidden(self):
        other_client = ClientFactory(assigned_to=self.other_commercial)
        self.client.force_authenticate(user=self.commercial)
        url = reverse('client-contacts-list', kwargs={'client_pk': other_client.pk})
        response = self.client.post(url, {'first_name': 'Marie', 'last_name': 'Curie'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class PayrollValidationViewTests(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name=ROLE_ADMIN)
        self.admin = UserFactory()
        self.admin.roles.add(self.admin_role)
        self.plain = UserFactory()

    def test_non_admin_forbidden(self):
        self.client.force_authenticate(user=self.plain)
        url = reverse('payroll-validate')
        response = self.client.post(url, {'period_month': 1, 'period_year': 2026}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_missing_period_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('payroll-validate')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_admin_triggers_import_no_payslips(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('payroll-validate')
        response = self.client.post(url, {'period_month': 1, 'period_year': 2026}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['imported_count'], 0)
