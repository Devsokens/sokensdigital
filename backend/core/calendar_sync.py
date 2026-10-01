"""Synchro Google Calendar des rendez-vous (module Agenda).

Chaque rendez-vous est reflété en événement sur le calendrier principal du
compte Google expéditeur (le même compte OAuth que l'envoi d'e-mails — voir
core/mail_backend.py). `sendUpdates='all'` fait envoyer par Google les
invitations, mises à jour et annulations aux participants : aucun e-mail de
notification n'est construit par nous.

Même philosophie que core.mailer : la synchro ne remonte jamais d'exception
(un rendez-vous enregistré reste enregistré même si Google est injoignable),
et ne fait rien tant que les réglages GMAIL_* sont absents.

IMPORTANT : le refresh token doit avoir été généré avec la portée
calendar.events en plus de gmail.send — relancer
scripts/generate_gmail_refresh_token.py après avoir activé l'API Google
Calendar dans la console Cloud, puis mettre à jour GMAIL_REFRESH_TOKEN.
"""

import logging

from django.conf import settings

logger = logging.getLogger(__name__)

CALENDAR_SCOPE = ['https://www.googleapis.com/auth/calendar.events']


def calendar_is_configured() -> bool:
    return bool(
        settings.GMAIL_CLIENT_ID
        and settings.GMAIL_CLIENT_SECRET
        and settings.GMAIL_REFRESH_TOKEN
    )


def _service():
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    credentials = Credentials(
        token=None,
        refresh_token=settings.GMAIL_REFRESH_TOKEN,
        client_id=settings.GMAIL_CLIENT_ID,
        client_secret=settings.GMAIL_CLIENT_SECRET,
        token_uri='https://oauth2.googleapis.com/token',
        scopes=CALENDAR_SCOPE,
    )
    return build('calendar', 'v3', credentials=credentials, cache_discovery=False)


def _attendee_emails(appointment) -> list[str]:
    """Participants plateforme + e-mail de la fiche client, dédupliqués.

    Le compte expéditeur est l'organisateur : l'exclure évite qu'il reçoive
    une invitation pour son propre événement."""
    organizer = (settings.GMAIL_SENDER_EMAIL or '').lower()
    emails = {
        email.lower()
        for email in [
            *appointment.attendees.values_list('email', flat=True),
            appointment.client.email if appointment.client else '',
        ]
        if email
    }
    emails.discard(organizer)
    return sorted(emails)


def _event_body(appointment) -> dict:
    body = {
        'summary': appointment.title,
        'location': appointment.location,
        'description': appointment.description,
        'start': {'dateTime': appointment.start_at.isoformat()},
        'end': {'dateTime': appointment.end_at.isoformat()},
        'attendees': [{'email': email} for email in _attendee_emails(appointment)],
    }
    return {key: value for key, value in body.items() if value}


def sync_appointment_event(appointment) -> None:
    """Crée ou met à jour l'événement miroir — Google notifie les participants."""
    if not calendar_is_configured():
        return
    from googleapiclient.errors import HttpError

    try:
        service = _service()
        body = _event_body(appointment)
        if appointment.google_event_id:
            try:
                service.events().patch(
                    calendarId='primary', eventId=appointment.google_event_id,
                    body=body, sendUpdates='all',
                ).execute()
                return
            except HttpError as exc:
                # Événement supprimé côté Google entre-temps : on le recrée.
                if exc.resp.status != 404:
                    raise
        event = service.events().insert(
            calendarId='primary', body=body, sendUpdates='all',
        ).execute()
        # Update direct plutôt que appointment.save() : pas de re-déclenchement
        # de synchro, pas d'écrasement des autres champs modifiés entre-temps.
        type(appointment).objects.filter(pk=appointment.pk).update(google_event_id=event['id'])
    except Exception:
        logger.exception('Synchro Google Calendar impossible (rendez-vous %s)', appointment.pk)


def delete_appointment_event(appointment) -> None:
    """Supprime l'événement miroir — Google envoie l'annulation aux participants."""
    if not appointment.google_event_id or not calendar_is_configured():
        return
    from googleapiclient.errors import HttpError

    try:
        _service().events().delete(
            calendarId='primary', eventId=appointment.google_event_id, sendUpdates='all',
        ).execute()
    except HttpError as exc:
        if exc.resp.status != 404:
            logger.exception('Suppression Google Calendar impossible (rendez-vous %s)', appointment.pk)
    except Exception:
        logger.exception('Suppression Google Calendar impossible (rendez-vous %s)', appointment.pk)
