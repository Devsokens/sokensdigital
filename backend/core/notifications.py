import logging

from core import firestore_client, mailer, push

logger = logging.getLogger(__name__)


def notify(
    user,
    title: str,
    message: str,
    notification_type: str,
    link: str | None = None,
    email: bool = False,
    push_notification: bool = True,
) -> None:
    """Point d'entrée unique des notifications inter-départements.

    Trois canaux, indépendants les uns des autres :

    - **In-app** (Firestore) — toujours. C'est la cloche de `admin-header.tsx`,
      et l'historique consultable.
    - **Push navigateur** — par défaut, si l'utilisateur a autorisé au moins un
      appareil. Sans appareil enregistré, l'appel ne coûte rien.
    - **E-mail** — sur demande explicite de l'appelant, parce qu'un e-mail
      s'adresse à quelqu'un qui n'est pas devant l'application ; l'envoyer à
      chaque événement le rendrait ignoré.

    L'échec d'un canal n'empêche pas les autres : une notification perdue vaut
    mieux que trois, et aucune ne doit faire échouer l'action métier qui l'a
    déclenchée.
    """
    if user.firebase_uid:
        firestore_client.create_notification(user.firebase_uid, title, message, notification_type, link)

    if push_notification:
        try:
            push.send_to_user(user, title, message, link=link)
        except Exception:
            logger.exception('Notification push impossible pour %s', user.pk)

    if email and user.email:
        mailer.send_mail(user.email, title, message)
