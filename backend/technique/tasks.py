import logging

from celery import shared_task
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone

from core.models import Notification
from .models import Ticket, Project

logger = logging.getLogger(__name__)


@shared_task
def auto_close_ticket(ticket_id):
    try:
        ticket = Ticket.objects.get(pk=ticket_id)
        if ticket.status == 'RESOLVED':
            ticket.status = 'CLOSED'
            ticket.save()
    except Ticket.DoesNotExist:
        pass


@shared_task
def check_budget_alerts():
    """
    Planifiée périodiquement (Celery beat — voir sokens_backend/settings.py
    CELERY_BEAT_SCHEDULE). Crée UNE notification BUDGET_ALERT par projet en
    dépassement pour le chef de projet, sans doublon si l'alerte a déjà été
    envoyée pour ce projet (entity_type/entity_id sert de clé de dédup).
    """
    projects = Project.objects.filter(status='EN_COURS').select_related('project_manager')
    for project in projects:
        if not project.is_over_budget or not project.project_manager_id:
            continue
        already_alerted = Notification.objects.filter(
            user_id=project.project_manager_id,
            notification_type=Notification.NotificationType.BUDGET_ALERT,
            entity_type='Project',
            entity_id=str(project.pk),
        ).exists()
        if already_alerted:
            continue
        Notification.objects.create(
            user_id=project.project_manager_id,
            title=f'Dépassement de budget — {project.name}',
            message=(
                f'Le projet "{project.name}" a dépassé son budget prévu '
                f'({project.budget} FCFA).'
            ),
            notification_type=Notification.NotificationType.BUDGET_ALERT,
            entity_type='Project',
            entity_id=str(project.pk),
        )


@shared_task
def send_ticket_resolution_email(ticket_id):
    """
    Email de confirmation au client quand un ticket passe à RESOLVED —
    voir signals.ticket_resolved_handler pour le déclenchement et la
    planification de la fermeture auto à 48h (auto_close_ticket).

    Utilise le backend email Django standard (EMAIL_BACKEND / EMAIL_HOST_*
    dans settings.py, à configurer via variables d'env) plutôt que l'API
    Gmail mentionnée au cahier des charges — même schéma qu'ailleurs dans
    ce repo pour une intégration externe pas encore câblée (cf. Facebook
    Publishing, marketing/publishing.py) : le code est prêt, l'API Gmail
    OAuth spécifique peut être branchée plus tard sans changer l'appelant.
    """
    try:
        ticket = Ticket.objects.select_related('client').get(pk=ticket_id)
    except Ticket.DoesNotExist:
        return

    recipient = getattr(ticket.client, 'email', None) if ticket.client else None
    if not recipient:
        logger.warning('send_ticket_resolution_email: ticket %s has no client email', ticket_id)
        return

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None)
    if not from_email:
        logger.warning('send_ticket_resolution_email: DEFAULT_FROM_EMAIL not configured')
        return

    send_mail(
        subject=f'Ticket résolu — {ticket.title}',
        message=(
            f'Bonjour,\n\nVotre ticket "{ticket.title}" a été marqué comme résolu.\n'
            'Si le problème persiste, répondez à cet email sous 48h, sinon le '
            'ticket sera automatiquement clôturé.\n\nCordialement.'
        ),
        from_email=from_email,
        recipient_list=[recipient],
        fail_silently=True,
    )
