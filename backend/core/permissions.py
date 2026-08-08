"""
Permissions RBAC pour Soken's Digital.

Les noms de rôles correspondent exactement à ceux définis dans la matrice
des rôles du cahier des charges.
"""
from rest_framework import permissions


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _user_has_role(user, role_name):
    """Vérifie si un utilisateur possède un rôle donné (par nom exact)."""
    if not user or user.is_anonymous:
        return False
    return user.roles.filter(name=role_name).exists()


def _user_has_any_role(user, *role_names):
    """Vérifie si un utilisateur possède au moins un des rôles listés."""
    if not user or user.is_anonymous:
        return False
    return user.roles.filter(name__in=role_names).exists()


def has_role(user, *role_names):
    """
    Alias public de ``_user_has_any_role``, conservé pour compatibilité —
    ``core.views``, ``finance.views``, ``hr.views``, ``marketing.views`` et
    ``projects.views`` importent tous ``has_role`` depuis ce module. Avant
    la fusion RBAC (voir historique du merge), le rôle vivait dans
    Firestore et cette fonction interrogeait ``core.firestore_client``
    avec des noms de rôle en SNAKE_CASE (``'SUPER_ADMIN'``) ; le RBAC est
    maintenant côté Django (``user.roles``, ``core.constants``, noms en
    français — ``'Super-Administrateur'``). Signature identique, mais tout
    appelant qui passe encore l'ancien nom SNAKE_CASE ne matchera plus
    aucun rôle réel — à corriger appelant par appelant (déjà fait pour
    core/hr/projects dans ce pass ; finance/marketing restent sur les
    anciens noms, hors périmètre de ce pass, voir rapport final).
    """
    return _user_has_any_role(user, *role_names)


# ---------------------------------------------------------------------------
# Permissions de niveau vue (has_permission)
# ---------------------------------------------------------------------------

class ReadOnly(permissions.BasePermission):
    """Autorise uniquement les méthodes de lecture (GET, HEAD, OPTIONS)."""

    def has_permission(self, request, view):
        return request.method in permissions.SAFE_METHODS


class IsSuperAdmin(permissions.BasePermission):
    """Accès réservé au Super-Administrateur."""

    def has_permission(self, request, view):
        return _user_has_role(request.user, 'Super-Administrateur')


class IsAdmin(permissions.BasePermission):
    """Accès pour Administrateur ou Super-Administrateur."""

    def has_permission(self, request, view):
        return _user_has_any_role(
            request.user, 'Super-Administrateur', 'Administrateur'
        )


class IsProjectManager(permissions.BasePermission):
    """Accès pour Chef de Projet."""

    def has_permission(self, request, view):
        return _user_has_role(request.user, 'Chef de Projet')


class IsDeveloper(permissions.BasePermission):
    """Accès pour Développeur."""

    def has_permission(self, request, view):
        return _user_has_role(request.user, 'Développeur')


class IsDirecteurFinancier(permissions.BasePermission):
    """Accès pour Directeur Financier."""

    def has_permission(self, request, view):
        return _user_has_role(request.user, 'Directeur Financier')


class IsCommercial(permissions.BasePermission):
    """Accès pour Commercial."""

    def has_permission(self, request, view):
        return _user_has_role(request.user, 'Commercial')


class IsRHManager(permissions.BasePermission):
    """Accès pour Responsable RH."""

    def has_permission(self, request, view):
        return _user_has_role(request.user, 'Responsable RH')


class IsConsultant(permissions.BasePermission):
    """Accès pour Consultant."""

    def has_permission(self, request, view):
        return _user_has_role(request.user, 'Consultant')


class IsSupportClient(permissions.BasePermission):
    """Accès pour Support Client."""

    def has_permission(self, request, view):
        return _user_has_role(request.user, 'Support Client')


class IsAdminOrReadOnly(permissions.BasePermission):
    """Admin/Super-Admin en écriture, tout utilisateur authentifié en lecture."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return _user_has_any_role(
            request.user, 'Super-Administrateur', 'Administrateur'
        )


# ---------------------------------------------------------------------------
# Permissions de niveau objet (has_object_permission)
# ---------------------------------------------------------------------------

class IsOwner(permissions.BasePermission):
    """
    Accès objet : autorise uniquement si request.user == obj.user.

    Fonctionne sur tout modèle ayant un champ ``user`` (FK vers User).
    """

    def has_object_permission(self, request, view, obj):
        user_attr = getattr(obj, 'user', None)
        if user_attr is not None:
            return user_attr == request.user
        # Fallback : vérifier user_id directement
        user_id = getattr(obj, 'user_id', None)
        if user_id is not None:
            return user_id == request.user.pk
        return False


class IsProjectMember(permissions.BasePermission):
    """
    Accès objet : autorise si l'utilisateur est membre du projet
    (via ``project.members`` M2M) ou est le ``project_manager``.

    Fonctionne sur :
    - un objet ``Project`` directement (possède ``members``)
    - tout objet ayant un FK ``project`` vers un Project
    """

    def has_object_permission(self, request, view, obj):
        # Déterminer l'objet Project
        if hasattr(obj, 'members'):
            # L'objet est lui-même un Project
            project = obj
        elif hasattr(obj, 'project'):
            project = obj.project
        else:
            return False

        if project is None:
            return False

        # Chef de projet
        if (hasattr(project, 'project_manager')
                and project.project_manager_id == request.user.pk):
            return True

        # Membre du projet
        if hasattr(project, 'members'):
            return project.members.filter(pk=request.user.pk).exists()

        return False


class IsAssignedDeveloper(permissions.BasePermission):
    """
    Accès objet : autorise le développeur assigné (Task.assigned_to
    ou Ticket.assigned_developer).
    """

    def has_object_permission(self, request, view, obj):
        assigned = getattr(obj, 'assigned_to', None)
        if assigned is None:
            assigned = getattr(obj, 'assigned_developer', None)
        return assigned is not None and assigned == request.user
