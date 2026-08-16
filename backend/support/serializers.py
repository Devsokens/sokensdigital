from rest_framework import serializers

from core.models import User
from core.serializers import UserBriefSerializer
from support.models import FAQEntry, SupportTicket, TicketMessage


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

    message = serializers.CharField(write_only=True)
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
    message = serializers.CharField()

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
        source='assigned_to', queryset=User.objects.all(), write_only=True, required=False, allow_null=True,
    )

    class Meta:
        model = SupportTicket
        fields = [
            'id', 'visitor_name', 'visitor_email', 'subject', 'status',
            'assigned_to', 'assigned_to_id', 'messages', 'created_at', 'updated_at',
        ]


class SupportTicketListSerializer(serializers.ModelSerializer):
    """Lightweight — no message thread, for the inbox table."""

    assigned_to = UserBriefSerializer(read_only=True)

    class Meta:
        model = SupportTicket
        fields = ['id', 'visitor_name', 'visitor_email', 'subject', 'status', 'assigned_to', 'created_at', 'updated_at']
