from rest_framework import status
from rest_framework.test import APITestCase

from administration.models import Client, Contact
from core.constants import ROLE_COMMERCIAL, ROLE_SUPER_ADMIN
from core.models import Role
from marketing.models import Lead

from .factories import ClientFactory, UserFactory

LEADS_URL = '/api/v1/marketing/leads/'
CLIENTS_URL = '/api/administration/clients/'
CONTACTS_URL = '/api/administration/contacts/'


def _user_with_role(name):
    role, _ = Role.objects.get_or_create(name=name)
    user = UserFactory()
    user.roles.add(role)
    return user


class LeadClientConversionTests(APITestCase):
    def setUp(self):
        self.admin = _user_with_role(ROLE_SUPER_ADMIN)
        self.client.force_authenticate(user=self.admin)

    def _create_lead(self, **overrides):
        payload = {
            'first_name': 'Awa', 'last_name': 'Diallo', 'company_name': 'Okoumé Logistique',
            'email': 'awa@okoume.ga', 'phone': '+241 01 02 03', 'source': 'SITE_WEB',
            'contacts': [
                {'first_name': 'Awa', 'last_name': 'Diallo', 'email': 'awa@okoume.ga', 'phone': '', 'role': 'DG', 'is_primary': True},
                {'first_name': 'Paul', 'last_name': 'Mba', 'email': 'paul@okoume.ga', 'phone': '', 'role': 'DSI', 'is_primary': False},
            ],
        }
        payload.update(overrides)
        response = self.client.post(LEADS_URL, payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        return response.json()

    def test_converting_a_lead_creates_a_client_with_its_contacts(self):
        lead = self._create_lead()
        response = self.client.patch(f'{LEADS_URL}{lead["id"]}/', {'status': 'CONVERTI'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        client = Client.objects.get(company_name='Okoumé Logistique')
        self.assertEqual(response.json()['client'], str(client.id))
        self.assertEqual(response.json()['client_name'], 'Okoumé Logistique')
        self.assertEqual(
            sorted(client.contacts.values_list('email', flat=True)), ['awa@okoume.ga', 'paul@okoume.ga'],
        )

    def test_conversion_is_idempotent_and_reuses_existing_client(self):
        existing = ClientFactory(company_name='Okoumé Logistique')
        lead = self._create_lead()
        self.client.patch(f'{LEADS_URL}{lead["id"]}/', {'status': 'CONVERTI'}, format='json')
        self.client.patch(f'{LEADS_URL}{lead["id"]}/', {'message': 'relance'}, format='json')

        self.assertEqual(Client.objects.filter(company_name__iexact='okoumé logistique').count(), 1)
        self.assertEqual(Lead.objects.get(pk=lead['id']).client_id, existing.id)
        self.assertEqual(existing.contacts.count(), 2)

    def test_lead_created_directly_as_converted_becomes_client(self):
        lead = self._create_lead(status='CONVERTI')
        self.assertIsNotNone(Lead.objects.get(pk=lead['id']).client_id)

    def test_non_converted_lead_does_not_create_client(self):
        lead = self._create_lead()
        self.client.patch(f'{LEADS_URL}{lead["id"]}/', {'status': 'QUALIFIE'}, format='json')
        self.assertFalse(Client.objects.filter(company_name='Okoumé Logistique').exists())

    def test_client_created_directly_appears_as_converted_lead(self):
        response = self.client.post(CLIENTS_URL, {'company_name': 'Sogara', 'email': 'contact@sogara.ga'}, format='json')

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        lead = Lead.objects.get(client_id=response.json()['id'])
        self.assertEqual(lead.status, Lead.Status.CONVERTI)
        self.assertEqual(lead.source, Lead.Source.CREATION_CLIENT)
        self.assertEqual(lead.company_name, 'Sogara')

    def test_converting_a_lead_does_not_create_a_second_lead(self):
        lead = self._create_lead()
        self.client.patch(f'{LEADS_URL}{lead["id"]}/', {'status': 'CONVERTI'}, format='json')
        client = Client.objects.get(company_name='Okoumé Logistique')
        self.assertEqual(client.leads.count(), 1)

    def test_lead_can_be_deleted(self):
        lead = self._create_lead()
        response = self.client.delete(f'{LEADS_URL}{lead["id"]}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Lead.objects.filter(pk=lead['id']).exists())


class ContactDirectoryTests(APITestCase):
    def setUp(self):
        self.admin = _user_with_role(ROLE_SUPER_ADMIN)
        self.client.force_authenticate(user=self.admin)

    def test_contact_can_be_created_without_client_then_attached(self):
        response = self.client.post(
            CONTACTS_URL, {'first_name': 'Nadia', 'last_name': 'Obame', 'email': 'nadia@exemple.ga'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.content)
        self.assertIsNone(response.json()['client'])

        client = ClientFactory(company_name='Comilog')
        response = self.client.patch(f'{CONTACTS_URL}{response.json()["id"]}/', {'client': str(client.id)}, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()['client_name'], 'Comilog')
        self.assertEqual(client.contacts.count(), 1)

    def test_list_can_be_filtered_by_client(self):
        client = ClientFactory()
        Contact.objects.create(client=client, first_name='A', last_name='B')
        Contact.objects.create(first_name='C', last_name='D')

        self.assertEqual(len(self.client.get(CONTACTS_URL).json()['results']), 2)
        self.assertEqual(len(self.client.get(f'{CONTACTS_URL}?client={client.id}').json()['results']), 1)

    def test_commercial_cannot_attach_contact_to_someone_elses_client(self):
        commercial = _user_with_role(ROLE_COMMERCIAL)
        other_client = ClientFactory(assigned_to=self.admin)
        self.client.force_authenticate(user=commercial)

        response = self.client.post(
            CONTACTS_URL, {'first_name': 'X', 'last_name': 'Y', 'client': str(other_client.id)}, format='json',
        )
        self.assertIn(response.status_code, (status.HTTP_400_BAD_REQUEST, status.HTTP_403_FORBIDDEN))
        self.assertFalse(other_client.contacts.exists())

    def test_commercial_only_sees_own_unattached_contacts(self):
        commercial = _user_with_role(ROLE_COMMERCIAL)
        Contact.objects.create(first_name='Admin', last_name='Seul', created_by=self.admin)
        Contact.objects.create(first_name='Mien', last_name='Aussi', created_by=commercial)
        self.client.force_authenticate(user=commercial)

        names = [c['first_name'] for c in self.client.get(CONTACTS_URL).json()['results']]
        self.assertEqual(names, ['Mien'])
