import datetime
from decimal import Decimal
from io import BytesIO
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient, APITestCase

from core.constants import ROLE_COMPTABLE, ROLE_DEVELOPER, ROLE_DIRECTEUR_FINANCIER, ROLE_PROJECT_MANAGER, ROLE_SUPER_ADMIN
from core.models import Role, User
from finance.models import (
    Account,
    AccountingPeriod,
    BankStatementImport,
    BankTransaction,
    DisbursementRequest,
    Invoice,
    JournalEntry,
    Payment,
    TaxDeclaration,
    TransactionLine,
)
from projects.models import Project

SIG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='


def _give_role(user, name):
    role, _ = Role.objects.get_or_create(name=name)
    user.roles.add(role)
    return role


class DisbursementRequestViewSetTests(APITestCase):
    def setUp(self):
        _sig_patcher = patch('core.storage.upload_image', return_value='https://cdn.test/signature.png')
        _sig_patcher.start()
        self.addCleanup(_sig_patcher.stop)
        self.chef_a = User.objects.create(email='chef-a@sokensdigital.com', first_name='ChefA')
        _give_role(self.chef_a, ROLE_PROJECT_MANAGER)

        self.chef_b = User.objects.create(email='chef-b@sokensdigital.com', first_name='ChefB')
        _give_role(self.chef_b, ROLE_PROJECT_MANAGER)

        self.cfo = User.objects.create(email='cfo@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)

        self.outsider = User.objects.create(email='dev@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

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
        # Circuit fixe : toute demande commence par la RCF, quel que soit
        # le montant (process comptable, "Demande de décaissement").
        response = self.client_a.post('/api/v1/finance/disbursement-requests/', self.payload(), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['status'], 'EN_ATTENTE_RCF')

    def test_every_amount_routes_to_rcf_first(self):
        # Aucun seuil : une petite comme une grosse demande passe par la RCF.
        for amount in ('5000', '25000', '600000'):
            response = self.client_a.post(
                '/api/v1/finance/disbursement-requests/', self.payload(amount=amount), format='json',
            )
            self.assertEqual(response.json()['status'], 'EN_ATTENTE_RCF')

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

    def test_super_admin_sees_all_requests(self):
        """Regression: CanInitiateDisbursement.has_permission/get_queryset
        used to omit ROLE_SUPER_ADMIN entirely, 403'ing a Super-Admin on an
        endpoint whose own docstring promised them full access."""
        super_admin = User.objects.create(email='super@sokensdigital.com', first_name='Super')
        _give_role(super_admin, ROLE_SUPER_ADMIN)
        client = APIClient()
        client.force_authenticate(user=super_admin)

        DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000,
            beneficiary='X', reason='Y',
        )
        response = client.get('/api/v1/finance/disbursement-requests/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)

    def test_cfo_cannot_create_request(self):
        response = self.client_cfo.post('/api/v1/finance/disbursement-requests/', self.payload(), format='json')
        self.assertEqual(response.status_code, 403)

    def test_the_full_circuit_rcf_then_gerant_then_execution(self):
        self.comptable = User.objects.create(email='comptable@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        client_comptable = APIClient()
        client_comptable.force_authenticate(user=self.comptable)

        super_admin = User.objects.create(email='gerant@sokensdigital.com', first_name='Gerant')
        _give_role(super_admin, ROLE_SUPER_ADMIN)
        client_gerant = APIClient()
        client_gerant.force_authenticate(user=super_admin)

        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000, beneficiary='X', reason='Y',
        )

        # La RCF (Directeur Financier) examine d'abord : approuver transmet
        # au Gérant, ce n'est pas encore une approbation définitive.
        response = self.client_cfo.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE', 'signature': SIG}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'EN_ATTENTE_GERANT')

        # Le Gérant statue en dernier ressort.
        response = client_gerant.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE', 'signature': SIG}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'APPROUVE')

        response = client_comptable.post(f'/api/v1/finance/disbursement-requests/{disbursement.id}/execute/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'EXECUTE')

    def test_requester_cannot_approve_own_request_even_as_comptable(self):
        # Pentest du 24/09/2026 (F1) : quelqu'un qui cumule le rôle Chef de
        # Projet (demandeur) et Comptable (peut décider au palier RCF) ne
        # doit jamais pouvoir valider sa propre demande.
        chef_comptable = User.objects.create(email='chef-compta@sokensdigital.com', first_name='ChefCompta')
        _give_role(chef_comptable, ROLE_PROJECT_MANAGER)
        _give_role(chef_comptable, ROLE_COMPTABLE)
        client = APIClient()
        client.force_authenticate(user=chef_comptable)
        project = Project.objects.create(name='Auto-approbation', lead_project_manager=chef_comptable)

        disbursement = DisbursementRequest.objects.create(
            project=project, requested_by=chef_comptable, amount=1000, beneficiary='X', reason='Y',
        )
        response = client.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE', 'signature': SIG}, format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_chef_cannot_approve(self):
        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000, beneficiary='X', reason='Y',
        )
        response = self.client_a.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE', 'signature': SIG}, format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_cannot_execute_before_approval(self):
        self.comptable = User.objects.create(email='comptable2@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        client_comptable = APIClient()
        client_comptable.force_authenticate(user=self.comptable)

        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000, beneficiary='X', reason='Y',
        )
        response = client_comptable.post(f'/api/v1/finance/disbursement-requests/{disbursement.id}/execute/')
        self.assertEqual(response.status_code, 400)

    def test_approval_requires_signature_and_stores_it(self):
        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=5000, beneficiary='X', reason='Y',
            status=DisbursementRequest.Status.EN_ATTENTE_RCF,
        )
        url = f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/'
        self.assertEqual(self.client_cfo.post(url, {'decision': 'APPROUVE'}, format='json').status_code, 400)
        self.assertEqual(self.client_cfo.post(url, {'decision': 'APPROUVE', 'signature': 'pas-une-image'}, format='json').status_code, 400)
        res = self.client_cfo.post(url, {'decision': 'APPROUVE', 'signature': SIG}, format='json')
        self.assertEqual(res.status_code, 200)
        disbursement.refresh_from_db()
        self.assertEqual(disbursement.status, DisbursementRequest.Status.EN_ATTENTE_GERANT)
        self.assertEqual(disbursement.rcf_signature_url, 'https://cdn.test/signature.png')

    def test_besoin_takes_requester_department_and_department_scope(self):
        from core.models import Department
        dept = Department.objects.create(name='Marketing', color='#000000')
        self.outsider.department = dept
        self.outsider.save()
        colleague = User.objects.create(email='coll@sokensdigital.com', first_name='Coll', department=dept)
        res = self.client_outsider.post('/api/v1/finance/disbursement-requests/', {
            'beneficiary_user_id': str(self.outsider.id),
            'lines': [{'label': 'Flyers', 'quantity': '100', 'unit_price': '150'}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)
        besoin = DisbursementRequest.objects.get(pk=res.json()['id'])
        self.assertEqual(besoin.department, dept)
        coll_client = APIClient()
        coll_client.force_authenticate(user=colleague)
        rows = coll_client.get('/api/v1/finance/disbursement-requests/?scope=department').json()['results']
        self.assertEqual([r['id'] for r in rows], [str(besoin.id)])
        # Un autre département ne le voit pas.
        self.assertEqual(self.client_b.get('/api/v1/finance/disbursement-requests/?scope=department').json()['results'], [])

    def test_comptable_cannot_act_as_rcf(self):
        """1re validation réservée au Directeur financier (et Super-Admin)."""
        comptable = User.objects.create(email='comptable-rcf@sokensdigital.com', first_name='Comptable')
        _give_role(comptable, ROLE_COMPTABLE)
        client_comptable = APIClient()
        client_comptable.force_authenticate(user=comptable)

        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=5000, beneficiary='X', reason='Y',
            status=DisbursementRequest.Status.EN_ATTENTE_RCF,
        )
        response = client_comptable.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE', 'signature': SIG}, format='json',
        )
        self.assertEqual(response.status_code, 403)
        # La RCF ne décide pas seule : elle transmet au Gérant.
        disbursement.refresh_from_db()
        self.assertIsNone(disbursement.rcf_decided_by_id)

    def test_comptable_cannot_act_as_gerant(self):
        comptable = User.objects.create(email='comptable-gerant@sokensdigital.com', first_name='Comptable')
        _give_role(comptable, ROLE_COMPTABLE)
        client_comptable = APIClient()
        client_comptable.force_authenticate(user=comptable)

        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=25000, beneficiary='X', reason='Y',
            status=DisbursementRequest.Status.EN_ATTENTE_GERANT,
        )
        response = client_comptable.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE', 'signature': SIG}, format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_cfo_cannot_act_as_gerant(self):
        # Le Directeur Financier tient lieu de RCF, pas de Gérant : une
        # demande déjà transmise au Gérant ne lui revient pas.
        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=600000, beneficiary='X', reason='Y',
            status=DisbursementRequest.Status.EN_ATTENTE_GERANT,
        )
        response = self.client_cfo.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE', 'signature': SIG}, format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_super_admin_can_act_as_gerant(self):
        super_admin = User.objects.create(email='super-gerant@sokensdigital.com', first_name='Super')
        _give_role(super_admin, ROLE_SUPER_ADMIN)
        client_super = APIClient()
        client_super.force_authenticate(user=super_admin)

        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=600000, beneficiary='X', reason='Y',
            status=DisbursementRequest.Status.EN_ATTENTE_GERANT,
        )
        response = client_super.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE', 'signature': SIG}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'APPROUVE')
        disbursement.refresh_from_db()
        self.assertEqual(disbursement.decided_by_id, super_admin.id)

    def test_super_admin_can_also_act_as_rcf(self):
        # Le Super-Admin a tous les droits dans l'application : il peut
        # intervenir à n'importe quelle étape du circuit.
        super_admin = User.objects.create(email='super-rcf@sokensdigital.com', first_name='Super')
        _give_role(super_admin, ROLE_SUPER_ADMIN)
        client_super = APIClient()
        client_super.force_authenticate(user=super_admin)

        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=5000, beneficiary='X', reason='Y',
        )
        response = client_super.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'APPROUVE', 'signature': SIG}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'EN_ATTENTE_GERANT')

    def test_rcf_rejection_closes_the_request_without_reaching_gerant(self):
        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=5000, beneficiary='X', reason='Y',
        )
        response = self.client_cfo.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'REJETE', 'rejection_reason': 'Motif non justifié.'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'REJETE')

    def test_rejection_requires_reason(self):
        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000, beneficiary='X', reason='Y',
        )
        response = self.client_cfo.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'REJETE'}, format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_rejection_with_reason_succeeds(self):
        disbursement = DisbursementRequest.objects.create(
            project=self.project_a, requested_by=self.chef_a, amount=1000, beneficiary='X', reason='Y',
        )
        response = self.client_cfo.post(
            f'/api/v1/finance/disbursement-requests/{disbursement.id}/approve/',
            {'decision': 'REJETE', 'rejection_reason': 'Budget insuffisant.'}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'REJETE')
        self.assertEqual(response.json()['rejection_reason'], 'Budget insuffisant.')


