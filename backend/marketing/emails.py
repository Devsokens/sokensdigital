"""E-mails adressés aux demandeurs et clients du site public."""

import logging

from django.conf import settings

from core import mailer

logger = logging.getLogger(__name__)


def send_lead_acknowledgement(lead) -> bool:
    """Accusé de réception d'une demande de projet.

    Porte la référence de suivi et le lien direct vers la page de suivi. Sans
    cet e-mail, le client n'a aucun moyen de connaître sa référence, et la
    page de suivi reste inutilisable — c'est la seule fois où elle lui est
    communiquée.
    """
    tracking_url = f'{settings.PUBLIC_SITE_URL}/suivi-projet?t={lead.tracking_token}'
    body = (
        f'Bonjour {lead.first_name},\n'
        'Nous avons bien reçu votre demande de projet et notre équipe la prend en charge.\n'
        f'Votre référence de suivi est {lead.tracking_reference}. '
        'Conservez-la : elle vous permet de consulter l\'avancement à tout moment, '
        'avec l\'adresse e-mail utilisée pour cette demande.\n'
        'Nous revenons vers vous sous 48 heures ouvrées.'
    )
    return mailer.send_mail(
        lead.email,
        f'Votre demande de projet — {lead.tracking_reference}',
        body,
        action_url=tracking_url,
        action_label='Suivre ma demande',
    )


def send_lead_document_received(lead, document_name: str) -> bool:
    """Confirme la bonne réception du document joint à une demande.

    Le cahier des charges part dans un second appel, après la création de la
    demande (la référence de suivi n'existe qu'une fois celle-ci enregistrée,
    voir PublicLeadAttachmentUploadView) : l'accusé de réception initial est
    donc déjà envoyé quand le fichier arrive, et ne peut pas le mentionner.
    Sans ce second message, le client n'a aucune confirmation que sa pièce
    est bien arrivée — or c'est souvent la partie du dossier à laquelle il
    tient le plus.
    """
    tracking_url = f'{settings.PUBLIC_SITE_URL}/suivi-projet?t={lead.tracking_token}'
    body = (
        f'Bonjour {lead.first_name},\n'
        f'Nous confirmons la réception de votre document « {document_name} », '
        f'joint à votre demande {lead.tracking_reference}.\n'
        "Notre équipe en tient compte dans l'analyse de votre projet."
    )
    return mailer.send_mail(
        lead.email,
        f'Document bien reçu — {lead.tracking_reference}',
        body,
        action_url=tracking_url,
        action_label='Suivre ma demande',
    )


def send_lead_status_update(lead) -> bool:
    """Prévient le demandeur que l'état de sa demande a changé.

    Appelé depuis la mise à jour du lead côté back-office. Le client n'a pas
    à surveiller la page de suivi pour apprendre qu'on a avancé.
    """
    tracking_url = f'{settings.PUBLIC_SITE_URL}/suivi-projet?t={lead.tracking_token}'
    body = (
        f'Bonjour {lead.first_name},\n'
        f'Votre demande {lead.tracking_reference} a changé d\'état : '
        f'{lead.tracking_state_label}.'
    )
    return mailer.send_mail(
        lead.email,
        f'Mise à jour de votre demande — {lead.tracking_reference}',
        body,
        action_url=tracking_url,
        action_label='Voir le détail',
    )


def send_document_to_client(
    *, to: str, recipient_name: str, subject: str, message: str, attachments,
) -> bool:
    """Transmet un ou plusieurs documents à un interlocuteur externe.

    Le point d'entrée pour envoyer devis, cahier des charges ou facture à
    quelqu'un qui n'a pas de compte : la pièce jointe part par e-mail, sans
    exiger de lui qu'il se connecte à un espace.
    """
    body = f'Bonjour {recipient_name},\n{message}'
    return mailer.send_mail(to, subject, body, attachments=attachments)
