def has_role(user, *role_names):
    """True if `user` is a superuser or holds any of the named business Roles.

    Business roles (`core.Role`) are DB-driven, not Django's built-in
    permission system — this is the shared check every department's DRF
    permission classes build on until the full RBAC matrix
    (docs/backend-specifications.md §11) is implemented.
    """
    if not user or not user.is_authenticated:
        return False
    if user.is_superuser:
        return True
    return user.roles.filter(name__in=role_names).exists()
