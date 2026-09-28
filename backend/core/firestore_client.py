import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)

_client = None

# get_profile_role() used to hit Firestore on every single authenticated
# request (every API call, from every admin page) — with the backend,
# Postgres and Firestore all on different free-tier providers, that
# round-trip was showing up as the app-wide "everything feels slow"
# complaint. A short TTL keeps a role change propagating in well under a
# minute while removing Firestore from the hot path of almost every
# request. SetUserRoleView proactively invalidates on an explicit role
# change, so the common case (an admin changes a role, expects it to take
# effect) doesn't even wait out the TTL.
ROLE_CACHE_TTL = 45  # seconds
_ROLE_CACHE_NONE = '__none__'  # cache.get() returning None is ambiguous
# between "not cached" and "cached as no role" — this sentinel disambiguates.


def _role_cache_key(firebase_uid: str) -> str:
    return f'firestore-role:{firebase_uid}'


def invalidate_role_cache(firebase_uid: str) -> None:
    try:
        cache.delete(_role_cache_key(firebase_uid))
    except Exception:
        logger.exception('Could not invalidate role cache for uid=%s', firebase_uid)


def _get_client():
    """Lazy singleton — firebase_admin.firestore.client() needs the app
    already initialized (core.apps.CoreConfig.ready(), which runs before any
    request), and importing firestore at module load time would fail in
    contexts where the SDK isn't configured yet (e.g. `manage.py` commands
    that don't touch Firebase at all)."""
    global _client
    if _client is None:
        from firebase_admin import firestore
        _client = firestore.client()
    return _client


def get_profile_roles(firebase_uid: str) -> list[str]:
    """The Firestore `profiles/{uid}.roles` array is the source of truth for
    a user's application roles (see docs/backend-specifications.md —
    Firestore owns identity/roles, Django owns RH/Finance/Projects data).
    Returns [] if the doc doesn't exist or Firestore is unreachable —
    callers should treat that as "no role", not raise.

    Reads the legacy singular `role` string field as a one-element list if
    `roles` isn't present yet — a profile written before the cumulative-role
    migration (décision du 10/09/2026) still has only `role`, and there is
    no bulk backfill script; this keeps such accounts working unchanged
    until they're next edited through SetUserRoleView (which always writes
    `roles`).

    Cached for ROLE_CACHE_TTL seconds (see module docstring above) — cache
    reads/writes are wrapped so a Redis hiccup just means "cache miss",
    never a failed request; the Firestore fetch below is still the
    fallback of record.
    """
    if not firebase_uid:
        return []

    cache_key = _role_cache_key(firebase_uid)
    try:
        cached = cache.get(cache_key)
    except Exception:
        cached = None
    if cached is not None:
        return [] if cached == _ROLE_CACHE_NONE else cached

    try:
        snapshot = _get_client().collection('profiles').document(firebase_uid).get()
    except Exception:
        logger.exception('Could not fetch Firestore profile for uid=%s', firebase_uid)
        return []

    roles: list[str] = []
    if snapshot.exists:
        doc = snapshot.to_dict()
        if doc.get('roles'):
            roles = list(doc['roles'])
        elif doc.get('role'):
            roles = [doc['role']]

    try:
        cache.set(cache_key, roles if roles else _ROLE_CACHE_NONE, timeout=ROLE_CACHE_TTL)
    except Exception:
        logger.exception('Could not cache roles for uid=%s', firebase_uid)

    return roles


def create_profile(firebase_uid: str, data: dict) -> None:
    """Writes profiles/{uid} via the Admin SDK — bypasses Firestore security
    rules entirely (server-side trusted write), used by the account
    provisioning flow (core.views.ProvisionUserView) so a Super-Admin/RH
    creating a new employee's platform access doesn't need the client SDK
    (which would hijack the admin's own session — createUserWithEmailAndPassword
    signs the browser in as the newly created user)."""
    from firebase_admin import firestore

    _get_client().collection('profiles').document(firebase_uid).set({
        **data,
        'createdAt': firestore.SERVER_TIMESTAMP,
        'updatedAt': firestore.SERVER_TIMESTAMP,
    })


def update_profile_fields(firebase_uid: str, data: dict) -> None:
    """Partial update of profiles/{uid} — e.g. changing role/department for
    an existing user (core.views.SetUserRoleView, Super-Admin only)."""
    from firebase_admin import firestore

    _get_client().collection('profiles').document(firebase_uid).update({
        **data,
        'updatedAt': firestore.SERVER_TIMESTAMP,
    })


