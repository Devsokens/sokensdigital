"""Contrats de prestation de services (modèle de Soken's Digital)."""
from unittest.mock import patch

from rest_framework.test import APIClient, APITestCase

from core.constants import ROLE_DEVELOPER, ROLE_RESPONSABLE_ADMINISTRATIF
from core.models import Role, User
from marketing.contract_document import amount_in_words, contract_blocks, long_date
from marketing.contract_pdf import render_contract_html
from marketing.models import ContractSettings, ServiceContract

BASE = '/api/v1/marketing/contracts/'


def _user(email, role):
    user = User.objects.create(email=email, first_name=email.split('@')[0])
    user.roles.add(Role.objects.get_or_create(name=role)[0])
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class AmountInWordsTests(APITestCase):
    def test_french_spelling(self):
        self.assertEqual(amount_in_words(2500000), 'deux millions cinq cent mille')
        self.assertEqual(amount_in_words(180000), 'cent quatre-vingt mille')
        self.assertEqual(amount_in_words(80), 'quatre-vingts')
        self.assertEqual(amount_in_words(200000000), 'deux cents millions')
        self.assertEqual(amount_in_words(71), 'soixante et onze')
        self.assertEqual(amount_in_words(1000), 'mille')

    def test_long_date(self):
        self.assertEqual(long_date('2026-12-01'), '1er décembre 2026')


class ServiceContractTests(APITestCase):
    def setUp(self):
        self.rh = _user('rh@sokensdigital.com', ROLE_RESPONSABLE_ADMINISTRATIF)
        self.dev = _user('dev@sokensdigital.com', ROLE_DEVELOPER)

    def _create(self, **data):
        payload = {'client_name': 'ONG DDB', 'amount': '2500000', 'client_email': 'contact@ongddb.ga', **data}
        response = self.rh.post(BASE, payload, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        return response.json()

    def test_create_numbers_and_defaults(self):
        data = self._create()
        self.assertTrue(data['contract_number'].startswith('CTR-'))
        self.assertEqual(data['status'], 'BROUILLON')
        self.assertEqual(sum(t['percentage'] for t in data['payment_schedule']), 100)
        self.assertEqual(data['provider_signatory'], ContractSettings.load().provider_signatory)

    def test_developer_has_no_access(self):
        self.assertEqual(self.dev.get(BASE).status_code, 403)

    def test_schedule_must_total_100(self):
        response = self.rh.post(BASE, {'payment_schedule': [{'label': 'Signature', 'percentage': 40}]}, format='json')
        self.assertEqual(response.status_code, 400)

    def test_sent_contract_content_is_frozen(self):
        data = self._create()
        ServiceContract.objects.filter(pk=data['id']).update(status='ENVOYE')
        response = self.rh.patch(f"{BASE}{data['id']}/", {'amount': '10'}, format='json')
        self.assertEqual(response.status_code, 400)
        # Repasser en brouillon reste possible, puis la modification.
        self.assertEqual(self.rh.patch(f"{BASE}{data['id']}/", {'status': 'BROUILLON'}, format='json').status_code, 200)
        self.assertEqual(self.rh.patch(f"{BASE}{data['id']}/", {'amount': '10'}, format='json').status_code, 200)

    def test_document_text(self):
        contract = ServiceContract.objects.get(pk=self._create(duration='4 mois')['id'])
        html = render_contract_html(contract)
        self.assertIn('2 500 000 (deux millions cinq cent mille) francs CFA', html)
        self.assertIn('pour une durée de 4 mois', html)
        self.assertIn('ANNEXE 2', html)
        self.assertIn('500 000 FCFA', html)  # 20 % de l'échéancier
        self.assertIn('class="band"', html)

    def test_placeholders_and_options(self):
        settings_obj = ContractSettings.load()
        settings_obj.watermark = ContractSettings.Watermark.AUCUN
        settings_obj.save()
        contract = ServiceContract.objects.create(show_header=False)
        html = render_contract_html(contract)
        self.assertIn('[Dénomination sociale ou nom et prénom]', html)
        self.assertNotIn('class="band"', html)
        self.assertNotIn('class="wm"', html)

    def test_blocks_expenses_and_renewal(self):
        blocks = contract_blocks(
            {'expenses_covered': True, 'expenses_threshold': 100000, 'renewal': 'RENOUVELABLE', 'renewal_notice_days': 15},
            {'city': 'Libreville'},
        )
        text = ' '.join(b.get('text', '') for b in blocks)
        self.assertIn('sont pris en charge par le Client', text)
        self.assertIn('au plus tard 15 jours', text)

    @patch('core.mailer.send_mail', return_value=True)
    @patch('marketing.contract_pdf.build_contract_pdf', return_value=b'%PDF-1.4')
    def test_send_marks_sent_with_pdf(self, _pdf, send_mail):
        data = self._create()
        response = self.rh.post(f"{BASE}{data['id']}/send/", {'recipient_emails': ['a@b.ga']}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['status'], 'ENVOYE')
        attachment = send_mail.call_args.kwargs['attachments'][0]
        self.assertEqual(attachment.filename, f"Contrat-{data['contract_number']}.pdf")

    def test_settings_editable(self):
        response = self.rh.patch('/api/v1/marketing/contract-settings/', {'watermark': 'IMAGE', 'watermark_url': 'https://cdn.test/logo.png', 'watermark_opacity': 20}, format='json')
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()['watermark'], 'IMAGE')

    def test_editor_context(self):
        response = self.rh.get(f'{BASE}editor-context/')
        self.assertEqual(response.status_code, 200)
        self.assertIn('provider_identity', response.json()['settings'])


class PartnershipContractTests(APITestCase):
    def setUp(self):
        self.rh = _user('rh2@sokensdigital.com', ROLE_RESPONSABLE_ADMINISTRATIF)

    def test_partnership_has_its_own_model(self):
        response = self.rh.post(BASE, {
            'contract_type': 'PARTENARIAT', 'client_name': 'Fondation SMAG',
            'partnership_purpose': '- Former les jeunes au numérique', 'exclusivity': True,
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        self.assertIn('Le Partenaire souhaite', data['preamble'])
        html = render_contract_html(ServiceContract.objects.get(pk=data['id']))
        self.assertIn('CONTRAT DE PARTENARIAT', html)
        self.assertIn('Former les jeunes au numérique', html)
        self.assertIn('concurrent direct', html)
        self.assertIn('Pour le Partenaire', html)
        self.assertIn('Contrat de partenariat – Page', html)
        self.assertNotIn('francs CFA', html)

    def test_prestation_unchanged(self):
        contract = ServiceContract.objects.create(client_name='X')
        html = render_contract_html(contract)
        self.assertIn('CONTRAT DE PRESTATION DE SERVICES', html)
        self.assertIn('Pour le Prestataire', html)
