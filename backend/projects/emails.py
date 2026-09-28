"""E-mails adressés aux membres et chefs de projet — création de projet,
assignation de tâche. Même pattern que marketing/emails.py : texte brut +
lien d'action, via core.mailer.send_mail (l'unique point d'entrée e-mail de
l'application, voir docs/NOTIFICATIONS_ET_EMAILS.md).

Un e-mail par destinataire plutôt qu'un envoi groupé : ça évite d'exposer
l'adresse de chacun aux autres destinataires (visible dans un "À" partagé),
et ça laisse chaque message rester bref et personnel — deux points qui
comptent aussi pour la délivrabilité (un message qui ressemble à un envoi de
masse est davantage susceptible d'être classé indésirable qu'un message à un
seul destinataire nommé)."""

import logging

from django.conf import settings
from django.utils.html import strip_tags

from core import mailer

logger = logging.getLogger(__name__)


def _project_url(project) -> str:
    return f'{settings.PUBLIC_SITE_URL}/admin/technique/projets/{project.id}'


def _plain_excerpt(html: str, max_length: int = 400) -> str:
    """Description Tiptap (HTML) → texte brut pour le corps de l'e-mail —
    sans ça, les balises s'afficheraient littéralement dans le message."""
    text = strip_tags(html or '').strip()
    return text[:max_length] + ('…' if len(text) > max_length else '')


def send_project_created_email(project, *, to_user) -> bool:
    """Prévient un chef de projet que le projet lui a été confié.

    Sujet et corps délibérément sobres et nommés — un objet générique ou
    ponctué à l'excès ("!!!", tout en majuscules) est un des signaux que les
    filtres anti-spam pondèrent, indépendamment de l'expéditeur."""
    if not to_user.email:
        return False
    excerpt = _plain_excerpt(project.description)
    body = (
        f'Bonjour {to_user.first_name},\n'
        f'Le projet « {project.name} » vient d\'être créé et vous en êtes le chef de projet.\n'
        + (f'\n{excerpt}\n' if excerpt else '')
        + 'Vous pouvez le consulter et commencer à l\'organiser dès maintenant.'
    )
    return mailer.send_mail(
        to_user.email,
        f'Nouveau projet à piloter : {project.name}',
        body,
        action_url=_project_url(project),
        action_label='Voir le projet',
    )


def send_project_member_added_email(project, *, to_user) -> bool:
    """Prévient un membre qu'il vient d'être ajouté à l'équipe d'un projet."""
    if not to_user.email:
        return False
    body = (
        f'Bonjour {to_user.first_name},\n'
        f'Vous avez été ajouté(e) à l\'équipe du projet « {project.name} ».\n'
        'Vous pouvez dès maintenant consulter ses tâches et son avancement.'
    )
    return mailer.send_mail(
        to_user.email,
        f'Vous rejoignez le projet {project.name}',
        body,
        action_url=_project_url(project),
        action_label='Voir le projet',
    )


def send_task_assigned_email(task, *, to_user) -> bool:
    """Prévient un utilisateur qu'une tâche lui a été assignée."""
    if not to_user.email:
        return False
    excerpt = _plain_excerpt(task.description)
    body = (
        f'Bonjour {to_user.first_name},\n'
        f'La tâche « {task.title} » du projet « {task.project.name} » vous a été assignée.\n'
        + (f'\n{excerpt}\n' if excerpt else '')
        + (f'Échéance : {task.due_date.strftime("%d/%m/%Y")}.' if task.due_date else '')
    )
    return mailer.send_mail(
        to_user.email,
        f'Nouvelle tâche assignée : {task.title}',
        body.strip(),
        action_url=_project_url(task.project),
        action_label='Voir la tâche',
    )
