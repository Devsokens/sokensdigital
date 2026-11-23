"""Tâches quotidiennes déclenchées par un planificateur externe.

Aucun worker Celery/beat ne tourne en production (Render ne déploie que le
service web) : un workflow GitHub planifié appelle ce point d'entrée une
fois par jour. Protégé par un secret partagé (en-tête X-Cron-Secret,
variable CRON_SECRET) ; sans secret configuré, le point d'entrée est
désactivé (404)."""
import hmac
import io
import logging
import os

from django.core.management import call_command
from django.http import Http404
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

logger = logging.getLogger(__name__)

DAILY_COMMANDS = ('send_quote_and_invoice_reminders',)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([])
def run_daily_jobs(request):
    expected = os.environ.get('CRON_SECRET', '')
    provided = request.headers.get('X-Cron-Secret', '')
    if not expected:
        raise Http404
    if not hmac.compare_digest(expected.encode(), provided.encode()):
        return Response(status=403)
    results = {}
    for name in DAILY_COMMANDS:
        out = io.StringIO()
        try:
            call_command(name, stdout=out)
            results[name] = out.getvalue().strip() or 'ok'
        except Exception:  # noqa: BLE001 — une tâche en échec ne bloque pas les suivantes
            logger.exception('Tâche quotidienne %s en échec', name)
            results[name] = 'erreur'
    return Response(results)
