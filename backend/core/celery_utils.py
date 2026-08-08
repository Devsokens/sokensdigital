"""
Dispatch Celery défensif — utilisé par tous les signaux post_save qui
déclenchent une tâche async depuis l'intérieur d'une transaction métier
(changement de statut, création d'entité, etc.).

``task.apply_async()`` ouvre une connexion au broker immédiatement ; sans
Redis joignable (tests, CI, dev sans docker-compose up, ou un vrai
incident Redis en prod) elle lève une exception SYNCHRONE qui remonte
jusqu'à l'appelant — un simple ``Project.objects.create()`` dans un test,
ou une requête utilisateur normale, planterait alors uniquement parce que
la notification asynchrone n'a pas pu partir. C'est un mode de panne pire
que "la notification est juste en retard" : même principe que
core.firestore_client (fail open, logger, ne jamais bloquer l'opération
qui possède réellement la donnée).
"""
import logging
import sys

logger = logging.getLogger(__name__)


def safe_dispatch(task, args=(), countdown=None):
    """Envoie une tâche Celery sans jamais lever d'exception à l'appelant.

    No-op silencieux pendant les tests (``pytest``/``manage.py test``) —
    aucun broker n'est démarré dans ce contexte, et attendre une connexion
    ralentirait chaque test qui touche un modèle avec un signal.
    """
    if 'pytest' in sys.modules or 'test' in sys.argv:
        return
    try:
        if countdown is not None:
            task.apply_async(args, countdown=countdown)
        else:
            task.apply_async(args)
    except Exception:
        logger.exception('Could not dispatch task %s%s', getattr(task, 'name', task), args)
