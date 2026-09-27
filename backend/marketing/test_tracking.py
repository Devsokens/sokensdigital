"""Suivi public d'une demande, e-mail d'accusé, et notifications push."""

from unittest import mock
from unittest.mock import Mock, patch

from django.core import mail
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from marketing.models import Lead


def _lead(**overrides):
    data = {
        'first_name': 'Awa', 'last_name': 'Ndong', 'email': 'awa@client.test',
        'phone': '+241 06 11 22 33', 'company_name': 'Ndong SARL',
        'source': Lead.Source.FORMULAIRE_DEVIS,
    }
    data.update(overrides)
    return Lead.objects.create(**data)


class TrackingReferenceTests(APITestCase):
    def test_reference_and_token_are_generated_once(self):
        lead = _lead()
        self.assertRegex(lead.tracking_reference, r'^SKN-\d{4}-0*\d+$')
        self.assertTrue(lead.tracking_token)

        reference, token = lead.tracking_reference, lead.tracking_token
        lead.company_name = 'Autre'
        lead.save()
        lead.refresh_from_db()
        # La reference figure dans la boite mail du client : la reattribuer
        # rendrait sa copie inutilisable.
        self.assertEqual(lead.tracking_reference, reference)
        self.assertEqual(lead.tracking_token, token)

    def test_references_do_not_collide(self):
        references = {_lead(email=f'c{i}@client.test').tracking_reference for i in range(5)}
        self.assertEqual(len(references), 5)

    def test_counter_continues_after_a_deletion(self):
        first = _lead(email='a@client.test')
        second = _lead(email='b@client.test')
        second.delete()
        third = _lead(email='c@client.test')
        # Le compteur suit la derniere reference attribuee, pas le nombre de
        # lignes : sinon `third` reprendrait celle de `second`, deja envoyee.
        self.assertNotEqual(third.tracking_reference, first.tracking_reference)
        self.assertEqual(int(third.tracking_reference[-4:]), 3)


class PublicTrackingTests(APITestCase):
    def setUp(self):
        self.lead = _lead()
        self.url = reverse('public-tracking')

    def test_reference_and_email_return_the_status(self):
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': self.lead.email,
        }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['reference'], self.lead.tracking_reference)
        self.assertEqual(len(response.data['steps']), len(Lead.TRACKING_STEPS))

    def test_reference_is_matched_case_insensitively(self):
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference.lower(),
            'email': self.lead.email.upper(),
        }, format='json')
        self.assertEqual(response.status_code, 200)

    def test_reference_without_the_matching_email_is_refused(self):
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': 'inconnu@ailleurs.test',
        }, format='json')

        # Meme reponse qu'une reference inexistante : distinguer les deux
        # confirmerait l'existence de la demande a qui n'a pas l'adresse.
        self.assertEqual(response.status_code, 404)

    def test_no_internal_field_is_exposed(self):
        self.lead.qualification_score = 80
        self.lead.estimated_value = 5_000_000
        self.lead.save()

        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': self.lead.email,
        }, format='json')

        for leaked in ('qualification_score', 'estimated_value', 'assigned_to', 'status'):
            self.assertNotIn(leaked, response.data)

    def test_token_link_opens_the_status(self):
        response = self.client.get(
            reverse('public-tracking-token', kwargs={'token': self.lead.tracking_token}),
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['reference'], self.lead.tracking_reference)

    def test_unknown_token_is_refused(self):
        response = self.client.get(
            reverse('public-tracking-token', kwargs={'token': 'jeton-invente'}),
        )
        self.assertEqual(response.status_code, 404)

    def test_steps_advance_with_the_workflow_stage(self):
        # Décision du 13/09/2026 : les étapes publiques suivent workflow_stage
        # (ce que Marketing/Technique font vraiment avancer), plus `status`
        # (le pipeline commercial interne, indépendant).
        self.lead.workflow_stage = Lead.WorkflowStage.SOUMIS_CLIENT
        self.lead.save()
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': self.lead.email,
        }, format='json')

        statuses = [s['status'] for s in response.data['steps']]
        self.assertEqual(statuses[:3], ['done', 'done', 'done'])
        self.assertEqual(statuses[3], 'current')

    def test_workflow_stage_advances_independently_of_the_commercial_status(self):
        # Régression : avant ce changement, une demande pouvait avancer chez
        # Technique (workflow_stage) tout en restant affichée comme "Nouveau"
        # côté public pendant des semaines, parce que le suivi lisait `status`.
        self.lead.workflow_stage = Lead.WorkflowStage.CHEZ_TECHNIQUE
        self.lead.status = Lead.Status.NOUVEAU
        self.lead.save()
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': self.lead.email,
        }, format='json')

        self.assertEqual(response.data['state_label'], 'Analyse en cours')


