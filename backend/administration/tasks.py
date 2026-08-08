import datetime

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone

from core.models import Notification
from .models import ClientInteraction, ClientDocument, EmployeeDocument, ContractGenerator

@shared_task
def follow_up_reminders():
    """
    Planifiée périodiquement (voir CELERY_BEAT_SCHEDULE). Une notification
    par interaction dont la relance est due, dédupliquée via entity_type/
    entity_id pour ne pas spammer à chaque exécution du tick.
    """
    now = timezone.now()
    due = ClientInteraction.objects.filter(
        follow_up_date__lte=now, follow_up_date__isnull=False, user__isnull=False,
    ).select_related('client')
    for interaction in due:
        already_notified = Notification.objects.filter(
            user_id=interaction.user_id,
            notification_type=Notification.NotificationType.FOLLOW_UP,
            entity_type='ClientInteraction',
            entity_id=str(interaction.pk),
        ).exists()
        if already_notified:
            continue
        Notification.objects.create(
            user_id=interaction.user_id,
            title=f'Relance à faire — {interaction.client.company_name}',
            message=f'Relance prévue pour "{interaction.subject}" ({interaction.client.company_name}).',
            notification_type=Notification.NotificationType.FOLLOW_UP,
            entity_type='ClientInteraction',
            entity_id=str(interaction.pk),
        )

@shared_task
def auto_archive():
    # Placeholder for auto archiving clients
    pass

@shared_task
def document_expiry():
    """
    Alerte (notification in-app) 30 jours avant expiration d'un document
    employé. Dédupliquée par entity_type/entity_id — une seule notification
    par document tant qu'elle n'a pas été marquée lue.
    """
    horizon = timezone.now().date() + datetime.timedelta(days=30)
    expiring = EmployeeDocument.objects.filter(
        expiry_date__isnull=False,
        expiry_date__lte=horizon,
        expiry_date__gte=timezone.now().date(),
    ).select_related('user')
    for doc in expiring:
        already_notified = Notification.objects.filter(
            user_id=doc.user_id,
            notification_type=Notification.NotificationType.DOCUMENT_EXPIRY,
            entity_type='EmployeeDocument',
            entity_id=str(doc.pk),
        ).exists()
        if already_notified:
            continue
        Notification.objects.create(
            user_id=doc.user_id,
            title=f'Document bientôt expiré — {doc.document_name}',
            message=(
                f'Votre document "{doc.document_name}" expire le '
                f'{doc.expiry_date.strftime("%d/%m/%Y")}.'
            ),
            notification_type=Notification.NotificationType.DOCUMENT_EXPIRY,
            entity_type='EmployeeDocument',
            entity_id=str(doc.pk),
        )
        from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None)
        if from_email and doc.user and doc.user.email:
            send_mail(
                subject=f'Document bientôt expiré — {doc.document_name}',
                message=(
                    f'Bonjour {doc.user.first_name},\n\nVotre document '
                    f'"{doc.document_name}" expire le '
                    f'{doc.expiry_date.strftime("%d/%m/%Y")}. Merci de le '
                    'renouveler auprès du service RH.\n\nCordialement.'
                ),
                from_email=from_email,
                recipient_list=[doc.user.email],
                fail_silently=True,
            )

@shared_task
def expired_contracts():
    # Placeholder for checking contract expirations
    pass

@shared_task
def generate_pdf(contract_id):
    # Placeholder logic
    pass

@shared_task
def import_payslips(file_path):
    # Placeholder logic
    pass
