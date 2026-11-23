from rest_framework import permissions

from core.constants import (
    ROLE_COMMERCIAL, ROLE_COMPTABLE, ROLE_RESPONSABLE_MARKETING_COM, ROLE_RESPONSABLE_OPERATIONS,
    ROLE_RESPONSABLE_TECHNIQUE, ROLE_SUPER_ADMIN,
)
from core.permissions import has_role

POLE_MANAGER_ROLES = {
    'COMMUNICATION': (ROLE_SUPER_ADMIN, ROLE_RESPONSABLE_MARKETING_COM),
    'MAINTENANCE': (ROLE_SUPER_ADMIN, ROLE_RESPONSABLE_TECHNIQUE, ROLE_RESPONSABLE_OPERATIONS),
}
# Lecture seule en plus des responsables : Comptable (rapprochement facturé
# / livré), Commercial (abonnements de communication de ses clients).
POLE_READER_ROLES = {
    'COMMUNICATION': (ROLE_COMPTABLE, ROLE_COMMERCIAL),
    'MAINTENANCE': (ROLE_COMPTABLE,),
}
ALL_MANAGER_ROLES = tuple({r for roles in POLE_MANAGER_ROLES.values() for r in roles})
ALL_READER_ROLES = tuple({r for roles in POLE_READER_ROLES.values() for r in roles})


def pole_roles(pole):
    return POLE_MANAGER_ROLES.get(pole, (ROLE_SUPER_ADMIN,))


def can_manage(user, pole) -> bool:
    return has_role(user, *pole_roles(pole))


def can_read(user, pole) -> bool:
    return can_manage(user, pole) or has_role(user, *POLE_READER_ROLES.get(pole, ()))


def can_bill(user, pole) -> bool:
    return can_manage(user, pole) or has_role(user, ROLE_COMPTABLE)


def portfolio_filter(user, prefix=''):
    """Q limitant un lecteur Commercial (ni responsable, ni Comptable) aux
    abonnements de SON portefeuille : client qui lui est attribué ou devis
    qu'il a créé. None = pas de restriction."""
    from django.db.models import Q
    if can_manage(user, 'COMMUNICATION') or has_role(user, ROLE_COMPTABLE) or not has_role(user, ROLE_COMMERCIAL):
        return None
    # Seul le pôle Communication est concerné (un Commercial qui serait aussi
    # responsable Maintenance garde l'accès complet à ce pôle).
    return (
        ~Q(**{f'{prefix}offer__pole': 'COMMUNICATION'})
        | Q(**{f'{prefix}client__assigned_to': user})
        | Q(**{f'{prefix}quote__created_by': user})
    )


def manages_any_pole(user) -> bool:
    return any(can_manage(user, p) for p in POLE_MANAGER_ROLES)


def readable_poles(user):
    return [p for p in POLE_MANAGER_ROLES if can_read(user, p)]


class HasServicesAccess(permissions.BasePermission):
    """Au moins un pôle lisible. Les sous-traitants n'en ont aucun : leurs
    rôles ne figurent dans aucun des tableaux ci-dessus."""

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and readable_poles(request.user))
