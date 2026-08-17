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
    participant_count = serializers.SerializerMethodField()

    def get_participant_count(self, obj):
        # list/retrieve passent par ChannelMetadataViewSet.get_queryset(),
        # qui annote déjà participant_count (Count('participants',
        # distinct=True), 1 seule requête pour toute la page) — le lire
        # directement évite un COUNT(*) séparé par ligne affichée.
        # create()/update() renvoient une instance non annotée (pas
        # re-fetchée depuis get_queryset) : fallback sur un count() direct,
        # toujours correct, juste pas optimisé (un seul objet de toute
        # façon, donc pas de N+1 possible dans ce cas).
        if hasattr(obj, 'participant_count'):
            return obj.participant_count
        return obj.participants.count()

    class Meta:
        model = ChannelMetadata
        fields = [
            'id', 'firestore_conversation_id', 'name', 'type',
            'department', 'project', 'is_private', 'participant_count',
            'created_at',
        ]
        read_only_fields = ['firestore_conversation_id', 'created_at']
