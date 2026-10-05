"""Notifications : qui est prévenu, par quel canal, à chaque événement.

`notify` (in-app Firestore + push + e-mail optionnel) est remplacé par un
espion là où l'on vérifie QUI est notifié ; les e-mails passent par le
backend locmem du lanceur de tests (mail.outbox), donc on vérifie aussi
qu'ils partent vraiment, avec le bon destinataire.
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.core import mail
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from core.constants import (
    ROLE_COMPTABLE, ROLE_DEVELOPER, ROLE_PROJECT_MANAGER, ROLE_RH_MANAGER, ROLE_SUPER_ADMIN,
)
from core.models import PushDevice, Role, User
from projects.models import Project, ProjectMember, ProjectTask


def _user(email, *roles, first_name='Prénom', firebase_uid=None):
    user = User.objects.create(email=email, first_name=first_name, last_name='Test', firebase_uid=firebase_uid)
    for name in roles:
        role, _ = Role.objects.get_or_create(name=name)
        user.roles.add(role)
    return user


def _client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _notified(mock_notify):
    """Destinataires (emails) des appels à notify(), dans l'ordre."""
    return [call.kwargs['user'].email for call in mock_notify.call_args_list]


def _recipients():
    return [address for message in mail.outbox for address in message.to]


class NotifyChannelsTests(APITestCase):
    """core.notifications.notify : les trois canaux, indépendants."""

    @patch('core.notifications.mailer.send_mail')
    @patch('core.notifications.push.send_to_user')
    @patch('core.notifications.firestore_client.create_notification')
    def test_in_app_and_push_by_default_email_only_on_request(self, in_app, push, send_mail):
        from core.notifications import notify
        user = _user('a@sokensdigital.com', firebase_uid='uid-a')

        notify(user=user, title='T', message='M', notification_type='GENERAL', link='/admin')
        in_app.assert_called_once_with('uid-a', 'T', 'M', 'GENERAL', '/admin')
        push.assert_called_once_with(user, 'T', 'M', link='/admin')
        send_mail.assert_not_called()

        notify(user=user, title='T', message='M', notification_type='GENERAL', email=True)
        send_mail.assert_called_once_with('a@sokensdigital.com', 'T', 'M')

    @patch('core.notifications.mailer.send_mail')
    @patch('core.notifications.push.send_to_user', side_effect=RuntimeError('FCM down'))
    @patch('core.notifications.firestore_client.create_notification')
    def test_push_failure_does_not_block_email(self, _in_app, _push, send_mail):
        from core.notifications import notify
        user = _user('b@sokensdigital.com', firebase_uid='uid-b')
        notify(user=user, title='T', message='M', notification_type='GENERAL', email=True)
        send_mail.assert_called_once()

    @patch('core.notifications.notify')
    def test_notify_roles_excludes_several_users(self, mock_notify):
        from core.notifications import notify_roles
        a = _user('a@sokensdigital.com', ROLE_PROJECT_MANAGER)
        b = _user('b@sokensdigital.com', ROLE_PROJECT_MANAGER)
        c = _user('c@sokensdigital.com', ROLE_PROJECT_MANAGER)
        notify_roles((ROLE_PROJECT_MANAGER,), title='T', message='M', notification_type='GENERAL', exclude=[a, b])
        self.assertEqual(_notified(mock_notify), [c.email])


