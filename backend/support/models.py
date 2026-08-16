import uuid

from django.db import models

from core.models import LoggedModel, User


class FAQEntry(LoggedModel):
    class Audience(models.TextChoices):
        PUBLIC = 'PUBLIC', 'Public'
        INTERNE = 'INTERNE', 'Interne'  # base de connaissances — staff uniquement

    question = models.CharField(max_length=255)
    answer = models.TextField()
    category = models.CharField(max_length=100, blank=True)
    audience = models.CharField(max_length=10, choices=Audience.choices, default=Audience.PUBLIC)
    order = models.PositiveIntegerField(default=0)
    is_published = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(LoggedModel.Meta):
        ordering = ['order', 'question']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['audience', 'is_published']),
        ]

    def __str__(self):
        return self.question


class SupportTicket(LoggedModel):
    class Status(models.TextChoices):
        OUVERT = 'OUVERT', 'Ouvert'
        EN_COURS = 'EN_COURS', 'En cours'
        FERME = 'FERME', 'Fermé'

    visitor_name = models.CharField(max_length=255)
    visitor_email = models.EmailField()
    subject = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.OUVERT)
    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name='support_tickets'
    )
    # The visitor's only credential to poll/reply — no account, same
    # mechanism as Quote.tracking_token (marketing.models.Quote).
    access_token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta(LoggedModel.Meta):
        ordering = ['-updated_at']
        indexes = LoggedModel.Meta.indexes + [
            models.Index(fields=['status']),
            models.Index(fields=['access_token']),
        ]

    def __str__(self):
        return f'{self.visitor_name} — {self.subject or self.status}'


class TicketMessage(LoggedModel):
    class SenderType(models.TextChoices):
        VISITEUR = 'VISITEUR', 'Visiteur'
        STAFF = 'STAFF', 'Équipe'

    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name='messages')
    sender_type = models.CharField(max_length=10, choices=SenderType.choices)
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    body = models.TextField()

    class Meta(LoggedModel.Meta):
        ordering = ['created_at']

    def __str__(self):
        return f'{self.sender_type}: {self.body[:40]}'
