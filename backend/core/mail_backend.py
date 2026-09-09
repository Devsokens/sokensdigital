"""Backend e-mail Django adossé à l'API Gmail.

Deux voies d'envoi coexistaient et une seule fonctionnait. `core.notifications`
passait par `core.email_gmail`, tandis que `technique.tasks` et
`administration.tasks` appelaient `django.core.mail.send_mail` — donc le
backend SMTP, qui n'est jamais configuré en production : Render bloque les
ports SMTP sortants sur son offre gratuite, et `EMAIL_HOST` reste vide. Ces
messages partaient dans le backend console, c'est-à-dire nulle part.

Plutôt que de réécrire chaque appelant, on branche `django.core.mail` sur
l'API Gmail. `send_mail`, `EmailMessage` et `EmailMultiAlternatives`
fonctionnent alors normalement — pièces jointes et corps HTML compris, ce qui
manquait à `email_gmail.send_email`, limité au texte brut.

L'objet MIME est celui que Django construit (`EmailMessage.message()`), pas
une reconstruction : en-têtes, encodages, parties alternatives et pièces
jointes sont déjà corrects, et Gmail n'a qu'à transporter le résultat.
"""

import base64
import logging

from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)

GMAIL_SEND_SCOPE = ['https://www.googleapis.com/auth/gmail.send']

# Gmail refuse un message dont le corps encodé dépasse 35 Mo. On s'arrête un
# peu avant : dépasser vaut un rejet de l'API, donc un document non transmis,
# et il vaut mieux le dire à l'appelant que découvrir le silence côté client.
MAX_MESSAGE_BYTES = 33 * 1024 * 1024


def gmail_is_configured() -> bool:
    return bool(
        settings.GMAIL_CLIENT_ID
        and settings.GMAIL_CLIENT_SECRET
        and settings.GMAIL_REFRESH_TOKEN
    )


class GmailAPIBackend(BaseEmailBackend):
    """Envoie via l'API Gmail HTTPS, jamais par SMTP.

    Le service est construit une fois par instance de backend : Django en crée
    une par connexion (`get_connection`), donc un envoi groupé ne repaie pas
    l'échange OAuth à chaque message.
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently, **kwargs)
        self._service = None

    def _build_service(self):
        if self._service is not None:
            return self._service

        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        credentials = Credentials(
            token=None,
            refresh_token=settings.GMAIL_REFRESH_TOKEN,
            client_id=settings.GMAIL_CLIENT_ID,
            client_secret=settings.GMAIL_CLIENT_SECRET,
            token_uri='https://oauth2.googleapis.com/token',
            scopes=GMAIL_SEND_SCOPE,
        )
        self._service = build('gmail', 'v1', credentials=credentials, cache_discovery=False)
        return self._service

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        if not gmail_is_configured():
            # Pas d'exception même sans `fail_silently` : une notification
            # non partie ne doit pas faire échouer l'action métier qui l'a
            # déclenchée, et le compte renvoyé dit déjà que rien n'est parti.
            logger.warning(
                "API Gmail non configurée — %d e-mail(s) non envoyé(s). "
                "Définir GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN.",
                len(email_messages),
            )
            return 0

        sent = 0
        for message in email_messages:
            if self._send(message):
                sent += 1
        return sent

    def _send(self, email_message) -> bool:
        if not email_message.recipients():
            return False
        try:
            mime = email_message.message()
            raw_bytes = mime.as_bytes(linesep='\r\n')
            if len(raw_bytes) > MAX_MESSAGE_BYTES:
                raise ValueError(
                    f'Message de {len(raw_bytes) // (1024 * 1024)} Mo : au-delà de '
                    f'{MAX_MESSAGE_BYTES // (1024 * 1024)} Mo, Gmail le rejette. '
                    'Envoyer un lien de téléchargement plutôt que la pièce jointe.'
                )

            body = {'raw': base64.urlsafe_b64encode(raw_bytes).decode()}
            self._build_service().users().messages().send(userId='me', body=body).execute()
            return True
        except Exception:
            logger.exception(
                'Échec de l\'envoi Gmail vers %s (sujet : %s)',
                ', '.join(email_message.recipients()),
                email_message.subject,
            )
            if not self.fail_silently:
                raise
            return False