def upsert_chat_room(room_id: str, data: dict) -> None:
    """Creates or fully overwrites a chatRooms/{room_id} doc — used to keep
    Django-owned entities (Department, Project) mirrored into Firestore's
    chat system, since firestore.rules only lets SUPER_ADMIN write chatRooms
    directly (see firestore.rules TODO(chat) — this is that mirror). Doc id
    is caller-chosen (e.g. `dept-{department.id}`, `project-{project.id}`)
    so repeat calls are naturally idempotent.

    Swallows errors (logged, not raised): this runs inside
    Department/Project create/update requests, and a Firestore hiccup
    (or, in local dev, no Firebase credentials configured at all)
    shouldn't fail the Django-side operation that actually owns the data —
    same reasoning as get_profile_role()'s try/except below.
    """
    from firebase_admin import firestore

    try:
        _get_client().collection('chatRooms').document(room_id).set({
            **data,
            'isActive': True,
            'createdAt': firestore.SERVER_TIMESTAMP,
        }, merge=True)
    except Exception:
        logger.exception('Could not upsert Firestore chat room %s', room_id)


def set_chat_room_members(room_id: str, member_uids: list[str]) -> None:
    """Overwrites the memberUids array on a PROJECT-type room — called
    whenever ProjectMember or Project.lead_project_manager changes. Same
    swallow-and-log reasoning as upsert_chat_room()."""
    try:
        _get_client().collection('chatRooms').document(room_id).update({
            'memberUids': member_uids,
        })
    except Exception:
        logger.exception('Could not update Firestore chat room members for %s', room_id)


def create_notification(
    recipient_uid: str,
    title: str,
    message: str,
    notification_type: str,
    link: str | None = None,
) -> None:
    """Writes a notifications/{auto-id} doc — the client-facing bell in
    admin-header.tsx reads this collection directly via
    onSnapshot(where recipientId == uid), matching firestore.rules (create
    is server-only, `recipientId` is the field it checks). Swallow-and-log:
    a missed in-app notification must never fail the caller's real work
    (e.g. a scheduled-publishing cron run) — see core.notifications.notify()
    for the combined in-app + email helper most callers should use instead
    of this directly.
    """
    from firebase_admin import firestore

    if not recipient_uid:
        return
    try:
        _get_client().collection('notifications').add({
            'recipientId': recipient_uid,
            'title': title,
            'message': message,
            'type': notification_type,
            'link': link,
            'isRead': False,
            'createdAt': firestore.SERVER_TIMESTAMP,
        })
    except Exception:
        logger.exception('Could not create Firestore notification for uid=%s', recipient_uid)


# --- Commentaires & likes du blog public (marketing/views.py) ---------------
#
# À la différence de create_notification()/upsert_chat_room() ci-dessus, ces
# fonctions NE swallow PAS leurs exceptions : elles sont appelées depuis une
# requête publique dont la réponse dépend directement du résultat (un
# commentaire "enregistré avec succès" qui ne l'a en fait pas été serait pire
# qu'une erreur 503 explicite). C'est à l'appelant (marketing/views.py) de
# décider quoi répondre au visiteur si Firestore est indisponible.
#
# firestore.rules interdit toute écriture cliente sur `blogComments` et
# `blogLikes` (allow write: if false) — seul ce module, via l'Admin SDK,
# peut y écrire. C'est ce qui permet le filtrage anti-spam/anti-injures
# (marketing.moderation.screen_comment) et la limitation de débit
# (marketing.ratelimit) à s'appliquer avant tout écriture, sans qu'un appel
# direct au SDK Firestore côté navigateur puisse les contourner.

def create_blog_comment(slug: str, pseudo: str, text: str, status: str, flag_reason: str | None = None) -> dict:
    """Crée un commentaire de blog. `status` vaut 'VISIBLE' ou 'MASQUE'
    (mis en file d'attente par le filtre automatique — voir
    marketing.moderation.screen_comment)."""
    from firebase_admin import firestore

    ref = _get_client().collection('blogComments').document()
    data = {
        'slug': slug,
        'pseudo': pseudo,
        'text': text,
        'status': status,
        'flagReason': flag_reason,
        'reportCount': 0,
        'createdAt': firestore.SERVER_TIMESTAMP,
        'moderatedAt': None,
        'moderatedBy': None,
    }
    ref.set(data)
    return {'id': ref.id, **data, 'createdAt': None}


