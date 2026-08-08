from django.db import IntegrityError
from django.test import TestCase

from .factories import ChannelMetadataFactory, ChannelParticipantFactory, UserFactory


class ChannelMetadataTests(TestCase):
    def test_firestore_conversation_id_unique(self):
        ChannelMetadataFactory(firestore_conversation_id='dup-id')
        with self.assertRaises(IntegrityError):
            ChannelMetadataFactory(firestore_conversation_id='dup-id')


class ChannelParticipantTests(TestCase):
    def test_unique_channel_participant_constraint(self):
        channel = ChannelMetadataFactory()
        user = UserFactory()
        ChannelParticipantFactory(channel=channel, user=user)
        with self.assertRaises(IntegrityError):
            ChannelParticipantFactory(channel=channel, user=user)
