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
    @patch('core.firestore_client.get_chat_message', return_value={'attachment': {'path': 'chat-attachments/room-1/0b6c8a1e-3c1d-4b8e-9f2a-1a2b3c4d5e6f.pdf'}})
    @patch('core.firestore_client.get_chat_room', return_value={'roomType': 'DIRECT', 'memberUids': ['uid-1']})
    def test_member_gets_fresh_link(self, _room, _msg, sign):
        res = self.api.get(URL, {'room': 'room-1', 'message': 'm1'})
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()['url'], 'https://signed.test/fresh')
        sign.assert_called_with('chat-attachments/room-1/0b6c8a1e-3c1d-4b8e-9f2a-1a2b3c4d5e6f.pdf', 3600)

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


class ChatAttachmentHardeningTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create(email='h@x.dev', firebase_uid='uid-h')
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

    def test_ids_and_paths_strict(self):
        from core.storage import is_room_attachment_path
        good = 'chat-attachments/room-1/0b6c8a1e-3c1d-4b8e-9f2a-1a2b3c4d5e6f.pdf'
        self.assertTrue(is_room_attachment_path(good, 'room-1'))
        for bad in (
            'chat-attachments/room-1/../room-2/0b6c8a1e-3c1d-4b8e-9f2a-1a2b3c4d5e6f.pdf',
            'chat-attachments/room-1/%2e%2e/x.pdf',
            'chat-attachments/room-1/sub/0b6c8a1e-3c1d-4b8e-9f2a-1a2b3c4d5e6f.pdf',
            'chat-attachments/room-12/0b6c8a1e-3c1d-4b8e-9f2a-1a2b3c4d5e6f.pdf',
        ):
            self.assertFalse(is_room_attachment_path(bad, 'room-1'), bad)
        self.assertFalse(is_room_attachment_path(good, 'room/1'))
        self.assertEqual(self.api.get(URL, {'room': '../x', 'message': 'm'}).status_code, 400)
        self.assertEqual(self.api.get(URL, {'room': 'r', 'message': 'a/b'}).status_code, 400)

    def test_legacy_only_for_old_messages(self):
        import os
        from datetime import datetime, timezone
        host = 'https://proj.supabase.co'
        legacy = f'{host}/storage/v1/object/sign/pieces_jointes/chat-attachments/0b6c8a1e-3c1d-4b8e-9f2a-1a2b3c4d5e6f.pdf?token=t'
        old = {'attachment': {'url': legacy}, 'createdAt': datetime(2026, 10, 1, tzinfo=timezone.utc)}
        recent = {'attachment': {'url': legacy}, 'createdAt': datetime(2026, 11, 20, tzinfo=timezone.utc)}
        with patch.dict(os.environ, {'SUPABASE_URL': host}), \
                patch('core.firestore_client.get_chat_room', return_value={'roomType': 'COMPANY'}), \
                patch('core.storage.sign_private_path', return_value='https://signed.test/x'):
            with patch('core.firestore_client.get_chat_message', return_value=old):
                self.assertEqual(self.api.get(URL, {'room': 'r', 'message': 'm'}).status_code, 200)
            with patch('core.firestore_client.get_chat_message', return_value=recent):
                self.assertEqual(self.api.get(URL, {'room': 'r', 'message': 'm'}).status_code, 404)
