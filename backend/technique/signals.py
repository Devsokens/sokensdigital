"""
Signaux pour le module Technique.

- Project : audit log sur changement de statut, auto actual_end_date
- Task : notification d'assignation, auto phase EN_COURS, auto completed_at
- TimeEntry : recalcul de task.actual_hours
- Ticket : auto-close Celery après 48h
"""
from django.db.models.signals import pre_save, post_save, post_delete
from django.dispatch import receiver
from django.utils import timezone
from django.db import transaction
from django.db.models import Sum

from core.models import AuditLog, Notification
from .models import Project, Task, TimeEntry, Ticket, ProjectStatus


# ---------------------------------------------------------------------------
# Project signals
# ---------------------------------------------------------------------------

@receiver(pre_save, sender=Project)
def project_track_old_status(sender, instance, **kwargs):
    """Sauvegarde l'ancien statut avant modification."""
    if instance.pk:
        try:
            old = Project.objects.get(pk=instance.pk)
            instance._old_status = old.status
        except Project.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None


@receiver(post_save, sender=Project)
def project_status_changed(sender, instance, created, **kwargs):
    """
    Après sauvegarde d'un projet :
    - Si le statut a changé → AuditLog + Notifications
    - Si CLOS ou LIVRE → auto-set actual_end_date
    """
    if created:
        return

    old_status = getattr(instance, '_old_status', None)
    if old_status and old_status != instance.status:
        # AuditLog
        AuditLog.objects.log_action(
            user=instance.project_manager,
            action=f'STATUS_CHANGE:{old_status}->{instance.status}',
            entity_type='Project',
            entity_id=str(instance.pk),
            details={
                'old_status': old_status,
                'new_status': instance.status,
                'project_name': instance.name,
            },
        )

        # Auto actual_end_date
        if instance.status in [ProjectStatus.CLOS, ProjectStatus.LIVRE]:
            if not instance.actual_end_date:
                Project.objects.filter(pk=instance.pk).update(
                    actual_end_date=timezone.now().date()
                )

        # Notifications aux membres du projet
        with transaction.atomic():
            members = instance.members.all()
            notifications = []
            for member in members:
                notifications.append(Notification(
                    user=member,
                    title=f'Projet {instance.name} : changement de statut',
                    message=f'Le statut du projet est passé de {old_status} à {instance.status}.',
                    notification_type=Notification.NotificationType.PROJECT_STATUS,
                    entity_type='Project',
                    entity_id=str(instance.pk),
                ))
            if notifications:
                Notification.objects.bulk_create(notifications)


# ---------------------------------------------------------------------------
# Task signals
# ---------------------------------------------------------------------------

@receiver(pre_save, sender=Task)
def task_track_changes(sender, instance, **kwargs):
    """Sauvegarde l'ancien statut et l'ancien assigné avant modification."""
    if instance.pk:
        try:
            old = Task.objects.get(pk=instance.pk)
            instance._old_status = old.status
            instance._old_assigned_to_id = old.assigned_to_id
        except Task.DoesNotExist:
            instance._old_status = None
            instance._old_assigned_to_id = None
    else:
        instance._old_status = None
        instance._old_assigned_to_id = None


@receiver(post_save, sender=Task)
def task_post_save_handler(sender, instance, created, **kwargs):
    """
    Après sauvegarde d'une tâche :
    - Assignation changée → notification au nouvel assigné
    - Status → IN_PROGRESS → phase passe à EN_COURS si A_FAIRE
    - Status → DONE → auto completed_at
    """
    old_status = getattr(instance, '_old_status', None)
    old_assigned_id = getattr(instance, '_old_assigned_to_id', None)

    # Notification d'assignation
    if (instance.assigned_to_id
            and instance.assigned_to_id != old_assigned_id):
        with transaction.atomic():
            Notification.objects.create(
                user=instance.assigned_to,
                title='Nouvelle tâche assignée',
                message=f'Vous avez été assigné à la tâche : {instance.name}',
                notification_type=Notification.NotificationType.TASK_ASSIGNED,
                entity_type='Task',
                entity_id=str(instance.pk),
            )

    # Passage à IN_PROGRESS → phase passe EN_COURS
    if (old_status and old_status != instance.status
            and instance.status == 'IN_PROGRESS'
            and instance.phase
            and instance.phase.status == 'A_FAIRE'):
        instance.phase.status = 'EN_COURS'
        instance.phase.save(update_fields=['status', 'updated_at'])

    # Passage à DONE → auto completed_at
    if (old_status and old_status != instance.status
            and instance.status == 'DONE'
            and not instance.completed_at):
        Task.objects.filter(pk=instance.pk).update(
            completed_at=timezone.now()
        )


# ---------------------------------------------------------------------------
# TimeEntry signals
# ---------------------------------------------------------------------------

@receiver(post_save, sender=TimeEntry)
@receiver(post_delete, sender=TimeEntry)
def recalculate_task_actual_hours(sender, instance, **kwargs):
    """Recalcule le champ actual_hours de la tâche parente."""
    try:
        task = instance.task
        total = task.time_entries.aggregate(
            total_hours=Sum('hours')
        )['total_hours'] or 0
        Task.objects.filter(pk=task.pk).update(actual_hours=total)
    except Task.DoesNotExist:
        pass


# ---------------------------------------------------------------------------
# Ticket signals
# ---------------------------------------------------------------------------

@receiver(pre_save, sender=Ticket)
def ticket_track_old_status(sender, instance, **kwargs):
    """Sauvegarde l'ancien statut avant modification."""
    if instance.pk:
        try:
            old = Ticket.objects.get(pk=instance.pk)
            instance._old_status = old.status
        except Ticket.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None


@receiver(post_save, sender=Ticket)
def ticket_resolved_handler(sender, instance, created, **kwargs):
    """
    Quand un ticket passe à RESOLVED :
    - Programme la fermeture auto après 48h (Celery)
    - Placeholder pour l'email de confirmation client
    """
    if created:
        return

    old_status = getattr(instance, '_old_status', None)
    if old_status and old_status != instance.status and instance.status == 'RESOLVED':
        from .tasks import auto_close_ticket
        auto_close_ticket.apply_async(
            (str(instance.pk),),
            countdown=48 * 3600,  # 48 heures
        )
