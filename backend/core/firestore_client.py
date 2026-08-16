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


def get_profile_role(firebase_uid: str) -> str | None:
    """The Firestore `profiles/{uid}.role` is the single source of truth
    for a user's application role (see docs/backend-specifications.md —
    Firestore owns identity/role, Django owns RH/Finance/Projects data).
    Returns None if the doc doesn't exist or Firestore is unreachable —
    callers should treat that as "no role", not raise.

    Cached for ROLE_CACHE_TTL seconds (see module docstring above) — cache
    reads/writes are wrapped so a Redis hiccup just means "cache miss",
    never a failed request; the Firestore fetch below is still the
    fallback of record.
    """
    if not firebase_uid:
        return None

    cache_key = _role_cache_key(firebase_uid)
    try:
        cached = cache.get(cache_key)
    except Exception:
        cached = None
    if cached is not None:
        return None if cached == _ROLE_CACHE_NONE else cached

    try:
        snapshot = _get_client().collection('profiles').document(firebase_uid).get()
    except Exception:
        logger.exception('Could not fetch Firestore profile for uid=%s', firebase_uid)
        return None
    role = snapshot.to_dict().get('role') if snapshot.exists else None

    try:
        cache.set(cache_key, role if role is not None else _ROLE_CACHE_NONE, timeout=ROLE_CACHE_TTL)
    except Exception:
        logger.exception('Could not cache role for uid=%s', firebase_uid)

    return role


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
