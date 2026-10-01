"""Registre des e-mails personnalisables (Paramètres > E-mail).

Chaque entrée déclare un e-mail envoyé par l'application : son libellé, les
variables disponibles et son texte par défaut. Une ligne EmailTemplate de
même clé, éditée depuis l'admin, remplace le sujet et le corps ; sans elle,
le défaut ci-dessous s'applique. Les variables s'écrivent {{nom}}.
"""

import html
import re

from django.utils.html import strip_tags

TEMPLATES = {
    'user_invitation': {
        'label': 'Invitation utilisateur',
        'description': "Envoyé à la création d'un compte plateforme.",
        'variables': {
            'first_name': 'Prénom du destinataire',
            'email': 'Identifiant de connexion',
            'password': 'Mot de passe initial',
        },
        'subject': "Votre accès à la plateforme Soken's Digital",
        'body_html': (
            '<p>Bonjour {{first_name}},</p>'
            "<p>Votre accès à la plateforme Soken's Digital vient d'être créé.</p>"
            '<p>Identifiant : <strong>{{email}}</strong><br>Mot de passe : <strong>{{password}}</strong></p>'
            '<p>Connectez-vous dès maintenant, et pensez à changer ce mot de passe '
            'depuis votre profil une fois connecté(e).</p>'
        ),
    },
    'project_created': {
        'label': 'Projet créé (chef de projet)',
        'description': 'Envoyé au chef de projet à la création du projet.',
        'variables': {
            'first_name': 'Prénom du destinataire',
            'project_name': 'Nom du projet',
            'project_excerpt': 'Extrait de la description du projet',
        },
        'subject': 'Nouveau projet à piloter : {{project_name}}',
        'body_html': (
            '<p>Bonjour {{first_name}},</p>'
            "<p>Le projet « {{project_name}} » vient d'être créé et vous en êtes le chef de projet.</p>"
            '<p>{{project_excerpt}}</p>'
            "<p>Vous pouvez le consulter et commencer à l'organiser dès maintenant.</p>"
        ),
    },
    'project_member_added': {
        'label': 'Ajout à un projet',
        'description': "Envoyé à un membre ajouté à l'équipe d'un projet.",
        'variables': {
            'first_name': 'Prénom du destinataire',
            'project_name': 'Nom du projet',
        },
        'subject': 'Vous rejoignez le projet {{project_name}}',
        'body_html': (
            '<p>Bonjour {{first_name}},</p>'
            "<p>Vous avez été ajouté(e) à l'équipe du projet « {{project_name}} ».</p>"
            '<p>Vous pouvez dès maintenant consulter ses tâches et son avancement.</p>'
        ),
    },
    'task_assigned': {
        'label': 'Tâche assignée',
        'description': "Envoyé quand une tâche est assignée à quelqu'un.",
        'variables': {
            'first_name': 'Prénom du destinataire',
            'task_title': 'Titre de la tâche',
            'project_name': 'Nom du projet',
            'task_excerpt': 'Extrait de la description de la tâche',
            'due_date': 'Échéance (ou « non définie »)',
        },
        'subject': 'Nouvelle tâche assignée : {{task_title}}',
        'body_html': (
            '<p>Bonjour {{first_name}},</p>'
            '<p>La tâche « {{task_title}} » du projet « {{project_name}} » vous a été assignée.</p>'
            '<p>{{task_excerpt}}</p>'
            '<p>Échéance : {{due_date}}.</p>'
        ),
    },
    'lead_acknowledgement': {
        'label': 'Accusé de réception de demande',
        'description': 'Envoyé au demandeur après une demande de projet sur le site.',
        'variables': {
            'first_name': 'Prénom du demandeur',
            'tracking_reference': 'Référence de suivi',
        },
        'subject': 'Votre demande de projet — {{tracking_reference}}',
        'body_html': (
            '<p>Bonjour {{first_name}},</p>'
            '<p>Nous avons bien reçu votre demande de projet et notre équipe la prend en charge.</p>'
            '<p>Votre référence de suivi est <strong>{{tracking_reference}}</strong>. '
            "Conservez-la : elle vous permet de consulter l'avancement à tout moment, "
            "avec l'adresse e-mail utilisée pour cette demande.</p>"
            '<p>Nous revenons vers vous sous 48 heures ouvrées.</p>'
        ),
    },
    'lead_document_received': {
        'label': 'Document de demande reçu',
        'description': "Confirme la réception du document joint à une demande.",
        'variables': {
            'first_name': 'Prénom du demandeur',
            'document_name': 'Nom du document',
            'tracking_reference': 'Référence de suivi',
        },
        'subject': 'Document bien reçu — {{tracking_reference}}',
        'body_html': (
            '<p>Bonjour {{first_name}},</p>'
            '<p>Nous confirmons la réception de votre document « {{document_name}} », '
            'joint à votre demande {{tracking_reference}}.</p>'
            "<p>Notre équipe en tient compte dans l'analyse de votre projet.</p>"
        ),
    },
    'lead_status_update': {
        'label': 'Mise à jour de demande',
        'description': "Envoyé au demandeur quand l'état de sa demande change.",
        'variables': {
            'first_name': 'Prénom du demandeur',
            'tracking_reference': 'Référence de suivi',
            'status': 'Nouvel état de la demande',
        },
        'subject': 'Mise à jour de votre demande — {{tracking_reference}}',
        'body_html': (
            '<p>Bonjour {{first_name}},</p>'
            "<p>Votre demande {{tracking_reference}} a changé d'état : {{status}}.</p>"
        ),
    },
    'ticket_resolved': {
        'label': 'Ticket résolu',
        'description': 'Envoyé au client quand son ticket de support est résolu.',
        'variables': {
            'ticket_title': 'Titre du ticket',
        },
        'subject': 'Ticket résolu — {{ticket_title}}',
        'body_html': (
            '<p>Bonjour,</p>'
            '<p>Votre ticket « {{ticket_title}} » a été marqué comme résolu.</p>'
            '<p>Si le problème persiste, répondez à cet e-mail sous 48h, sinon le '
            'ticket sera automatiquement clôturé.</p>'
            '<p>Cordialement.</p>'
        ),
    },
    'document_expiry': {
        'label': 'Document RH bientôt expiré',
        'description': "Rappel envoyé à un employé dont un document RH arrive à expiration.",
        'variables': {
            'first_name': 'Prénom du destinataire',
            'document_name': 'Nom du document',
            'expiry_date': "Date d'expiration",
        },
        'subject': 'Document bientôt expiré — {{document_name}}',
        'body_html': (
            '<p>Bonjour {{first_name}},</p>'
            '<p>Votre document « {{document_name}} » expire le {{expiry_date}}. '
            'Merci de le renouveler auprès du service RH.</p>'
            '<p>Cordialement.</p>'
        ),
    },
}

