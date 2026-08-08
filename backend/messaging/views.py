import uuid

from rest_framework import viewsets, permissions
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
from rest_framework.response import Response

from core.firestore_client import upsert_chat_room, set_chat_room_members
from core.models import User
from core.constants import ADMIN_ROLES

from .models import ChannelMetadata, ChannelParticipant
from .serializers import ChannelMetadataSerializer, ChannelParticipantSerializer


class ChannelMetadataViewSet(viewsets.ModelViewSet):
    """
    Canaux de messagerie visibles par l'utilisateur courant.

    - DEPARTMENT / PROJECT : créés automatiquement par les signaux
      (messaging.signals) — non créables/modifiables manuellement ici.
    - DIRECT / GROUP : créables par tout utilisateur authentifié, qui en
      devient automatiquement participant.
    """
    serializer_class = ChannelMetadataSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def get_queryset(self):
        user = self.request.user
        qs = ChannelMetadata.objects.all()
        if user.roles.filter(name__in=ADMIN_ROLES).exists():
            return qs
        return qs.filter(participants__user=user).distinct()

    def perform_create(self, serializer):
        channel_type = serializer.validated_data.get('type')
        if channel_type in (ChannelMetadata.ChannelType.DEPARTMENT, ChannelMetadata.ChannelType.PROJECT):
            raise DRFValidationError(
                'Les canaux DEPARTMENT/PROJECT sont créés automatiquement, '
                'pas via cet endpoint.'
            )

        user = self.request.user
        firestore_id = f'{channel_type.lower()}-{uuid.uuid4()}'
        channel = serializer.save(
            firestore_conversation_id=firestore_id,
            department=None,
            project=None,
        )

        participant_ids = set(self.request.data.get('participant_ids', []))
        participant_ids.add(str(user.pk))
        valid_ids = set(
            str(uid) for uid in User.objects.filter(
                id__in=participant_ids, is_active=True,
            ).values_list('id', flat=True)
        )
        ChannelParticipant.objects.bulk_create([
            ChannelParticipant(channel=channel, user_id=uid) for uid in valid_ids
        ], ignore_conflicts=True)

        upsert_chat_room(firestore_id, {
            'name': channel.name,
            'type': channel_type.lower(),
            'participants': list(valid_ids),
        })
        set_chat_room_members(firestore_id, list(valid_ids))

    def perform_destroy(self, instance):
        if instance.type in (ChannelMetadata.ChannelType.DEPARTMENT, ChannelMetadata.ChannelType.PROJECT):
            raise PermissionDenied(
                'Les canaux DEPARTMENT/PROJECT ne peuvent pas être supprimés manuellement.'
            )
        user = self.request.user
        is_participant = ChannelParticipant.objects.filter(channel=instance, user=user).exists()
        is_admin = user.roles.filter(name__in=ADMIN_ROLES).exists()
        if not (is_participant or is_admin):
            raise PermissionDenied("Vous n'êtes pas membre de ce canal.")
        instance.delete()


class ChannelParticipantViewSet(viewsets.ModelViewSet):
    """Participants d'un canal (nested sous /channels/{id}/participants/)."""
    serializer_class = ChannelParticipantSerializer
    http_method_names = ['get', 'post', 'delete', 'head', 'options']

    def _get_channel(self):
        return ChannelMetadata.objects.filter(pk=self.kwargs['channel_pk']).first()

    def _check_access(self, channel):
        user = self.request.user
        if user.roles.filter(name__in=ADMIN_ROLES).exists():
            return
        if not ChannelParticipant.objects.filter(channel=channel, user=user).exists():
            raise PermissionDenied("Vous n'êtes pas membre de ce canal.")

    def get_queryset(self):
        channel = self._get_channel()
        if not channel:
            return ChannelParticipant.objects.none()
        self._check_access(channel)
        return ChannelParticipant.objects.filter(channel=channel)

    def perform_create(self, serializer):
        channel = self._get_channel()
        if not channel:
            raise DRFValidationError('Canal introuvable.')
        if channel.type in (ChannelMetadata.ChannelType.DEPARTMENT, ChannelMetadata.ChannelType.PROJECT):
            raise PermissionDenied(
                'La composition des canaux DEPARTMENT/PROJECT est gérée '
                'automatiquement (appartenance département/équipe projet).'
            )
        self._check_access(channel)
        serializer.save(channel=channel)
        member_ids = list(
            ChannelParticipant.objects.filter(channel=channel).values_list('user_id', flat=True)
        )
        set_chat_room_members(channel.firestore_conversation_id, [str(uid) for uid in member_ids])

    def perform_destroy(self, instance):
        if instance.channel.type in (ChannelMetadata.ChannelType.DEPARTMENT, ChannelMetadata.ChannelType.PROJECT):
            raise PermissionDenied(
                'La composition des canaux DEPARTMENT/PROJECT est gérée automatiquement.'
            )
        self._check_access(instance.channel)
        channel = instance.channel
        instance.delete()
        member_ids = list(
            ChannelParticipant.objects.filter(channel=channel).values_list('user_id', flat=True)
        )
        set_chat_room_members(channel.firestore_conversation_id, [str(uid) for uid in member_ids])