class PublicLeadAttachmentUploadTests(APITestCase):
    """Bucket privé `demandes-projet` — voir docs/ROADMAP_TECHNIQUE.md."""

    def setUp(self):
        self.lead = _lead()
        self.url = reverse('public-lead-attachment')

        from core import storage
        storage._private_buckets_ensured.add(storage.PROJECT_REQUEST_BUCKET_NAME)
        self.addCleanup(storage._private_buckets_ensured.discard, storage.PROJECT_REQUEST_BUCKET_NAME)

    def pdf(self, size=100, name='cahier-des-charges.pdf'):
        return SimpleUploadedFile(name, b'%PDF-' + b'\x00' * size, content_type='application/pdf')

    def test_missing_reference_or_email_rejected(self):
        response = self.client.post(self.url, {'file': self.pdf()}, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_reference_without_matching_email_is_refused(self):
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': 'inconnu@ailleurs.test', 'file': self.pdf(),
        }, format='multipart')
        # Meme message que le suivi : ne pas confirmer l'existence de la
        # reference a qui n'a pas l'adresse associee.
        self.assertEqual(response.status_code, 404)

    def test_no_file_rejected(self):
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': self.lead.email,
        }, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_non_pdf_rejected(self):
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': self.lead.email,
            'file': SimpleUploadedFile('cahier.docx', b'\x00' * 100, content_type='application/msword'),
        }, format='multipart')
        self.assertEqual(response.status_code, 400)

    def test_oversized_file_rejected(self):
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': self.lead.email,
            'file': self.pdf(size=16 * 1024 * 1024),
        }, format='multipart')
        self.assertEqual(response.status_code, 400)

    @patch.dict('os.environ', {
        'SUPABASE_URL': 'https://test-project.supabase.co', 'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
    })
    @patch('core.storage._session.post')
    def test_successful_upload_is_attached_to_the_lead(self, mock_post):
        mock_post.side_effect = [
            Mock(status_code=200, text='{}'),
            Mock(status_code=200, json=lambda: {'signedURL': '/object/sign/demandes-projet/x.pdf?token=abc'}),
        ]
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': self.lead.email,
            'file': self.pdf(),
        }, format='multipart')

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['attachment_name'], 'cahier-des-charges.pdf')
        self.lead.refresh_from_db()
        self.assertTrue(
            self.lead.attachment_url.startswith(
                'https://test-project.supabase.co/storage/v1/object/sign/demandes-projet/',
            ),
        )
        self.assertEqual(self.lead.attachment_name, 'cahier-des-charges.pdf')

    @patch.dict('os.environ', {
        'SUPABASE_URL': 'https://test-project.supabase.co', 'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
    })
    @patch('core.storage._session.post')
    def test_retry_overwrites_the_previous_attachment(self, mock_post):
        self.lead.attachment_url = 'https://stale.example/old.pdf'
        self.lead.attachment_name = 'ancien.pdf'
        self.lead.save(update_fields=['attachment_url', 'attachment_name'])

        mock_post.side_effect = [
            Mock(status_code=200, text='{}'),
            Mock(status_code=200, json=lambda: {'signedURL': '/object/sign/demandes-projet/x.pdf?token=abc'}),
        ]
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': self.lead.email,
            'file': self.pdf(name='nouveau.pdf'),
        }, format='multipart')

        self.assertEqual(response.status_code, 201)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.attachment_name, 'nouveau.pdf')


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class LeadDocumentAcknowledgementTests(APITestCase):
    """Le cahier des charges arrive apres la creation de la demande : son
    accuse de reception est donc un second e-mail, distinct du premier."""

    def setUp(self):
        # Le quota anti-abus par IP vit dans le cache Django, partage par
        # tous les tests du process : sans purge, une classe qui poste
        # plusieurs fois epuise le budget des suivantes (429 au lieu de 201).
        cache.clear()
        self.lead = _lead()
        self.url = reverse('public-lead-attachment')
        mail.outbox.clear()

        from core import storage
        storage._private_buckets_ensured.add(storage.PROJECT_REQUEST_BUCKET_NAME)
        self.addCleanup(storage._private_buckets_ensured.discard, storage.PROJECT_REQUEST_BUCKET_NAME)

    def _upload(self, name='cahier-des-charges.pdf'):
        return self.client.post(self.url, {
            'reference': self.lead.tracking_reference,
            'email': self.lead.email,
            'file': SimpleUploadedFile(name, b'%PDF-' + b'\x00' * 100, content_type='application/pdf'),
        }, format='multipart')

    @patch.dict('os.environ', {
        'SUPABASE_URL': 'https://test-project.supabase.co', 'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
    })
    @patch('core.storage._session.post')
    def test_uploading_a_document_confirms_its_reception_by_email(self, mock_post):
        mock_post.side_effect = [
            Mock(status_code=200, text='{}'),
            Mock(status_code=200, json=lambda: {'signedURL': '/object/sign/demandes-projet/x.pdf?token=abc'}),
        ]
        response = self._upload()

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.lead.tracking_reference, mail.outbox[0].subject)
        self.assertIn('cahier-des-charges.pdf', mail.outbox[0].body)
        self.assertEqual(mail.outbox[0].to, [self.lead.email])

    @patch.dict('os.environ', {
        'SUPABASE_URL': 'https://test-project.supabase.co', 'SUPABASE_SERVICE_ROLE_KEY': 'test-key',
    })
    @patch('core.storage._session.post')
    def test_a_failing_confirmation_does_not_lose_the_document(self, mock_post):
        mock_post.side_effect = [
            Mock(status_code=200, text='{}'),
            Mock(status_code=200, json=lambda: {'signedURL': '/object/sign/demandes-projet/x.pdf?token=abc'}),
        ]
        with mock.patch('core.mailer.EmailMultiAlternatives.send', side_effect=RuntimeError('gmail down')):
            response = self._upload()

        self.assertEqual(response.status_code, 201)
        self.lead.refresh_from_db()
        self.assertTrue(self.lead.attachment_url)

    def test_no_confirmation_when_the_upload_is_refused(self):
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference,
            'email': self.lead.email,
            'file': SimpleUploadedFile('note.docx', b'\x00' * 50, content_type='application/msword'),
        }, format='multipart')

        self.assertEqual(response.status_code, 400)
        self.assertEqual(len(mail.outbox), 0)


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class LeadAcknowledgementTests(APITestCase):
    def setUp(self):
        # Meme raison que ci-dessus : chaque test de cette classe poste sur
        # /public/leads/, qui est limite par IP.
        cache.clear()

    def test_submitting_a_request_sends_the_reference(self):
        response = self.client.post('/api/v1/public/leads/', {
            'first_name': 'Awa', 'last_name': 'Ndong', 'email': 'awa@client.test',
            'phone': '+241 06 11 22 33', 'source': Lead.Source.FORMULAIRE_DEVIS,
        }, format='json')

        self.assertEqual(response.status_code, 201, response.data)
        reference = response.data['tracking_reference']
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(reference, mail.outbox[0].subject)
        self.assertIn(reference, mail.outbox[0].body)

    def test_the_acknowledgement_carries_an_html_part(self):
        self.client.post('/api/v1/public/leads/', {
            'first_name': 'Awa', 'last_name': 'Ndong', 'email': 'awa@client.test',
            'source': Lead.Source.FORMULAIRE_DEVIS,
        }, format='json')

        html = dict(mail.outbox[0].alternatives)
        self.assertTrue(any('text/html' == t for t in html.values()) or mail.outbox[0].alternatives)

    @patch('marketing.views.notify_roles')
    def test_a_failing_acknowledgement_alerts_the_team(self, mock_notify_roles):
        # Sans cette alerte, personne ne sait que le client n'a jamais recu
        # sa reference de suivi : la demande existe, lui ne peut pas la suivre.
        with mock.patch('core.mailer.EmailMultiAlternatives.send', side_effect=RuntimeError('gmail down')):
            response = self.client.post('/api/v1/public/leads/', {
                'first_name': 'Awa', 'last_name': 'Ndong', 'email': 'awa@client.test',
                'source': Lead.Source.FORMULAIRE_DEVIS,
            }, format='json')

        self.assertEqual(response.status_code, 201)
        mock_notify_roles.assert_called_once()
        message = mock_notify_roles.call_args.kwargs['message']
        self.assertIn('awa@client.test', message)

    @patch('marketing.views.notify_roles')
    def test_no_alert_when_the_acknowledgement_goes_out(self, mock_notify_roles):
        self.client.post('/api/v1/public/leads/', {
            'first_name': 'Awa', 'last_name': 'Ndong', 'email': 'awa@client.test',
            'source': Lead.Source.FORMULAIRE_DEVIS,
        }, format='json')
        mock_notify_roles.assert_not_called()

    def test_a_failing_email_does_not_lose_the_request(self):
        with mock.patch('core.mailer.EmailMultiAlternatives.send', side_effect=RuntimeError('smtp down')):
            response = self.client.post('/api/v1/public/leads/', {
                'first_name': 'Awa', 'last_name': 'Ndong', 'email': 'awa@client.test',
                'source': Lead.Source.FORMULAIRE_DEVIS,
            }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Lead.objects.filter(email='awa@client.test').exists())
