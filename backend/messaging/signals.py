"""
Cahier des charges §5.2.A — Initialisation automatique : la création d'un
Département ou d'un Projet déclenche une tâche Celery async qui crée le
salon Firestore correspondant puis synchronise ChannelMetadata/
ChannelParticipant côté PostgreSQL.
"""
from django.db.models.signals import post_save, m2m_changed
from django.dispatch import receiver

from core.celery_utils import safe_dispatch
from core.models import Department
from technique.models import Project


@receiver(post_save, sender=Department)
def department_created(sender, instance, created, **kwargs):
    if created:
        from .tasks import sync_department_channel
        safe_dispatch(sync_department_channel, (str(instance.pk),))


@receiver(post_save, sender=Project)
def project_created(sender, instance, created, **kwargs):
    if created:
        from .tasks import sync_project_channel
        safe_dispatch(sync_project_channel, (str(instance.pk),))


@receiver(m2m_changed, sender=Project.members.through)
def project_members_changed(sender, instance, action, **kwargs):
    """Garde le salon Projet synchronisé quand l'équipe change."""
    if action in ('post_add', 'post_remove', 'post_clear'):
        from .tasks import sync_project_channel
        safe_dispatch(sync_project_channel, (str(instance.pk),))