class PushSenderTests(APITestCase):
    """core.push.send_to_user : un message FCM par appareil, jetons morts purgés."""

    def test_sends_to_each_device_and_drops_dead_tokens(self):
        from core import push
        user = _user('p@sokensdigital.com')
        PushDevice.objects.create(user=user, token='ok-token')
        PushDevice.objects.create(user=user, token='dead-token')

        class Unregistered(Exception):
            pass

        def fake_send(message):
            if message.token == 'dead-token':
                raise Unregistered()

        messaging = MagicMock()
        messaging.UnregisteredError = Unregistered
        messaging.Message = lambda data, token: MagicMock(data=data, token=token)
        messaging.send.side_effect = fake_send
        firebase_admin = MagicMock(_apps={'[DEFAULT]': object()}, messaging=messaging)

        with patch.dict('sys.modules', {'firebase_admin': firebase_admin, 'firebase_admin.messaging': messaging}):
            sent = push.send_to_user(user, 'Titre', 'Corps', link='/admin/agenda')

        self.assertEqual(sent, 1)
        self.assertEqual(list(PushDevice.objects.values_list('token', flat=True)), ['ok-token'])

    def test_no_device_is_not_an_error(self):
        from core import push
        self.assertEqual(push.send_to_user(_user('n@sokensdigital.com'), 'T', 'B'), 0)


class PushDeviceAndTestEndpointTests(APITestCase):
    def setUp(self):
        self.user = _user('me@sokensdigital.com', ROLE_DEVELOPER, firebase_uid='uid-me')
        self.client_me = _client(self.user)

    def test_device_registration_url(self):
        """L'adresse appelée par le navigateur (frontend/lib/push.ts)."""
        response = self.client_me.post('/api/v1/push/devices/', {'token': 'abc', 'platform': 'WEB'}, format='json')
        self.assertEqual(response.status_code, 204)
        self.assertTrue(PushDevice.objects.filter(user=self.user, token='abc').exists())

    @patch('core.push.send_to_user', return_value=1)
    @patch('core.firestore_client.create_notification')
    def test_test_notification_reports_each_channel(self, in_app, _push):
        PushDevice.objects.create(user=self.user, token='abc')
        response = self.client_me.post('/api/v1/notifications/test/')
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body['in_app'])
        self.assertEqual(body['push_devices'], 1)
        self.assertEqual(body['push_sent'], 1)
        self.assertTrue(body['email'])
        self.assertEqual(_recipients(), ['me@sokensdigital.com'])
        in_app.assert_called_once()