class BesoinLinesQuotesPdfTests(APITestCase):
    """Formulaire « Exprimer un besoin » : lignes, référence, devis, PDF."""

    URL = '/api/v1/finance/disbursement-requests/'

    def setUp(self):
        _sig_patcher = patch('core.storage.upload_image', return_value='https://cdn.test/signature.png')
        _sig_patcher.start()
        self.addCleanup(_sig_patcher.stop)
        self.chef = User.objects.create(email='chef@sokensdigital.com', first_name='Awa', last_name='Diallo')
        _give_role(self.chef, ROLE_PROJECT_MANAGER)
        self.other_chef = User.objects.create(email='autre@sokensdigital.com', first_name='Autre')
        _give_role(self.other_chef, ROLE_PROJECT_MANAGER)
        self.cfo = User.objects.create(email='cfo@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)
        self.project = Project.objects.create(name='Projet A', lead_project_manager=self.chef)

        self.client_chef = APIClient()
        self.client_chef.force_authenticate(user=self.chef)
        self.client_other = APIClient()
        self.client_other.force_authenticate(user=self.other_chef)
        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)

    def test_member_can_attach_besoin_to_running_project(self):
        """Un besoin survient souvent après le lancement du projet : un membre
        de l'équipe d'un projet en cours peut le lui rattacher."""
        from projects.models import ProjectMember
        self.project.status = Project.Status.EN_COURS
        self.project.save()
        ProjectMember.objects.create(project=self.project, user=self.other_chef)
        res = self.client_other.post(self.URL, {
            'project_id': str(self.project.id), 'request_date': '2026-10-04',
            'beneficiary_user_id': str(self.other_chef.id),
            'lines': [{'label': 'Licence', 'quantity': '1', 'unit_price': '50000'}],
        }, format='json')
        self.assertEqual(res.status_code, 201, res.content)

    def test_outsider_and_cancelled_project_refused(self):
        payload = {
            'project_id': str(self.project.id), 'request_date': '2026-10-04',
            'beneficiary_user_id': str(self.other_chef.id),
            'lines': [{'label': 'Licence', 'quantity': '1', 'unit_price': '50000'}],
        }
        self.assertEqual(self.client_other.post(self.URL, payload, format='json').status_code, 403)
        self.project.status = Project.Status.ANNULE
        self.project.save()
        self.assertEqual(self.client_chef.post(self.URL, payload, format='json').status_code, 400)

    def create_with_lines(self, **overrides):
        data = {
            'project_id': str(self.project.id),
            'request_date': '2026-10-04',
            'beneficiary_user_id': str(self.chef.id),
            'lines': [
                {'label': 'Écran 27 pouces', 'quantity': '2', 'unit_price': '95000'},
                {'label': 'Câble HDMI', 'quantity': '3', 'unit_price': '2500'},
            ],
        }
        data.update(overrides)
        return self.client_chef.post(self.URL, data, format='json')

    def test_lines_set_amount_reason_beneficiary_and_reference(self):
        response = self.create_with_lines()
        self.assertEqual(response.status_code, 201, response.content)
        body = response.json()
        self.assertEqual(Decimal(body['amount']), Decimal('197500.00'))
        self.assertEqual(body['beneficiary'], 'Awa Diallo')
        self.assertEqual(body['reason'], 'Écran 27 pouces; Câble HDMI')
        self.assertEqual(body['reference'], 'BES-2026-0001')
        self.assertEqual(body['request_date'], '2026-10-04')
        self.assertEqual([line['total'] for line in body['lines']], ['190000.00', '7500.00'])

    def test_references_increment(self):
        self.create_with_lines()
        second = self.create_with_lines().json()
        self.assertEqual(second['reference'], 'BES-2026-0002')

    def test_needs_lines_or_amount(self):
        response = self.client_chef.post(self.URL, {'beneficiary': 'X'}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('lines', response.json())

    def test_invalid_line_rejected(self):
        response = self.create_with_lines(lines=[{'label': 'Écran', 'quantity': '0', 'unit_price': '1000'}])
        self.assertEqual(response.status_code, 400)

    def test_free_text_beneficiary_still_supported(self):
        response = self.create_with_lines(beneficiary_user_id=None, beneficiary='Fournisseur SA')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()['beneficiary'], 'Fournisseur SA')

    def test_list_reports_quote_count_without_urls(self):
        self.create_with_lines()
        row = self.client_chef.get(self.URL).json()['results'][0]
        self.assertEqual(row['quotes_count'], 0)
        self.assertNotIn('quotes', row)
        self.assertEqual(len(row['lines']), 2)

    @patch('finance.serializers.sign_private_path', return_value='https://signed.example/devis.pdf')
    @patch('finance.views.upload_disbursement_quote', return_value='besoins/x/devis.pdf')
    def test_requester_can_attach_and_remove_quotes(self, _upload, _sign):
        disbursement_id = self.create_with_lines().json()['id']
        upload = SimpleUploadedFile('devis.pdf', b'%PDF-1.4', content_type='application/pdf')
        response = self.client_chef.post(f'{self.URL}{disbursement_id}/quotes/', {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()['original_filename'], 'devis.pdf')

        detail = self.client_chef.get(f'{self.URL}{disbursement_id}/').json()
        self.assertEqual(detail['quotes'][0]['url'], 'https://signed.example/devis.pdf')

        quote_id = response.json()['id']
        response = self.client_chef.delete(f'{self.URL}{disbursement_id}/quotes/{quote_id}/')
        self.assertEqual(response.status_code, 204)

    @patch('finance.views.upload_disbursement_quote', return_value='besoins/x/devis.pdf')
    def test_quotes_locked_for_others_and_after_decision(self, _upload):
        disbursement_id = self.create_with_lines().json()['id']
        upload = SimpleUploadedFile('devis.pdf', b'%PDF-1.4', content_type='application/pdf')
        # Un autre chef ne voit même pas la demande.
        response = self.client_other.post(f'{self.URL}{disbursement_id}/quotes/', {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 404)

        DisbursementRequest.objects.filter(id=disbursement_id).update(status=DisbursementRequest.Status.APPROUVE)
        upload = SimpleUploadedFile('devis.pdf', b'%PDF-1.4', content_type='application/pdf')
        response = self.client_chef.post(f'{self.URL}{disbursement_id}/quotes/', {'file': upload}, format='multipart')
        self.assertEqual(response.status_code, 403)

    @patch('treasury.pdf.generate_disbursement_request_pdf', side_effect=lambda d: BytesIO(b'%PDF-1.4 test'))
    def test_pdf_inline_or_download(self, _generate):
        disbursement_id = self.create_with_lines().json()['id']
        response = self.client_cfo.get(f'{self.URL}{disbursement_id}/pdf/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response['Content-Type'], 'application/pdf')
        self.assertTrue(response['Content-Disposition'].startswith('inline'))

        response = self.client_cfo.get(f'{self.URL}{disbursement_id}/pdf/?download=1')
        self.assertTrue(response['Content-Disposition'].startswith('attachment'))
        self.assertIn('BES-2026-0001.pdf', response['Content-Disposition'])

    @patch('treasury.pdf.generate_disbursement_request_pdf', side_effect=ImportError('no weasyprint'))
    def test_pdf_unavailable_returns_503(self, _generate):
        disbursement_id = self.create_with_lines().json()['id']
        response = self.client_cfo.get(f'{self.URL}{disbursement_id}/pdf/')
        self.assertEqual(response.status_code, 503)

    def test_pdf_template_renders_lines(self):
        from django.template.loader import render_to_string
        disbursement = DisbursementRequest.objects.get(id=self.create_with_lines().json()['id'])
        html = render_to_string('treasury/disbursement_request_pdf.html', {
            'disbursement': disbursement, 'company_address': 'Dakar', 'now': disbursement.created_at,
        })
        self.assertIn('BES-2026-0001', html)
        self.assertIn('Écran 27 pouces', html)
        self.assertIn('Câble HDMI', html)


class AccountingPeriodViewSetTests(APITestCase):
    def setUp(self):
        self.cfo = User.objects.create(email='cfo2@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)
        self.comptable = User.objects.create(email='comptable3@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)

        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)
        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)

    def test_cfo_can_create_and_close_period(self):
        response = self.client_cfo.post('/api/v1/finance/accounting-periods/', {
            'label': '2026-07', 'start_date': '2026-07-01', 'end_date': '2026-07-31',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        period_id = response.json()['id']

        response = self.client_cfo.post(f'/api/v1/finance/accounting-periods/{period_id}/close/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'CLOTUREE')

    def test_comptable_cannot_create_period(self):
        response = self.client_comptable.post('/api/v1/finance/accounting-periods/', {
            'label': '2026-08', 'start_date': '2026-08-01', 'end_date': '2026-08-31',
        }, format='json')
        self.assertEqual(response.status_code, 403)

    def test_comptable_can_read_periods(self):
        AccountingPeriod.objects.create(label='2026-06', start_date='2026-06-01', end_date='2026-06-30')
        response = self.client_comptable.get('/api/v1/finance/accounting-periods/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['count'], 1)


class JournalEntryViewSetTests(APITestCase):
    def setUp(self):
        self.comptable = User.objects.create(email='comptable4@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        self.outsider = User.objects.create(email='dev2@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)
        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

        self.period = AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')
        self.closed_period = AccountingPeriod.objects.create(
            label='2026-06', start_date='2026-06-01', end_date='2026-06-30',
            status=AccountingPeriod.Status.CLOTUREE,
        )
        self.bank = Account.objects.create(code='512', name='Banque', account_class=Account.AccountClass.ACTIF)
        self.sales = Account.objects.create(code='706', name='Prestations', account_class=Account.AccountClass.PRODUIT)

    def payload(self, period_id):
        return {
            'period': str(period_id), 'journal_code': 'VE', 'date': '2026-07-10', 'label': 'Vente',
            'lines': [
                {'account': str(self.bank.id), 'debit': '1000', 'credit': '0'},
                {'account': str(self.sales.id), 'debit': '0', 'credit': '1000'},
            ],
        }

    def test_comptable_can_post_balanced_entry(self):
        response = self.client_comptable.post('/api/v1/finance/journal-entries/', self.payload(self.period.id), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()['lines']), 2)

    def test_unbalanced_entry_rejected(self):
        data = self.payload(self.period.id)
        data['lines'][1]['credit'] = '900'
        response = self.client_comptable.post('/api/v1/finance/journal-entries/', data, format='json')
        self.assertEqual(response.status_code, 400)

    def test_closed_period_rejects_new_entry(self):
        response = self.client_comptable.post(
            '/api/v1/finance/journal-entries/', self.payload(self.closed_period.id), format='json',
        )
        self.assertEqual(response.status_code, 400)

    def test_outsider_forbidden(self):
        response = self.client_outsider.post('/api/v1/finance/journal-entries/', self.payload(self.period.id), format='json')
        self.assertEqual(response.status_code, 403)


class InvoiceViewSetTests(APITestCase):
    def setUp(self):
        self.comptable = User.objects.create(email='comptable5@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)

        self.period = AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')

    def test_create_invoice_computes_ttc(self):
        response = self.client_comptable.post('/api/v1/finance/invoices/', {
            'client_name': 'Acme SARL', 'issue_date': '2026-07-15', 'amount_ht': '1000', 'vat_rate': '0.18',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Decimal(response.json()['amount_ttc']), Decimal('1180.00'))
        self.assertEqual(response.json()['status'], 'BROUILLON')

    def test_negative_vat_rate_is_refused(self):
        # Pentest du 24/09/2026 (F2) : un taux négatif faisait ressortir un
        # TTC très inférieur au HT (1 000 000 HT -> 10 000 TTC avec -0.99),
        # sous-facturant le client et faussant la TVA collectée.
        response = self.client_comptable.post('/api/v1/finance/invoices/', {
            'client_name': 'Acme SARL', 'issue_date': '2026-07-15', 'amount_ht': '1000000', 'vat_rate': '-0.99',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_vat_rate_over_one_is_refused(self):
        response = self.client_comptable.post('/api/v1/finance/invoices/', {
            'client_name': 'Acme SARL', 'issue_date': '2026-07-15', 'amount_ht': '1000', 'vat_rate': '1.5',
        }, format='json')
        self.assertEqual(response.status_code, 400)

    def test_validate_posts_balanced_journal_entry(self):
        invoice = Invoice.objects.create(client_name='Acme SARL', issue_date=datetime.date(2026, 7, 15), amount_ht=Decimal('1000'))
        response = self.client_comptable.post(f'/api/v1/finance/invoices/{invoice.id}/validate/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'VALIDEE')

        entry = JournalEntry.objects.get(source_invoice=invoice)
        lines = list(entry.lines.all())
        total_debit = sum((line.debit for line in lines), Decimal('0'))
        total_credit = sum((line.credit for line in lines), Decimal('0'))
        self.assertEqual(total_debit, total_credit)

    def test_validate_without_open_period_rejected(self):
        self.period.status = AccountingPeriod.Status.CLOTUREE
        self.period.save(update_fields=['status'])
        invoice = Invoice.objects.create(client_name='Acme SARL', issue_date=datetime.date(2026, 7, 15), amount_ht=Decimal('1000'))
        response = self.client_comptable.post(f'/api/v1/finance/invoices/{invoice.id}/validate/')
        self.assertEqual(response.status_code, 400)


class BankReconciliationTests(APITestCase):
    def setUp(self):
        self.comptable = User.objects.create(email='comptable6@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)

        self.period = AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')
        self.bank_account = Account.objects.create(code='512', name='Banque', account_class=Account.AccountClass.ACTIF)
        self.sales_account = Account.objects.create(code='706', name='Prestations', account_class=Account.AccountClass.PRODUIT)
        entry = JournalEntry.objects.create(period=self.period, journal_code='VE', date='2026-07-10', label='Vente', created_by=self.comptable)
        self.line = TransactionLine.objects.create(entry=entry, account=self.bank_account, debit=Decimal('500'), credit=Decimal('0'))
        TransactionLine.objects.create(entry=entry, account=self.sales_account, debit=Decimal('0'), credit=Decimal('500'))

    def test_import_creates_transactions(self):
        response = self.client_comptable.post('/api/v1/finance/bank-imports/', {
            'filename': 'releve-juillet.csv',
            'rows': [{'date': '2026-07-11', 'label': 'Virement client', 'amount': '500'}],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(response.json()['transactions']), 1)

    def test_suggestions_finds_matching_amount_line(self):
        statement = BankStatementImport.objects.create(filename='r.csv', imported_by=self.comptable)
        transaction_row = BankTransaction.objects.create(statement_import=statement, date='2026-07-11', label='Virement', amount=Decimal('500'))
        response = self.client_comptable.get(f'/api/v1/finance/bank-imports/{statement.id}/transactions/{transaction_row.id}/suggestions/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.json()), 1)
        self.assertEqual(response.json()[0]['id'], str(self.line.id))

    def test_match_marks_transaction_lettre(self):
        statement = BankStatementImport.objects.create(filename='r.csv', imported_by=self.comptable)
        transaction_row = BankTransaction.objects.create(statement_import=statement, date='2026-07-11', label='Virement', amount=Decimal('500'))
        response = self.client_comptable.post(
            f'/api/v1/finance/bank-imports/{statement.id}/transactions/{transaction_row.id}/match/',
            {'line_id': str(self.line.id)}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'LETTRE')
        self.line.refresh_from_db()
        self.assertTrue(self.line.lettrage_code)


class TaxDeclarationViewSetTests(APITestCase):
    def setUp(self):
        self.cfo = User.objects.create(email='cfo3@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)
        self.comptable = User.objects.create(email='comptable7@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)

        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)
        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)

        self.period = AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')
        vat_collected_account = Account.objects.create(code='4457', name='TVA collectée', account_class=Account.AccountClass.TVA)
        vat_deductible_account = Account.objects.create(code='4456', name='TVA déductible', account_class=Account.AccountClass.TVA)
        entry = JournalEntry.objects.create(period=self.period, journal_code='OD', date='2026-07-10', label='TVA', created_by=self.comptable)
        TransactionLine.objects.create(entry=entry, account=vat_collected_account, debit=Decimal('0'), credit=Decimal('180'))
        TransactionLine.objects.create(entry=entry, account=vat_deductible_account, debit=Decimal('50'), credit=Decimal('0'))

    def test_comptable_can_generate_declaration(self):
        response = self.client_comptable.post('/api/v1/finance/tax-declarations/generate/', {'period_id': str(self.period.id)}, format='json')
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(Decimal(body['collected_vat']), Decimal('180'))
        self.assertEqual(Decimal(body['deductible_vat']), Decimal('50'))
        self.assertEqual(Decimal(body['net_vat']), Decimal('130'))
        self.assertEqual(body['status'], 'BROUILLON')

    def test_only_cfo_can_validate_declaration(self):
        declaration = TaxDeclaration.objects.create(period=self.period, collected_vat=180, deductible_vat=50, net_vat=130)

        response = self.client_comptable.post(f'/api/v1/finance/tax-declarations/{declaration.id}/validate/')
        self.assertEqual(response.status_code, 403)

        response = self.client_cfo.post(f'/api/v1/finance/tax-declarations/{declaration.id}/validate/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'VALIDEE')


class FecExportAndDashboardTests(APITestCase):
    def setUp(self):
        self.cfo = User.objects.create(email='cfo4@sokensdigital.com', first_name='CFO')
        _give_role(self.cfo, ROLE_DIRECTEUR_FINANCIER)
        self.comptable = User.objects.create(email='comptable8@sokensdigital.com', first_name='Comptable')
        _give_role(self.comptable, ROLE_COMPTABLE)
        self.outsider = User.objects.create(email='dev3@sokensdigital.com', first_name='Dev')
        _give_role(self.outsider, ROLE_DEVELOPER)

        self.client_cfo = APIClient()
        self.client_cfo.force_authenticate(user=self.cfo)
        self.client_comptable = APIClient()
        self.client_comptable.force_authenticate(user=self.comptable)
        self.client_outsider = APIClient()
        self.client_outsider.force_authenticate(user=self.outsider)

        self.period = AccountingPeriod.objects.create(label='2026-07', start_date='2026-07-01', end_date='2026-07-31')
        bank_account = Account.objects.create(code='512', name='Banque', account_class=Account.AccountClass.ACTIF)
        sales_account = Account.objects.create(code='706', name='Prestations', account_class=Account.AccountClass.PRODUIT)
        entry = JournalEntry.objects.create(period=self.period, journal_code='VE', date='2026-07-10', label='Vente', created_by=self.comptable)
        TransactionLine.objects.create(entry=entry, account=bank_account, debit=Decimal('1000'), credit=Decimal('0'))
        TransactionLine.objects.create(entry=entry, account=sales_account, debit=Decimal('0'), credit=Decimal('1000'))

    def test_fec_export_returns_text(self):
        response = self.client_comptable.get(f'/api/v1/finance/accounting-periods/{self.period.id}/fec-export/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('JournalCode', response.content.decode())
        self.assertIn('706', response.content.decode())

    def test_dashboard_computes_cash_balance(self):
        response = self.client_cfo.get('/api/v1/finance/dashboard/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Decimal(response.json()['cash_balance']), Decimal('1000'))

    def test_dashboard_forbidden_for_comptable(self):
        response = self.client_comptable.get('/api/v1/finance/dashboard/')
        self.assertEqual(response.status_code, 403)

    def test_dashboard_forbidden_for_outsider(self):
        response = self.client_outsider.get('/api/v1/finance/dashboard/')
        self.assertEqual(response.status_code, 403)


class PaymentAmountRulesTests(APITestCase):
    """Regles de montant sur les versements partiels.

    Le restant du pilote l'affichage client et le rapprochement comptable :
    s'il est faux, l'erreur se propage aux deux.
    """

    def setUp(self):
        self.cfo = User.objects.create(email='df-versements@sokens.test')
        self.cfo.roles.add(Role.objects.get_or_create(name=ROLE_DIRECTEUR_FINANCIER)[0])
        self.client.force_authenticate(user=self.cfo)

        # 1000 HT + TVA => amount_ttc calcule par le modele.
        self.invoice = Invoice.objects.create(
            client_name='Acme SARL',
            issue_date=datetime.date(2026, 7, 15),
            amount_ht=Decimal('1000'),
        )
        self.invoice.refresh_from_db()
        self.list_url = f'/api/v1/finance/invoices/{self.invoice.id}/payments/'

    def _create(self, amount):
        return self.client.post(self.list_url, {
            'amount': str(amount),
            'payment_date': '2026-07-20',
            'payment_method': 'VIREMENT',
        }, format='json')

    def _receive(self, payment_id):
        return self.client.post(
            f'{self.list_url}{payment_id}/receive/', {}, format='json',
        )

    def test_total_paid_does_not_double_count_the_current_payment(self):
        created = self._create(Decimal('100'))
        self.assertEqual(created.status_code, 201, created.data)
        received = self._receive(created.data['id'])
        self.assertEqual(received.status_code, 200, received.data)

        self.assertEqual(Decimal(received.data['total_paid']), Decimal('100'))
        self.assertEqual(
            Decimal(received.data['remaining']), self.invoice.amount_ttc - Decimal('100'),
        )

    def test_payment_above_remaining_is_refused(self):
        response = self._create(self.invoice.amount_ttc + Decimal('1'))

        self.assertEqual(response.status_code, 400)
        self.assertIn('amount', response.data)
        self.assertEqual(Payment.objects.count(), 0)

    def test_second_payment_cannot_exceed_what_is_left(self):
        first = self._create(Decimal('200'))
        self._receive(first.data['id'])

        response = self._create(self.invoice.amount_ttc)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Payment.objects.count(), 1)

    def test_payment_up_to_the_remaining_balance_is_accepted(self):
        first = self._create(Decimal('200'))
        self._receive(first.data['id'])

        response = self._create(self.invoice.amount_ttc - Decimal('200'))
        self.assertEqual(response.status_code, 201, response.data)

    def test_negative_amount_is_refused(self):
        response = self._create(Decimal('-50'))
        self.assertEqual(response.status_code, 400)
