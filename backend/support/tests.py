from django.core.cache import cache
from rest_framework.test import APIClient, APITestCase

from core.constants import ROLE_COMMERCIAL, ROLE_SUPER_ADMIN, ROLE_SUPPORT_CLIENT
from core.models import Role, User
from support.models import FAQEntry, SupportTicket, TicketMessage


def _give_role(user, name):
    role, _ = Role.objects.get_or_create(name=name)
    user.roles.add(role)
    return role


class PublicFAQTests(APITestCase):
    def setUp(self):
        self.client = APIClient()

    def test_only_public_published_entries_are_returned(self):
        FAQEntry.objects.create(question='Public visible', answer='...', audience=FAQEntry.Audience.PUBLIC, is_published=True)
        FAQEntry.objects.create(question='Public unpublished', answer='...', audience=FAQEntry.Audience.PUBLIC, is_published=False)
        FAQEntry.objects.create(question='Internal', answer='...', audience=FAQEntry.Audience.INTERNE, is_published=True)

        response = self.client.get('/api/v1/public/faq/')
        self.assertEqual(response.status_code, 200)
        questions = [entry['question'] for entry in response.data['results']]
        self.assertEqual(questions, ['Public visible'])


class PublicTicketTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def valid_payload(self, **overrides):
        payload = {
            'visitor_name': 'Ada Lovelace',
            'visitor_email': 'ada@example.com',
            'subject': 'Question sur un devis',
            'message': 'Bonjour, jai une question.',
        }
        payload.update(overrides)
        return payload

    def test_public_can_create_ticket(self):
        response = self.client.post('/api/v1/public/tickets/', self.valid_payload(), format='json')
        self.assertEqual(response.status_code, 201)
        self.assertIn('access_token', response.data)
        ticket = SupportTicket.objects.get()
        self.assertEqual(ticket.messages.count(), 1)
        self.assertEqual(ticket.messages.first().sender_type, TicketMessage.SenderType.VISITEUR)

    def test_rate_limited_after_five_requests(self):
        for _ in range(5):
            response = self.client.post('/api/v1/public/tickets/', self.valid_payload(), format='json')
            self.assertEqual(response.status_code, 201)
        response = self.client.post('/api/v1/public/tickets/', self.valid_payload(), format='json')
        self.assertEqual(response.status_code, 429)

    def test_visitor_can_poll_with_valid_token(self):
        create_response = self.client.post('/api/v1/public/tickets/', self.valid_payload(), format='json')
        token = create_response.data['access_token']
        response = self.client.get(f'/api/v1/public/tickets/{token}/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['messages']), 1)

    def test_invalid_token_returns_404(self):
        response = self.client.get('/api/v1/public/tickets/00000000-0000-0000-0000-000000000000/')
        self.assertEqual(response.status_code, 404)

    def test_visitor_can_reply_with_valid_token(self):
        create_response = self.client.post('/api/v1/public/tickets/', self.valid_payload(), format='json')
        token = create_response.data['access_token']
        response = self.client.post(f'/api/v1/public/tickets/{token}/reply/', {'message': 'Un complément.'}, format='json')
        self.assertEqual(response.status_code, 201)
        ticket = SupportTicket.objects.get()
        self.assertEqual(ticket.messages.count(), 2)

    def test_reply_with_invalid_token_returns_404(self):
        response = self.client.post(
            '/api/v1/public/tickets/00000000-0000-0000-0000-000000000000/reply/',
            {'message': 'x'}, format='json',
        )
        self.assertEqual(response.status_code, 404)


class StaffSupportTicketTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.ticket = SupportTicket.objects.create(visitor_name='Ada', visitor_email='ada@example.com', subject='Aide')
        TicketMessage.objects.create(ticket=self.ticket, sender_type=TicketMessage.SenderType.VISITEUR, body='Bonjour')

    def test_support_client_can_list_tickets(self):
        user = User.objects.create_user(email='support@sokens.test', password='pass1234')
        _give_role(user, ROLE_SUPPORT_CLIENT)
        self.client.force_authenticate(user)
        response = self.client.get('/api/v1/support/tickets/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data['results']) if isinstance(response.data, dict) else len(response.data), 1)

    def test_support_client_can_reply(self):
        user = User.objects.create_user(email='support2@sokens.test', password='pass1234')
        _give_role(user, ROLE_SUPPORT_CLIENT)
        self.client.force_authenticate(user)
        response = self.client.post(f'/api/v1/support/tickets/{self.ticket.id}/reply/', {'message': 'On regarde ça.'}, format='json')
        self.assertEqual(response.status_code, 201)
        self.ticket.refresh_from_db()
        self.assertEqual(self.ticket.status, SupportTicket.Status.EN_COURS)
        self.assertEqual(self.ticket.messages.count(), 2)
        last_message = self.ticket.messages.last()
        self.assertEqual(last_message.sender_type, TicketMessage.SenderType.STAFF)
        self.assertEqual(last_message.author, user)

    def test_role_without_tickets_permission_is_forbidden(self):
        user = User.objects.create_user(email='commercial@sokens.test', password='pass1234')
        _give_role(user, ROLE_COMMERCIAL)
        self.client.force_authenticate(user)
        response = self.client.get('/api/v1/support/tickets/')
        self.assertEqual(response.status_code, 403)

    def test_super_admin_can_access_tickets(self):
        user = User.objects.create_user(email='admin@sokens.test', password='pass1234')
        _give_role(user, ROLE_SUPER_ADMIN)
        self.client.force_authenticate(user)
        response = self.client.get('/api/v1/support/tickets/')
        self.assertEqual(response.status_code, 200)

    def test_unauthenticated_is_forbidden(self):
        response = self.client.get('/api/v1/support/tickets/')
        self.assertIn(response.status_code, (401, 403))
