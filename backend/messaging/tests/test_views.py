from unittest.mock import patch

from django.urls import reverse
from rest_framework.test import APITestCase

from core.constants import ROLE_ADMIN
from core.models import Role

from .factories import (
    UserFactory, ChannelMetadataFactory, ChannelParticipantFactory, DepartmentFactory,
)
from messaging.models import ChannelMetadata


@patch('messaging.views.set_chat_room_members')
@patch('messaging.views.upsert_chat_room')
class ChannelViewSetTests(APITestCase):
    def setUp(self):
        self.admin_role = Role.objects.create(name=ROLE_ADMIN)
        self.admin = UserFactory()
        self.admin.roles.add(self.admin_role)
        self.user = UserFactory()
        self.outsider = UserFactory()

        self.channel = ChannelMetadataFactory(type=ChannelMetadata.ChannelType.GROUP)
        ChannelParticipantFactory(channel=self.channel, user=self.user)

    def test_list_scoped_to_participant(self, mock_upsert, mock_members):
        self.client.force_authenticate(user=self.user)
        url = reverse('channel-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(results), 1)

    def test_list_outsider_sees_nothing(self, mock_upsert, mock_members):
        self.client.force_authenticate(user=self.outsider)
        url = reverse('channel-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(results), 0)

    def test_admin_sees_all_channels(self, mock_upsert, mock_members):
        self.client.force_authenticate(user=self.admin)
        url = reverse('channel-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        results = response.data['results'] if isinstance(response.data, dict) and 'results' in response.data else response.data
        self.assertEqual(len(results), 1)

    def test_create_group_channel_adds_creator(self, mock_upsert, mock_members):
        self.client.force_authenticate(user=self.user)
        url = reverse('channel-list')
        response = self.client.post(url, {
            'name': 'New Group', 'type': 'GROUP', 'is_private': True,
        })
        self.assertEqual(response.status_code, 201)
        channel = ChannelMetadata.objects.get(pk=response.data['id'])
        self.assertTrue(channel.participants.filter(user=self.user).exists())

    def test_create_department_channel_forbidden(self, mock_upsert, mock_members):
        self.client.force_authenticate(user=self.user)
        url = reverse('channel-list')
        response = self.client.post(url, {
            'name': 'Fake Dept Channel', 'type': 'DEPARTMENT',
        })
        self.assertEqual(response.status_code, 400)

    def test_destroy_department_channel_forbidden(self, mock_upsert, mock_members):
        dept = DepartmentFactory()
        dept_channel = ChannelMetadataFactory(type=ChannelMetadata.ChannelType.DEPARTMENT, department=dept)
        ChannelParticipantFactory(channel=dept_channel, user=self.user)
        self.client.force_authenticate(user=self.user)
        url = reverse('channel-detail', kwargs={'pk': dept_channel.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 403)

    def test_destroy_group_channel_by_non_participant_forbidden(self, mock_upsert, mock_members):
        """404, pas 403 : un non-participant est hors du queryset (get_queryset
        le filtre avant même d'atteindre perform_destroy)."""
        self.client.force_authenticate(user=self.outsider)
        url = reverse('channel-detail', kwargs={'pk': self.channel.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, 404)

    def test_participant_list_requires_membership(self, mock_upsert, mock_members):
        self.client.force_authenticate(user=self.outsider)
        url = reverse('channel-participants-list', kwargs={'channel_pk': self.channel.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, 403)

    def test_add_participant_to_group_channel(self, mock_upsert, mock_members):
        new_user = UserFactory()
        self.client.force_authenticate(user=self.user)
        url = reverse('channel-participants-list', kwargs={'channel_pk': self.channel.pk})
        response = self.client.post(url, {'user': str(new_user.pk)})
        self.assertEqual(response.status_code, 201)

    def test_add_participant_to_department_channel_forbidden(self, mock_upsert, mock_members):
        dept = DepartmentFactory()
        dept_channel = ChannelMetadataFactory(type=ChannelMetadata.ChannelType.DEPARTMENT, department=dept)
        ChannelParticipantFactory(channel=dept_channel, user=self.admin)
        self.client.force_authenticate(user=self.admin)
        url = reverse('channel-participants-list', kwargs={'channel_pk': dept_channel.pk})
        new_user = UserFactory()
        response = self.client.post(url, {'user': str(new_user.pk)})
        self.assertEqual(response.status_code, 403)
