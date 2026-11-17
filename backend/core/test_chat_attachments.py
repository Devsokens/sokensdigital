"""Pièces jointes de messagerie : liens non temporaires, réservés au salon."""
from unittest.mock import patch

from rest_framework.test import APIClient, APITestCase

from core.firestore_client import user_can_read_chat_room
from core.models import User

URL = '/api/v1/uploads/chat-attachment/link/'


class ChatAttachmentLinkTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create(email='u@x.dev', firebase_uid='uid-1')
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def test_room_rules(self):
        self.assertTrue(user_can_read_chat_room('uid-1', {'roomType': 'COMPANY'}))
        self.assertTrue(user_can_read_chat_room('uid-1', {'roomType': 'DIRECT', 'memberUids': ['uid-1', 'b']}))
        self.assertFalse(user_can_read_chat_room('uid-1', {'roomType': 'PROJECT', 'memberUids': ['b']}))

    @patch('core.storage.sign_private_path', return_value='https://signed.test/fresh')
    @patch('core.firestore_client.get_chat_message', return_value={'attachment': {'path': 'chat-attachments/room-1/a.pdf'}})
    @patch('core.firestore_client.get_chat_room', return_value={'roomType': 'DIRECT', 'memberUids': ['uid-1']})
    def test_member_gets_fresh_link(self, _room, _msg, sign):
        res = self.api.get(URL, {'room': 'room-1', 'message': 'm1'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['url'], 'https://signed.test/fresh')
        sign.assert_called_with('chat-attachments/room-1/a.pdf', 3600)

    @patch('core.firestore_client.get_chat_room', return_value={'roomType': 'DIRECT', 'memberUids': ['other']})
    def test_non_member_refused(self, _room):
        self.assertEqual(self.api.get(URL, {'room': 'room-1', 'message': 'm1'}).status_code, 403)

    @patch('core.storage.sign_private_path')
    @patch('core.firestore_client.get_chat_message', return_value={'attachment': {'path': 'chat-attachments/autre-salon/a.pdf'}})
    @patch('core.firestore_client.get_chat_room', return_value={'roomType': 'COMPANY'})
    def test_path_outside_room_refused(self, _room, _msg, sign):
        self.assertEqual(self.api.get(URL, {'room': 'room-1', 'message': 'm1'}).status_code, 404)
        sign.assert_not_called()

    def test_anonymous_refused(self):
        self.assertEqual(APIClient().get(URL, {'room': 'r', 'message': 'm'}).status_code, 401)
