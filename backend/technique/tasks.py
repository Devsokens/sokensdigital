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


@shared_task
def check_maintenance_due():
    """Alerte sur les applications dont la maintenance est en retard.

    Planifiée chaque matin (CELERY_BEAT_SCHEDULE). Le cahier des charges
    impose 3 passages par semaine sur les apps livrées ; sans rappel, un
    oubli ne se voit qu'au prochain incident client.

    La fenêtre est calculée depuis `expected_reports_per_week` plutôt que
    codée en dur : une app en maintenance mensuelle ne doit pas déclencher
    une alerte au bout de deux jours.

    Destinataires : l'assigné s'il y en a un, sinon les responsables
    techniques — une app non attribuée est justement celle qu'on oublie, la
    laisser sans destinataire reproduirait le problème qu'on corrige.

    La déduplication réutilise le motif de check_budget_alerts, mais bornée
    à la journée : une alerte de retard doit se répéter tant que le retard
    dure, sinon elle ne se voit qu'une fois et le retard s'installe.
    """
    from datetime import timedelta

    from django.db.models import Max

    from core.constants import ROLE_ADMIN, ROLE_PROJECT_MANAGER, ROLE_SUPER_ADMIN
    from core.models import User
    from .models import MaintainedApp

    now = timezone.now()
    today = timezone.localdate()

    apps = (
        MaintainedApp.objects.filter(is_active=True)
        .select_related('assigned_to')
        .annotate(last_report_at=Max('reports__performed_at'))
    )

    fallback_recipient_ids = None  # résolu une seule fois, si nécessaire

    for app in apps:
        per_week = app.expected_reports_per_week
        if not per_week:
            continue

        # Intervalle nominal entre deux passages, plus 1 jour de tolérance
        # pour ne pas alerter sur un décalage de quelques heures.
        interval_days = 7 / per_week
        deadline = now - timedelta(days=interval_days + 1)

        last = app.last_report_at
        if last is not None and last > deadline:
            continue

        if last is None:
            detail = "aucune maintenance n'a encore été enregistrée"
        else:
            detail = f'dernière maintenance le {timezone.localtime(last):%d/%m/%Y}'

        if app.assigned_to_id:
            recipient_ids = [app.assigned_to_id]
        else:
            if fallback_recipient_ids is None:
                fallback_recipient_ids = list(
                    User.objects.filter(
                        is_active=True,
                        roles__name__in=(ROLE_PROJECT_MANAGER, ROLE_ADMIN, ROLE_SUPER_ADMIN),
                    )
                    .values_list('id', flat=True)
                    .distinct()
                )
            recipient_ids = fallback_recipient_ids
            detail += " — aucun technicien n'est assigné à cette application"

        for user_id in recipient_ids:
            already_alerted_today = Notification.objects.filter(
                user_id=user_id,
                notification_type=Notification.NotificationType.FOLLOW_UP,
                entity_type='MaintainedApp',
                entity_id=str(app.pk),
                created_at__date=today,
            ).exists()
            if already_alerted_today:
                continue

            Notification.objects.create(
                user_id=user_id,
                title=f'Maintenance en retard — {app.name}',
                message=(
                    f'La maintenance de « {app.name} » est en retard '
                    f'({app.get_maintenance_frequency_display().lower()}, {detail}).'
                ),
                notification_type=Notification.NotificationType.FOLLOW_UP,
                entity_type='MaintainedApp',
                entity_id=str(app.pk),
                link='/admin/technique/maintenance',
            )
