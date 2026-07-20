import logging

logger = logging.getLogger(__name__)

_client = None


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
    """
    if not firebase_uid:
        return None
    try:
        snapshot = _get_client().collection('profiles').document(firebase_uid).get()
    except Exception:
        logger.exception('Could not fetch Firestore profile for uid=%s', firebase_uid)
        return None
    if not snapshot.exists:
        return None
    return snapshot.to_dict().get('role')