_VARIABLE = re.compile(r'\{\{\s*(\w+)\s*\}\}')


def _fill(template: str, context: dict, *, escape_values: bool) -> str:
    def replace(match):
        value = str(context.get(match.group(1), ''))
        return html.escape(value) if escape_values else value
    return _VARIABLE.sub(replace, template)


def html_to_text(body_html: str) -> str:
    text = re.sub(r'(?i)<br\s*/?>', '\n', body_html)
    text = re.sub(r'(?i)</(p|li|h[1-6]|div)>', '\n', text)
    text = html.unescape(strip_tags(text))
    return '\n'.join(line.strip() for line in text.split('\n') if line.strip())


def get_template(key: str) -> tuple[str, str]:
    """(sujet, corps HTML) effectifs : personnalisés s'ils existent, sinon défaut."""
    from core.models import EmailTemplate
    override = EmailTemplate.objects.filter(key=key).first()
    if override:
        return override.subject, override.body_html
    entry = TEMPLATES[key]
    return entry['subject'], entry['body_html']


def render(key: str, context: dict) -> tuple[str, str, str]:
    """Renvoie (sujet, corps texte, corps HTML) prêts à l'envoi."""
    subject_tpl, body_tpl = get_template(key)
    subject = ' '.join(_fill(subject_tpl, context, escape_values=False).split())
    body_html = _fill(body_tpl, context, escape_values=True)
    # Un paragraphe dont la seule variable était vide (extrait absent...)
    # ne doit pas laisser de ligne blanche dans l'e-mail.
    body_html = re.sub(r'<p>\s*</p>', '', body_html)
    return subject, html_to_text(body_html), body_html