@patch('projects.views.upsert_chat_room')
@patch('projects.views.set_chat_room_members')
@patch('projects.notifications.notify')
class ProjectNotificationTests(APITestCase):
    def setUp(self):
        self.chef = _user('chef@sokensdigital.com', ROLE_PROJECT_MANAGER)
        self.other_chef = _user('autre-chef@sokensdigital.com', ROLE_PROJECT_MANAGER)
        self.dev = _user('dev@sokensdigital.com', ROLE_DEVELOPER)
        self.dev2 = _user('dev2@sokensdigital.com', ROLE_DEVELOPER)
        self.client_chef = _client(self.chef)

    def test_lead_assigned_at_creation_gets_notification_and_email(self, mock_notify, *_):
        response = self.client_chef.post('/api/v1/projects/', {
            'name': 'Site vitrine', 'lead_project_manager_id': str(self.other_chef.id),
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(_notified(mock_notify), [self.other_chef.email])
        self.assertIn(self.other_chef.email, _recipients())
        self.assertIn('Site vitrine', mail.outbox[-1].subject)

    def test_creating_your_own_project_notifies_nobody_as_lead(self, mock_notify, *_):
        self.client_chef.post('/api/v1/projects/', {'name': 'Mon projet'}, format='json')
        self.assertEqual(_notified(mock_notify), [])
        self.assertNotIn(self.chef.email, _recipients())

    def test_changing_the_lead_notifies_the_new_lead(self, mock_notify, *_):
        project = Project.objects.create(name='Refonte', lead_project_manager=self.chef)
        response = self.client_chef.patch(
            f'/api/v1/projects/{project.id}/', {'lead_project_manager_id': str(self.other_chef.id)}, format='json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(_notified(mock_notify), [self.other_chef.email])
        self.assertIn(self.other_chef.email, _recipients())

    def test_member_added_gets_notification_and_email(self, mock_notify, *_):
        project = Project.objects.create(name='Refonte', lead_project_manager=self.chef)
        response = self.client_chef.post(
            f'/api/v1/projects/{project.id}/members/', {'user_id': str(self.dev.id)}, format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(_notified(mock_notify), [self.dev.email])
        self.assertEqual(_recipients(), [self.dev.email])

    def test_task_assignment_notifies_assignees_but_not_yourself(self, mock_notify, *_):
        project = Project.objects.create(name='Refonte', lead_project_manager=self.chef)
        ProjectMember.objects.create(project=project, user=self.dev)
        response = self.client_chef.post(f'/api/v1/projects/{project.id}/tasks/', {
            'title': 'Maquettes', 'assignee_ids': [str(self.dev.id), str(self.chef.id)],
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(_notified(mock_notify), [self.dev.email])
        self.assertEqual(_recipients(), [self.dev.email])
        self.assertIn('Maquettes', mail.outbox[0].subject)

    def test_reassignment_only_notifies_newcomers(self, mock_notify, *_):
        project = Project.objects.create(name='Refonte', lead_project_manager=self.chef)
        task = ProjectTask.objects.create(project=project, title='Maquettes')
        task.assignees.add(self.dev)
        response = self.client_chef.patch(f'/api/v1/projects/{project.id}/tasks/{task.id}/', {
            'assignee_ids': [str(self.dev.id), str(self.dev2.id)],
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(_notified(mock_notify), [self.dev2.email])

    def test_comment_notifies_assignees_except_author_without_email(self, mock_notify, *_):
        project = Project.objects.create(name='Refonte', lead_project_manager=self.chef)
        ProjectMember.objects.create(project=project, user=self.dev)
        task = ProjectTask.objects.create(project=project, title='Maquettes')
        task.assignees.add(self.dev, self.dev2)
        response = _client(self.dev).post(
            f'/api/v1/projects/{project.id}/tasks/{task.id}/comments/', {'body': 'Fait !'}, format='json',
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(_notified(mock_notify), [self.dev2.email])
        self.assertEqual(mail.outbox, [])


class AccountInvitationTests(APITestCase):
    @patch('core.views.notify_roles')
    @patch('core.views.create_profile')
    @patch('firebase_admin.auth.create_user')
    def test_created_account_receives_invitation_with_password_and_login_button(self, create_user, _profile, _roles):
        create_user.return_value = MagicMock(uid='uid-new')
        rh = _user('rh@sokensdigital.com', ROLE_RH_MANAGER)
        response = _client(rh).post('/api/v1/users/provision/', {
            'email': 'nouveau@sokensdigital.com', 'password': 'MotDePasse!2026',
            'first_name': 'Nouveau', 'last_name': 'Collègue', 'roles': ['DEVELOPPEUR'],
        }, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(_recipients(), ['nouveau@sokensdigital.com'])
        message = mail.outbox[0]
        self.assertIn('MotDePasse!2026', message.body)
        html = message.alternatives[0][0]
        self.assertIn('Se connecter', html)
        self.assertIn('/connexion', html)


@patch('administration.views.calendar_sync')
@patch('administration.views.notify')
class AppointmentInvitationTests(APITestCase):
    def setUp(self):
        self.organizer = _user('orga@sokensdigital.com', ROLE_DEVELOPER, first_name='Awa')
        self.guest = _user('invite@sokensdigital.com', ROLE_DEVELOPER)
        self.late_guest = _user('retard@sokensdigital.com', ROLE_DEVELOPER)
        self.client_orga = _client(self.organizer)
        start = timezone.now() + timedelta(days=1)
        self.payload = {
            'title': 'Point client', 'start_at': start.isoformat(),
            'end_at': (start + timedelta(hours=1)).isoformat(), 'attendees': [str(self.guest.id)],
        }

    def test_guests_are_invited_by_notification_and_email(self, mock_notify, _sync):
        response = self.client_orga.post('/api/administration/appointments/', self.payload, format='json')
        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(_notified(mock_notify), [self.guest.email])
        self.assertTrue(mock_notify.call_args.kwargs['email'])

    def test_only_newly_added_guests_are_invited_on_update(self, mock_notify, _sync):
        appointment_id = self.client_orga.post('/api/administration/appointments/', self.payload, format='json').json()['id']
        mock_notify.reset_mock()
        response = self.client_orga.patch(f'/api/administration/appointments/{appointment_id}/', {
            'attendees': [str(self.guest.id), str(self.late_guest.id)],
        }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(_notified(mock_notify), [self.late_guest.email])


@patch('finance.views.notify')
@patch('finance.views.notify_roles')
class BesoinNotificationTests(APITestCase):
    URL = '/api/v1/finance/disbursement-requests/'

    def setUp(self):
        self.chef = _user('chef@sokensdigital.com', ROLE_PROJECT_MANAGER)
        self.comptable = _user('compta@sokensdigital.com', ROLE_COMPTABLE)
        self.gerant = _user('gerant@sokensdigital.com', ROLE_SUPER_ADMIN)

    def create(self):
        return _client(self.chef).post(self.URL, {
            'beneficiary_user_id': str(self.chef.id),
            'lines': [{'label': 'Écran', 'quantity': '1', 'unit_price': '90000'}],
        }, format='json').json()

    def test_new_besoin_notifies_the_rcf(self, mock_roles, _notify):
        self.create()
        self.assertEqual(mock_roles.call_args.args[0], (ROLE_COMPTABLE, 'Directeur Financier'))
        self.assertEqual(mock_roles.call_args.kwargs['title'], 'Nouveau besoin à examiner')

    def test_rcf_approval_notifies_the_gerant_then_decision_reaches_requester(self, mock_roles, mock_notify):
        besoin = self.create()
        _client(self.comptable).post(f'{self.URL}{besoin["id"]}/approve/', {'decision': 'APPROUVE'}, format='json')
        self.assertEqual(mock_roles.call_args.args[0], (ROLE_SUPER_ADMIN,))

        _client(self.gerant).post(f'{self.URL}{besoin["id"]}/approve/', {'decision': 'APPROUVE'}, format='json')
        self.assertEqual(mock_notify.call_args.kwargs['user'], self.chef)
        self.assertEqual(mock_notify.call_args.kwargs['title'], 'Besoin approuvé')
        self.assertTrue(mock_notify.call_args.kwargs['email'])

    def test_rejection_reason_reaches_requester(self, _roles, mock_notify):
        besoin = self.create()
        _client(self.comptable).post(
            f'{self.URL}{besoin["id"]}/approve/', {'decision': 'REJETE', 'rejection_reason': 'Hors budget'}, format='json',
        )
        self.assertEqual(mock_notify.call_args.kwargs['title'], 'Besoin rejeté')
        self.assertIn('Hors budget', mock_notify.call_args.kwargs['message'])


class EmailFormatTests(APITestCase):
    """Ce qui compte pour la délivrabilité : nom d'expéditeur, document HTML
    complet, version texte en plus de la version HTML."""

    def test_sender_name_full_html_and_text_part(self):
        from django.test import override_settings
        from core import mailer
        with override_settings(DEFAULT_FROM_EMAIL='sokens@gmail.com', EMAIL_FROM_NAME="Soken's Digital"):
            self.assertTrue(mailer.send_mail('dest@sokensdigital.com', 'Sujet', 'Bonjour,\nCorps.',
                                             action_url='https://sokensdigital.com/admin', action_label='Ouvrir'))
        message = mail.outbox[0]
        self.assertEqual(message.from_email, "Soken's Digital <sokens@gmail.com>")
        self.assertIn('Corps.', message.body)
        html = message.alternatives[0][0]
        self.assertTrue(html.startswith('<!DOCTYPE html><html lang="fr">'))
        self.assertIn('<meta charset="utf-8">', html)
        self.assertIn('<title>Sujet</title>', html)
        self.assertTrue(html.endswith('</body></html>'))
