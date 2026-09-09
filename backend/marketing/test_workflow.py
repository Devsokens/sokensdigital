"""Parcours d'une demande entre Marketing et Technique."""

from django.urls import reverse
from rest_framework.test import APITestCase

from core.constants import (
    ROLE_DEVELOPER,
    ROLE_PROJECT_MANAGER,
    ROLE_RESPONSABLE_MARKETING,
    ROLE_SUPER_ADMIN,
)
from core.models import Role, User
from marketing.models import Lead, Specification


def _user(email, role):
    user = User.objects.create(email=email)
    user.roles.add(Role.objects.get_or_create(name=role)[0])
    return user


class WorkflowTests(APITestCase):
    def setUp(self):
        self.marketing = _user('marketing@sokens.test', ROLE_RESPONSABLE_MARKETING)
        self.technique = _user('cdp@sokens.test', ROLE_PROJECT_MANAGER)
        self.dev = _user('dev@sokens.test', ROLE_DEVELOPER)
        self.superadmin = _user('boss@sokens.test', ROLE_SUPER_ADMIN)

        self.lead = Lead.objects.create(
            first_name='Awa', last_name='Ndong', company_name='Ndong SARL',
            email='awa@client.test', source=Lead.Source.FORMULAIRE_DEVIS,
        )
        self.url = reverse('lead-workflow', kwargs={'pk': self.lead.pk})

    def _act(self, user, action, **extra):
        self.client.force_authenticate(user=user)
        return self.client.post(self.url, {'action': action, **extra}, format='json')

    def _spec(self):
        return Specification.objects.create(
            spec_type=Specification.SpecType.TECHNIQUE, title='CDC Ndong SARL',
        )

    def test_a_public_request_starts_as_submitted(self):
        self.assertEqual(self.lead.workflow_stage, Lead.WorkflowStage.SOUMIS)

    def test_marketing_sends_it_to_technique(self):
        response = self._act(self.marketing, 'envoyer_technique')

        self.assertEqual(response.status_code, 200, response.data)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.workflow_stage, Lead.WorkflowStage.CHEZ_TECHNIQUE)

    def test_technique_cannot_send_it_to_itself(self):
        # Envoyer au technique appartient au marketing : c'est lui qui recoit
        # la demande venue du portail public.
        response = self._act(self.technique, 'envoyer_technique')
        self.assertEqual(response.status_code, 403)

    def test_technique_must_attach_a_specification(self):
        self._act(self.marketing, 'envoyer_technique')
        response = self._act(self.technique, 'joindre_cdc')

        # Sans cette exigence, Marketing atteindrait « cahier des charges
        # pret » sans rien a soumettre au client.
        self.assertEqual(response.status_code, 400)
        self.assertIn('specification_id', response.data)

    def test_technique_attaches_the_specification_and_hands_it_back(self):
        self._act(self.marketing, 'envoyer_technique')
        response = self._act(
            self.technique, 'joindre_cdc', specification_id=str(self._spec().pk),
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.workflow_stage, Lead.WorkflowStage.CDC_PRET)
        self.assertIsNotNone(self.lead.specification_id)

    def test_the_full_path_ends_in_development(self):
        self._act(self.marketing, 'envoyer_technique')
        self._act(self.technique, 'joindre_cdc', specification_id=str(self._spec().pk))
        self._act(self.marketing, 'soumettre_client')
        self._act(self.marketing, 'valider_client')
        response = self._act(self.technique, 'demarrer_developpement')

        self.assertEqual(response.status_code, 200, response.data)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.workflow_stage, Lead.WorkflowStage.EN_DEVELOPPEMENT)

    def test_marketing_cannot_start_development(self):
        self._act(self.marketing, 'envoyer_technique')
        self._act(self.technique, 'joindre_cdc', specification_id=str(self._spec().pk))
        self._act(self.marketing, 'soumettre_client')
        self._act(self.marketing, 'valider_client')

        response = self._act(self.marketing, 'demarrer_developpement')
        self.assertEqual(response.status_code, 403)

    def test_a_step_cannot_be_skipped(self):
        # Passer en developpement sans que le client ait valide.
        response = self._act(self.technique, 'demarrer_developpement')

        self.assertEqual(response.status_code, 400)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.workflow_stage, Lead.WorkflowStage.SOUMIS)

    def test_an_unknown_action_is_refused(self):
        response = self._act(self.marketing, 'tout_valider')
        self.assertEqual(response.status_code, 400)

    def test_marketing_can_send_it_back_to_technique(self):
        self._act(self.marketing, 'envoyer_technique')
        self._act(self.technique, 'joindre_cdc', specification_id=str(self._spec().pk))
        response = self._act(self.marketing, 'renvoyer_technique')

        self.assertEqual(response.status_code, 200, response.data)
        self.lead.refresh_from_db()
        self.assertEqual(self.lead.workflow_stage, Lead.WorkflowStage.CHEZ_TECHNIQUE)

    def test_the_super_admin_can_drive_every_step(self):
        steps = [
            ('envoyer_technique', {}),
            ('joindre_cdc', {}),
            ('soumettre_client', {}),
            ('valider_client', {}),
            ('demarrer_developpement', {}),
        ]
        for action, extra in steps:
            if action == 'joindre_cdc':
                extra = {'specification_id': str(self._spec().pk)}
            response = self._act(self.superadmin, action, **extra)
            self.assertEqual(response.status_code, 200, f'{action}: {response.data}')

        self.lead.refresh_from_db()
        self.assertEqual(self.lead.workflow_stage, Lead.WorkflowStage.EN_DEVELOPPEMENT)

    def test_available_actions_match_the_role(self):
        response = self._act(self.marketing, 'envoyer_technique')
        # Apres l'envoi la balle est au technique : proposer a Marketing un
        # bouton qui echouerait serait trompeur.
        self.assertEqual(response.data['available_actions'], [])

    def test_developers_see_the_technique_actions(self):
        self._act(self.marketing, 'envoyer_technique')
        self.client.force_authenticate(user=self.dev)
        response = self.client.get(reverse('submitted-projects'))

        self.assertEqual(response.status_code, 200)
        actions = [a['action'] for a in response.data[0]['available_actions']]
        self.assertIn('joindre_cdc', actions)


class SubmittedProjectListTests(APITestCase):
    def setUp(self):
        self.marketing = _user('m@sokens.test', ROLE_RESPONSABLE_MARKETING)
        self.outsider = User.objects.create(email='rien@sokens.test')
        Lead.objects.create(
            first_name='A', last_name='B', email='a@c.test',
            source=Lead.Source.SITE_WEB,
        )
        self.url = reverse('submitted-projects')

    def test_marketing_sees_submitted_requests(self):
        self.client.force_authenticate(user=self.marketing)
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_a_user_without_either_department_is_refused(self):
        self.client.force_authenticate(user=self.outsider)
        self.assertEqual(self.client.get(self.url).status_code, 403)

    def test_the_list_filters_by_stage(self):
        self.client.force_authenticate(user=self.marketing)
        response = self.client.get(self.url, {'stage': Lead.WorkflowStage.CHEZ_TECHNIQUE})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, [])
