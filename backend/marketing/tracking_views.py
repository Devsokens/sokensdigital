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

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.storage import upload_project_request_document
from marketing.models import Lead
from marketing.ratelimit import get_client_ip, is_rate_limited

logger = logging.getLogger(__name__)


def _lookup_by_reference_and_email(reference: str, email: str) -> Lead | None:
    """Identifiant public d'une demande : référence + e-mail, jamais l'un
    sans l'autre. Utilisé par le suivi ET par l'upload de pièce jointe —
    deux usages, un seul point qui décide ce qui identifie une demande."""
    return Lead.objects.filter(tracking_reference=reference, email__iexact=email).first()

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

        lead = _lookup_by_reference_and_email(reference, email)
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


# Une consultation exceptionnelle : au plus une par demande, juste après sa
# soumission. Plus large que TRACKING_RATE_LIMIT (déjà 10/min) n'aurait pas
# de sens ; plus étroit non plus, ce n'est pas le geste répété qu'on redoute
# ici mais le harcèlement d'un formulaire par script.
ATTACHMENT_RATE_LIMIT = 10
ATTACHMENT_RATE_WINDOW = 60


class PublicLeadAttachmentUploadView(APIView):
    """Joint un PDF à une demande de projet déjà soumise.

    Séparée de `PublicLeadCreateView` : la demande est créée en JSON (voir
    marketing.views), et son `tracking_reference` n'existe qu'une fois
    l'enregistrement fait. La pièce jointe arrive donc dans un second
    appel — après la création, si le visiteur en avait une à joindre.

    Référence + e-mail comme identifiant, exactement comme le suivi : ce
    sont les deux informations que le formulaire connaît déjà à cet instant,
    sans exposer le jeton de suivi (réservé au lien de l'e-mail).
    """

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        ip = get_client_ip(request)
        if is_rate_limited(f'leadattachrate:{ip}', ATTACHMENT_RATE_LIMIT, ATTACHMENT_RATE_WINDOW):
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

        lead = _lookup_by_reference_and_email(reference, email)
        if lead is None:
            return Response(
                {'detail': "Aucune demande ne correspond à cette référence et cette adresse."},
                status=status.HTTP_404_NOT_FOUND,
            )

        uploaded = request.FILES.get('file')
        if not uploaded:
            return Response({'detail': 'Aucun fichier fourni.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            url = upload_project_request_document(uploaded, lead.tracking_reference)
        except DjangoValidationError as exc:
            return Response({'detail': exc.messages[0]}, status=status.HTTP_400_BAD_REQUEST)
        except RuntimeError as exc:
            logger.exception('Upload de pièce jointe échoué pour %s', lead.tracking_reference)
            return Response({'detail': str(exc)}, status=status.HTTP_502_BAD_GATEWAY)

        # Autorisé à écraser une pièce déjà jointe : un réessai après un
        # échec réseau ne doit pas être bloqué par sa propre tentative
        # précédente. L'ancien fichier reste orphelin dans le bucket, sans
        # conséquence — un PDF de quelques Mo, jamais référencé nulle part.
        lead.attachment_url = url
        lead.attachment_name = uploaded.name[:255]
        lead.save(update_fields=['attachment_url', 'attachment_name'])

        return Response(
            {'attachment_name': lead.attachment_name, 'attachment_url': lead.attachment_url},
            status=status.HTTP_201_CREATED,
        )
