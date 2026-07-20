def has_role(user, *role_names):
    """True if `user` holds any of the named Firestore AppRole values
    (SUPER_ADMIN, RESPONSABLE_RH, CHEF_DE_PROJET, ...).

    Firestore's `profiles/{uid}.role` is the single source of truth for
    identity/role — `core.authentication.FirebaseAuthentication` fetches it
    fresh on every request and stashes it as `user.firestore_role` (not a
    DB column, never persisted). SUPER_ADMIN always passes, matching the
    "Gouvernance globale" grant in docs/backend-specifications.md §1.1.
    """
    if not user or not user.is_authenticated:
        return False
    role = getattr(user, 'firestore_role', None)
    if role == 'SUPER_ADMIN':
        return True
    return role in role_names
