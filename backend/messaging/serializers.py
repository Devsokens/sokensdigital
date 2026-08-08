from rest_framework import serializers

from .models import ChannelMetadata, ChannelParticipant


class ChannelParticipantSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source='user.email', read_only=True)

    class Meta:
        model = ChannelParticipant
        fields = ['id', 'channel', 'user', 'user_email', 'joined_at']
        # 'channel' est fixé par la vue nested (perform_create), jamais
        # attendu dans le payload — sinon POST échoue en 400 "champ requis".
        read_only_fields = ['channel', 'joined_at']


class ChannelMetadataSerializer(serializers.ModelSerializer):
    participant_count = serializers.IntegerField(source='participants.count', read_only=True)

    class Meta:
        model = ChannelMetadata
        fields = [
            'id', 'firestore_conversation_id', 'name', 'type',
            'department', 'project', 'is_private', 'participant_count',
            'created_at',
        ]
        read_only_fields = ['firestore_conversation_id', 'created_at']
