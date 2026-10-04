"""Notifications du module projets : pour chaque événement, notification
in-app + push (core.notifications.notify) et, pour les assignations,
l'e-mail personnalisable (projects.emails, Paramètres > E-mail).

On ne se notifie jamais soi-même : s'assigner une tâche ou se désigner chef
de son propre projet ne déclenche rien.
"""

from core.notifications import notify
from projects.emails import (
    send_project_created_email, send_project_member_added_email, send_task_assigned_email,
)


def _project_link(project):
    return f'/admin/technique/projets/{project.id}'


def _is_actor(user, actor):
    return actor is not None and user is not None and user.pk == actor.pk


def notify_project_lead_assigned(project, *, to_user, actor=None):
    """Chef de projet désigné (à la création ou par changement de chef)."""
    if to_user is None or _is_actor(to_user, actor):
        return
    notify(
        user=to_user,
        title='Projet confié',
        message=f'Vous êtes chef de projet de « {project.name} ».',
        notification_type='PROJECT_UPDATE',
        link=_project_link(project),
    )
    send_project_created_email(project, to_user=to_user)


def notify_project_member_added(project, *, to_user, actor=None):
    if _is_actor(to_user, actor):
        return
    notify(
        user=to_user,
        title='Ajout à un projet',
        message=f'Vous avez été ajouté(e) à l\'équipe du projet « {project.name} ».',
        notification_type='PROJECT_UPDATE',
        link=_project_link(project),
    )
    send_project_member_added_email(project, to_user=to_user)


def notify_task_assigned(task, *, to_user, actor=None):
    if _is_actor(to_user, actor):
        return
    notify(
        user=to_user,
        title='Nouvelle tâche assignée',
        message=f'« {task.title} » — projet {task.project.name}.',
        notification_type='TASK_ASSIGNED',
        link=_project_link(task.project),
    )
    send_task_assigned_email(task, to_user=to_user)


def notify_task_comment(task, *, author):
    """Nouveau message sur une tâche : ses assignés sont prévenus (in-app +
    push, pas d'e-mail — une discussion active en enverrait des dizaines)."""
    author_name = f'{author.first_name} {author.last_name}'.strip() or author.email
    for user in task.assignees.all():
        if _is_actor(user, author):
            continue
        notify(
            user=user,
            title=f'Nouveau message — {task.title}',
            message=f'{author_name} a écrit sur la tâche « {task.title} ».',
            notification_type='TASK_COMMENT',
            link=_project_link(task.project),
        )
