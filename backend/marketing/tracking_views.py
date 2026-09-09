"""Suivi public d'une demande de projet.

La page « Suivi de projet » du site affichait jusqu'ici une maquette figée —
référence inventée, étapes en dur, dates fictives. Ce module lui donne une
source réelle : l'état de la demande que le client a soumise.

Deux chemins d'accès, pour deux usages :

- **Référence + e-mail** : ce que le client tape sur la page. Les deux sont
  exigés parce qu'une référence seule se devine (SKN-2026-0002 suit
  SKN-2026-0001), et qu'une suite de demandes lisible ne doit pas laisser
  quiconque parcourir le carnet de commandes.
- **Jeton** : le lien direct de l'e-mail de confirmation, qu'on ne devine pas.

Rien d'interne ne sort d'ici : ni score de qualification, ni valeur estimée,
ni commercial assigné. Le client voit où en est sa demande, pas comment nous
la traitons.
"""

import logging

from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from marketing.models import Lead
from marketing.ratelimit import get_client_ip, is_rate_limited

logger = logging.getLogger(__name__)

# Une consultation de suivi est un geste rare : dix par minute et par IP
# laissent large à quelqu'un qui rafraîchit, tout en fermant l'essai
# systématique de références.
TRACKING_RATE_LIMIT = 10
TRACKING_RATE_WINDOW = 60


def _serialize(lead: Lead) -> dict:
    step_index = lead.tracking_step_index
    return {
        'reference': lead.tracking_reference,
        'project_name': lead.company_name or f'{lead.first_name} {lead.last_name}'.strip(),
        'submitted_at': lead.created_at.isoformat(),
        'state_label': lead.tracking_state_label,
        'is_closed': lead.status == Lead.Status.PERDU,
        'steps': [
            {
                'label': label,
                'status': 'done' if i < step_index else 'current' if i == step_index else 'upcoming',
            }
            for i, label in enumerate(Lead.TRACKING_STEPS)
        ],
        'contact_email': lead.email,
        'contact_phone': lead.phone,
    }


class PublicTrackingView(APIView):
    """POST {reference, email} — consultation depuis le formulaire public."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def post(self, request):
        ip = get_client_ip(request)
        if is_rate_limited(f'trackrate:{ip}', TRACKING_RATE_LIMIT, TRACKING_RATE_WINDOW):
            return Response(
                {'detail': 'Trop de requêtes. Réessayez dans une minute.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        reference = (request.data.get('reference') or '').strip().upper()
        email = (request.data.get('email') or '').strip()
        if not reference or not email:
            return Response(
                {'detail': 'Référence et adresse e-mail requises.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lead = Lead.objects.filter(tracking_reference=reference, email__iexact=email).first()
        if lead is None:
            # Un seul message pour « référence inconnue » et « e-mail qui ne
            # correspond pas » : les distinguer confirmerait l'existence d'une
            # référence à qui n'a pas l'e-mail associé.
            return Response(
                {'detail': "Aucune demande ne correspond à cette référence et cette adresse."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_serialize(lead))


class PublicTrackingByTokenView(APIView):
    """GET — lien direct depuis l'e-mail de confirmation."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, token):
        lead = Lead.objects.filter(tracking_token=token).first()
        if lead is None:
            return Response(
                {'detail': 'Lien de suivi invalide ou expiré.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(_serialize(lead))