def list_blog_comments(slug: str | None = None, statuses: list[str] | None = None, limit: int = 200) -> list[dict]:
    """Lit blogComments, du plus récent au plus ancien. Sans `statuses`,
    retourne tous les statuts (file de modération complète) ; avec
    `slug` seul (chemin public), l'appelant est censé filtrer sur
    statuses=['VISIBLE'] pour ne jamais exposer un commentaire masqué."""
    from firebase_admin import firestore

    query = _get_client().collection('blogComments')
    if slug:
        query = query.where('slug', '==', slug)
    if statuses:
        query = query.where('status', 'in', list(statuses))
    query = query.order_by('createdAt', direction=firestore.Query.DESCENDING).limit(limit)
    return [{'id': doc.id, **doc.to_dict()} for doc in query.stream()]


def moderate_blog_comment(comment_id: str, new_status: str, moderator_email: str) -> bool:
    """Bascule un commentaire en 'VISIBLE' (approuvé) ou 'MASQUE' (retiré).
    Ne supprime jamais le texte — un modérateur doit pouvoir revenir sur sa
    décision. Retourne False si le commentaire n'existe plus (déjà
    supprimé entre-temps)."""
    from firebase_admin import firestore

    ref = _get_client().collection('blogComments').document(comment_id)
    if not ref.get().exists:
        return False
    ref.update({
        'status': new_status,
        'moderatedAt': firestore.SERVER_TIMESTAMP,
        'moderatedBy': moderator_email,
    })
    return True


def delete_blog_comment(comment_id: str) -> bool:
    """Suppression définitive (contenu réellement illégal/nuisible, par
    opposition à moderate_blog_comment() qui ne fait que masquer)."""
    ref = _get_client().collection('blogComments').document(comment_id)
    if not ref.get().exists:
        return False
    ref.delete()
    return True


# Au-delà de ce seuil de signalements par les lecteurs, le commentaire est
# automatiquement masqué en attendant la relecture d'un modérateur — même
# logique que le filtre à la création, mais déclenchée par le public plutôt
# que par des motifs de texte.
REPORT_AUTO_HIDE_THRESHOLD = 3


def report_blog_comment(comment_id: str) -> int | None:
    """Incrémente le compteur de signalements ; masque automatiquement le
    commentaire au-delà de REPORT_AUTO_HIDE_THRESHOLD. Retourne le nouveau
    compteur, ou None si le commentaire n'existe pas/plus."""
    from firebase_admin import firestore

    ref = _get_client().collection('blogComments').document(comment_id)
    snapshot = ref.get()
    if not snapshot.exists:
        return None
    new_count = (snapshot.to_dict().get('reportCount') or 0) + 1
    updates: dict = {'reportCount': firestore.Increment(1)}
    if new_count >= REPORT_AUTO_HIDE_THRESHOLD and snapshot.to_dict().get('status') == 'VISIBLE':
        updates['status'] = 'MASQUE'
        updates['flagReason'] = 'SIGNALEMENTS'
    ref.update(updates)
    return new_count


def get_blog_like_count(slug: str) -> int:
    snapshot = _get_client().collection('blogLikes').document(slug).get()
    return int((snapshot.to_dict() or {}).get('count', 0)) if snapshot.exists else 0


def adjust_blog_like_count(slug: str, delta: int) -> int:
    """+1/-1 sur le compteur de likes d'un article, jamais sous zéro — fait
    dans une transaction pour éviter qu'un double-clic ou deux visiteurs
    simultanés ne fassent dériver le compteur (lecture-puis-écriture sans
    transaction serait sujette à une condition de course classique)."""
    from firebase_admin import firestore

    client = _get_client()
    ref = client.collection('blogLikes').document(slug)

    @firestore.transactional
    def _apply(transaction):
        snapshot = ref.get(transaction=transaction)
        current = (snapshot.to_dict() or {}).get('count', 0) if snapshot.exists else 0
        new_value = max(0, current + delta)
        transaction.set(ref, {'count': new_value}, merge=True)
        return new_value

    return _apply(client.transaction())
