from rest_framework import serializers

from core.constants import ROLE_ADMIN, ROLE_SUPER_ADMIN, ROLE_SUPPORT_CLIENT
from core.models import User
from core.serializers import UserBriefSerializer
from support.models import FAQEntry, SupportTicket, TicketMessage

# Longueur maximale d'un message — sans elle, l'intake public (aucune
# authentification requise) acceptait un corps de plusieurs Mo, cumulable
# avec le contournement du rate-limit (pentest du 24/09/2026, D2).
MESSAGE_MAX_LENGTH = 5000


class FAQPublicSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQEntry
        fields = ['id', 'question', 'answer', 'category', 'order']


class FAQSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQEntry
        fields = ['id', 'question', 'answer', 'category', 'audience', 'order', 'is_published', 'updated_at']


class TicketMessageSerializer(serializers.ModelSerializer):
    author = UserBriefSerializer(read_only=True)

    class Meta:
        model = TicketMessage
        fields = ['id', 'sender_type', 'author', 'body', 'created_at']


class SupportTicketPublicCreateSerializer(serializers.ModelSerializer):
    """Public intake — visitor_name/email/subject create the ticket, and
    `message` (write-only) becomes the first TicketMessage."""

    message = serializers.CharField(write_only=True, max_length=MESSAGE_MAX_LENGTH)
    access_token = serializers.UUIDField(read_only=True)

    class Meta:
        model = SupportTicket
        fields = ['id', 'visitor_name', 'visitor_email', 'subject', 'message', 'access_token']

    def create(self, validated_data):
        message = validated_data.pop('message')
        ticket = SupportTicket.objects.create(**validated_data)
        TicketMessage.objects.create(ticket=ticket, sender_type=TicketMessage.SenderType.VISITEUR, body=message)
        return ticket


class SupportTicketPublicDetailSerializer(serializers.ModelSerializer):
    """Token-authenticated visitor view — no assigned_to/visitor_email
    beyond what the visitor already knows about their own ticket."""

    messages = TicketMessageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = ['id', 'visitor_name', 'subject', 'status', 'messages', 'created_at']


class SupportTicketPublicReplySerializer(serializers.Serializer):
    message = serializers.CharField(max_length=MESSAGE_MAX_LENGTH)

    def create(self, validated_data):
        ticket = self.context['ticket']
        return TicketMessage.objects.create(
            ticket=ticket, sender_type=TicketMessage.SenderType.VISITEUR, body=validated_data['message']
        )


class SupportTicketSerializer(serializers.ModelSerializer):
    """Staff view — full ticket with the message thread and assignee."""

    messages = TicketMessageSerializer(many=True, read_only=True)
    assigned_to = UserBriefSerializer(read_only=True)
    assigned_to_id = serializers.PrimaryKeyRelatedField(
        # Restreint aux agents support — sans ça, un ticket (données
        # personnelles du visiteur comprises) pouvait être assigné à
        # n'importe quel utilisateur de l'application, support ou pas
        # (pentest du 24/09/2026, D3), et le champ permettait au passage
        # d'énumérer des identifiants utilisateurs valides par essai-erreur.
        source='assigned_to',
        queryset=User.objects.filter(roles__name__in=(ROLE_SUPPORT_CLIENT, ROLE_ADMIN, ROLE_SUPER_ADMIN)).distinct(),
        write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'visitor_name', 'visitor_email', 'subject', 'status',
            'assigned_to', 'assigned_to_id', 'messages', 'created_at', 'updated_at',
        ]
        # 'visitor_name'/'visitor_email'/'subject' en lecture seule : ce sont
        # les coordonnées du VISITEUR qui a ouvert le ticket, saisies une
        # fois par lui — un agent qui les réécrit pouvait rediriger les
        # réponses vers une autre adresse ou usurper l'identité du
        # demandeur (pentest du 24/09/2026, D4). La doc de cette vue
        # (extend_schema_view plus haut) dit "Update ticket status/assignee"
        # — ce sont les deux seuls champs qu'elle a jamais eu vocation à
        # modifier.
        read_only_fields = ['visitor_name', 'visitor_email', 'subject']


class SupportTicketListSerializer(serializers.ModelSerializer):
    """Lightweight — no message thread, for the inbox table."""

    assigned_to = UserBriefSerializer(read_only=True)

    class Meta:
        model = SupportTicket
        fields = ['id', 'visitor_name', 'visitor_email', 'subject', 'status', 'assigned_to', 'created_at', 'updated_at']
