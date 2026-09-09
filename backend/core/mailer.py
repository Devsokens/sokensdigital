"""Envoi d'e-mails de l'application — texte, HTML et pièces jointes.

Passe par `django.core.mail`, donc par le backend choisi dans les réglages
(API Gmail en production, console en dev). Rien n'appelle l'API Gmail
directement : le backend est le seul point qui la connaît, ce qui laisse la
possibilité de basculer vers un SMTP ou un autre fournisseur sans toucher aux
appelants.

L'envoi ne remonte jamais d'exception. Un e-mail manqué ne doit pas faire
échouer l'action métier qui l'a déclenché — une facture validée reste validée
même si son accusé de réception ne part pas — et la trace reste dans les logs
(et dans Sentry, qui capture les `logger.exception`).
"""

import logging
from dataclasses import dataclass

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.utils.html import escape

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class Attachment:
    """Pièce jointe : nom affiché, contenu, type MIME.

    Le type est fourni par l'appelant plutôt que deviné du nom : c'est lui
    qui sait ce qu'il a produit (un PDF WeasyPrint, un CSV d'export), et
    déduire du nom rejouerait la faiblesse corrigée sur les téléversements.
    """

    filename: str
    content: bytes
    mimetype: str = 'application/pdf'


def _html_document(title: str, body: str, action_url: str | None, action_label: str | None) -> str:
    """Gabarit HTML minimal, en styles inline.

    Les clients de messagerie ignorent `<style>` et les feuilles externes ;
    tout ce qui n'est pas inline est perdu. On reste donc sur une mise en page
    sobre plutôt que sur une maquette qui se déferait chez la moitié des
    destinataires.
    """
    paragraphs = ''.join(
        f'<p style="margin:0 0 14px;line-height:1.6;color:#1f2430;">{escape(line)}</p>'
        for line in body.split('\n')
        if line.strip()
    )
    button = ''
    if action_url and action_label:
        button = (
            f'<p style="margin:26px 0 0;">'
            f'<a href="{escape(action_url)}" '
            f'style="display:inline-block;background:#0e121a;color:#ffffff;'
            f'text-decoration:none;padding:12px 22px;border-radius:8px;'
            f'font-weight:600;font-size:14px;">{escape(action_label)}</a></p>'
        )
    return (
        '<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,'
        'Roboto,Helvetica,Arial,sans-serif;background:#f5f6f8;padding:28px 12px;">'
        '<div style="max-width:560px;margin:0 auto;background:#ffffff;'
        'border-radius:14px;padding:30px 28px;">'
        f'<h1 style="margin:0 0 18px;font-size:19px;color:#0e121a;">{escape(title)}</h1>'
        f'{paragraphs}{button}'
        '<p style="margin:28px 0 0;padding-top:18px;border-top:1px solid #e8eaee;'
        'font-size:12px;color:#8b909c;">Soken\'s Digital</p>'
        '</div></div>'
    )


def send_mail(
    to: str | list[str],
    subject: str,
    body: str,
    *,
    attachments: list[Attachment] | None = None,
    action_url: str | None = None,
    action_label: str | None = None,
    reply_to: str | None = None,
) -> bool:
    """Envoie un e-mail texte + HTML. Renvoie True si l'envoi a abouti.

    `body` est écrit en texte brut, avec un saut de ligne par paragraphe : la
    version HTML en est dérivée. Écrire les deux séparément les ferait diverger
    à la première correction.
    """
    recipients = [to] if isinstance(to, str) else list(to)
    recipients = [address for address in recipients if address]
    if not recipients:
        return False

    try:
        message = EmailMultiAlternatives(
            subject=subject,
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=recipients,
            reply_to=[reply_to] if reply_to else None,
        )
        message.attach_alternative(
            _html_document(subject, body, action_url, action_label), 'text/html',
        )
        for attachment in attachments or []:
            message.attach(attachment.filename, attachment.content, attachment.mimetype)

        return message.send(fail_silently=False) > 0
    except Exception:
        logger.exception('Envoi e-mail impossible vers %s (sujet : %s)', recipients, subject)
        return False
