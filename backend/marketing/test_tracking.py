"""Suivi public d'une demande, e-mail d'accusé, et notifications push."""

from unittest import mock

from django.core import mail
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

    def test_steps_advance_with_the_status(self):
        self.lead.status = Lead.Status.PROPOSITION_EN_COURS
        self.lead.save()
        response = self.client.post(self.url, {
            'reference': self.lead.tracking_reference, 'email': self.lead.email,
        }, format='json')

        statuses = [s['status'] for s in response.data['steps']]
        self.assertEqual(statuses[:3], ['done', 'done', 'done'])
        self.assertEqual(statuses[3], 'current')


@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class LeadAcknowledgementTests(APITestCase):
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

    def test_a_failing_email_does_not_lose_the_request(self):
        with mock.patch('core.mailer.EmailMultiAlternatives.send', side_effect=RuntimeError('smtp down')):
            response = self.client.post('/api/v1/public/leads/', {
                'first_name': 'Awa', 'last_name': 'Ndong', 'email': 'awa@client.test',
                'source': Lead.Source.FORMULAIRE_DEVIS,
            }, format='json')

        self.assertEqual(response.status_code, 201)
        self.assertTrue(Lead.objects.filter(email='awa@client.test').exists())
