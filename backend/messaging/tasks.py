from celery import shared_task

from core.firestore_client import upsert_chat_room, set_chat_room_members
from core.models import Department, User
from technique.models import Project

from .models import ChannelMetadata, ChannelParticipant


@shared_task
def sync_department_channel(department_id):
    """
    Crée/rafraîchit le salon Firestore + la gouvernance PostgreSQL d'un
    canal Département. Membres = tout utilisateur actif de ce département
    (cahier des charges §5.3.B — "le backend vérifie l'appartenance de
    l'utilisateur au département").
    """
    try:
        department = Department.objects.get(pk=department_id)
    except Department.DoesNotExist:
        return

    firestore_id = f'dept-{department_id}'
    channel, _ = ChannelMetadata.objects.update_or_create(
        firestore_conversation_id=firestore_id,
        defaults={
            'name': department.name,
            'type': ChannelMetadata.ChannelType.DEPARTMENT,
            'department': department,
            'project': None,
            'is_private': False,
        },
    )

    member_ids = list(
        User.objects.filter(department_id=department_id, is_active=True).values_list('id', flat=True)
    )
    _sync_participants(channel, member_ids)

    upsert_chat_room(firestore_id, {
        'name': department.name,
        'type': 'department_channel',
        'participants': [str(uid) for uid in member_ids],
    })
    set_chat_room_members(firestore_id, [str(uid) for uid in member_ids])


@shared_task
def sync_project_channel(project_id):
    """
    Crée/rafraîchit le salon Firestore + la gouvernance PostgreSQL d'un
    canal Projet. Membres = équipe du projet (Project.members, qui inclut
    déjà le chef de projet — cf. ProjectViewSet.perform_create).
    """
    try:
        project = Project.objects.select_related('project_manager').get(pk=project_id)
    except Project.DoesNotExist:
        return

    firestore_id = f'project-{project_id}'
    channel, _ = ChannelMetadata.objects.update_or_create(
        firestore_conversation_id=firestore_id,
        defaults={
            'name': project.name,
            'type': ChannelMetadata.ChannelType.PROJECT,
            'department': None,
            'project': project,
            'is_private': True,
        },
    )

    member_ids = list(project.members.values_list('id', flat=True))
    _sync_participants(channel, member_ids)

    upsert_chat_room(firestore_id, {
        'name': project.name,
        'type': 'project_channel',
        'participants': [str(uid) for uid in member_ids],
    })
    set_chat_room_members(firestore_id, [str(uid) for uid in member_ids])


def _sync_participants(channel, member_ids):
    """Aligne ChannelParticipant sur la liste d'IDs fournie (ajoute les
    manquants, retire ceux qui ne sont plus membres)."""
    existing_ids = set(
        ChannelParticipant.objects.filter(channel=channel).values_list('user_id', flat=True)
    )
    target_ids = set(member_ids)

    to_add = target_ids - existing_ids
    to_remove = existing_ids - target_ids

    if to_add:
        ChannelParticipant.objects.bulk_create([
            ChannelParticipant(channel=channel, user_id=uid) for uid in to_add
        ], ignore_conflicts=True)
    if to_remove:
        ChannelParticipant.objects.filter(channel=channel, user_id__in=to_remove).delete()
