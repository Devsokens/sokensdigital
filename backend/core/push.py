"""Notifications push, via Firebase Cloud Messaging.

FCM plutôt que Web Push brut : le projet parle déjà à Firebase (Auth,
Firestore), `firebase-admin` est déjà installé et initialisé au démarrage
(`core.apps.CoreConfig.ready`), et FCM couvre d'un seul appel le navigateur,
Android et iOS — là où le Web Push natif demanderait de gérer soi-même les
clés VAPID, le chiffrement de la charge utile et les particularités de chaque
service de poussée.

Rien ici ne lève : l'échec d'une notification ne doit pas faire échouer
l'action métier qui l'a déclenchée. Les jetons que FCM déclare morts sont
supprimés au passage, sans quoi chaque envoi ultérieur les retenterait.
"""

import logging

from django.utils import timezone

logger = logging.getLogger(__name__)

# Au-delà, FCM rejette le message entier. On tronque plutôt que de perdre la
# notification : un titre coupé reste utile, une notification absente non.
MAX_TITLE = 120
MAX_BODY = 400


def _truncate(text: str, limit: int) -> str:
    text = (text or '').strip()
    return text if len(text) <= limit else text[: limit - 1] + '…'


def send_to_user(user, title: str, body: str, link: str | None = None) -> int:
    """Pousse une notification sur tous les appareils de l'utilisateur.

    Renvoie le nombre d'appareils atteints. Zéro est un cas normal — personne
    n'a encore autorisé les notifications sur cet appareil — et non une erreur.
    """
    from core.models import PushDevice

    devices = list(PushDevice.objects.filter(user=user))
    if not devices:
        return 0

    try:
        import firebase_admin
        from firebase_admin import messaging
    except ImportError:
        logger.warning('firebase-admin absent — notification push ignorée')
        return 0

    if not firebase_admin._apps:
        logger.warning('Firebase non initialisé — notification push ignorée')
        return 0

    # `data` et non `notification` : avec une charge utile `notification`, le
    # navigateur affiche la notification lui-même et le service worker ne voit
    # rien, ce qui nous prive du clic vers le bon écran. En data-only, c'est
    # `sw.js` qui décide, sur toutes les plateformes de la même façon.
    payload = {
        'title': _truncate(title, MAX_TITLE),
        'body': _truncate(body, MAX_BODY),
        'link': link or '/admin',
    }

    sent = 0
    dead_tokens = []
    for device in devices:
        try:
            messaging.send(messaging.Message(data=payload, token=device.token))
            sent += 1
        except messaging.UnregisteredError:
            # L'appareil a désinstallé l'app, vidé son stockage, ou Firebase a
            # fait tourner le jeton : il ne reviendra pas.
            dead_tokens.append(device.token)
        except Exception:
            logger.exception('Envoi push échoué pour l\'appareil %s', device.pk)

    if dead_tokens:
        PushDevice.objects.filter(token__in=dead_tokens).delete()
        logger.info('%d jeton(s) push périmé(s) supprimé(s)', len(dead_tokens))

    if sent:
        PushDevice.objects.filter(user=user).exclude(token__in=dead_tokens).update(
            last_seen_at=timezone.now(),
        )
    return sent
