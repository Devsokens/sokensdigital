from rest_framework.test import APIClient, APITestCase

from core.models import User
from finance.models import DisbursementRequest
from projects.models import Project


class DisbursementRequestViewSetTests(APITestCase):
    def setUp(self):
        self.chef_a = User.objects.create(email='chef-a@sokensdigital.com', first_name='ChefA')
        self.chef_a.firestore_role = 'CHEF_DE_PROJET'

        self.chef_b = User.objects.create(email='chef-b@sokensdigital.com', first_name='ChefB')
        self.chef_b.firestore_role = 'CHEF_DE_PROJET'

        self.cfo = User.objects.create(email='cfo@sokensdigital.com', first_name='CFO')
        self.cfo.firestore_role = 'DIRECTEUR_FINANCIER'

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        self.outsider.firestore_role = 'DEVELOPPEUR'

        self.project_a = Project.objects.create(name='Projet A', lead_project_manager=self.chef_a)
        self.project_b = Project.objects.create(name='Projet B', lead_project_manager=self.chef_b)

        self.client_a = APIClient()
        self.client_a.force_authenticate(user=self.chef_a)

        self.client_b = APIClient()
        self.client_b.force_authenticate(user=self.chef_b)

        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)

        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

    def payload(self, **overrides):
        data = {
            'project_id': str(self.project_a.id),
            'amount': '150000',
            'beneficiary': 'Fournisseur Cloud SA',
            'reason': "Renouvellement de l'hébergement.",
        }
        data.update(overrides)
        return data

    def test_chef_can_initiate_for_own_project(self):
        response = self.client_a.post('/api/v1/finance/disbursement-requests/', self.payload(), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['status'], 'EN_ATTENTE_N1')

    def test_chef_cannot_initiate_for_other_chefs_project(self):
        response = self.client_a.post(
            '/api/v1/finance/disbursement-requests/',
            self.payload(project_id=str(self.project_b.id)),
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_outsider_forbidden(self):
        response = self.client_outsider.post('/api/v1/finance/disbursement-requests/', self.payload(), format='json')
        self.assertEqual(response.status_code, 403)

    def test_negative_amount_rejected(self):
        response = self.client_a.post(
            '/api/v1/finance/disbursement-requests/', self.payload(amount='-100'), format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_chef_sees_only_own_project_requests(self):
        DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000,
            beneficiary='X', reason='Y',
        )
        DisbursementRequest.objects.create(
            project=self.project_b, requested_by=self.chef_b, amount=2000,
            beneficiary='X', reason='Y',
        )
        response = self.client_a.get('/api/v1/finance/disbursement-requests/')
        self.assertEqual(response.json()['count'], 1)

    def test_cfo_sees_all_requests(self):
        DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000,
            beneficiary='X', reason='Y',
        )
        DisbursementRequest.objects.create(
            project=self.project_b, requested_by=self.chef_b, amount=2000,
            beneficiary='X', reason='Y',
        )
        response = self.client_cfo.get('/api/v1/finance/disbursement-requests/')
        self.assertEqual(response.json()['count'], 2)

    def test_cfo_cannot_create_request(self):
        response = self.client_cfo.post('/api/v1/finance/disbursement-requests/', self.payload(), format='json')
        self.assertEqual(response.status_code, 403)
