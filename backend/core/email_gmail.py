import base64
import logging
from email.mime.text import MIMEText

from django.conf import settings

logger = logging.getLogger(__name__)

GMAIL_SEND_SCOPE = ['https://www.googleapis.com/auth/gmail.send']


def _get_service():
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials(
        token=None,
        refresh_token=settings.GMAIL_REFRESH_TOKEN,
        client_id=settings.GMAIL_CLIENT_ID,
        client_secret=settings.GMAIL_CLIENT_SECRET,
        token_uri='https://oauth2.googleapis.com/token',
        scopes=GMAIL_SEND_SCOPE,
    )
    return build('gmail', 'v1', credentials=creds, cache_discovery=False)


def send_email(to: str, subject: str, body: str) -> None:
    """Sends a plain-text email via the Gmail API using a pre-authorized
    refresh token (see scripts/generate_gmail_refresh_token.py for the
    one-time setup) — chosen over SMTP because Render blocks outbound SMTP
    ports on its free plan, while the Gmail API talks HTTPS like any other
    external API call this backend already makes.

    Swallow-and-log: a missed email must never fail the caller's real work
    (a reminder email failing shouldn't block the in-app notification or
    whatever business action triggered it) — same reasoning as
    core.firestore_client's write helpers.
    """
    if not (settings.GMAIL_CLIENT_ID and settings.GMAIL_CLIENT_SECRET and settings.GMAIL_REFRESH_TOKEN):
        logger.warning('Gmail API not configured — skipping email to %s', to)
        return
    try:
        message = MIMEText(body)
        message['to'] = to
        message['from'] = settings.GMAIL_SENDER_EMAIL or 'me'
        message['subject'] = subject
        raw = base64.urlsafe_b64encode(message.as_bytes()).decode()
        _get_service().users().messages().send(userId='me', body={'raw': raw}).execute()
    except Exception:
        logger.exception('Could not send email to %s', to)
