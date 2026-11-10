"""
Permissions RBAC pour Soken's Digital.

Les noms de rôles correspondent exactement à ceux définis dans la matrice
des rôles du cahier des charges.
"""
from rest_framework import permissions

from core.constants import ROLE_SUPER_ADMIN


# ---------------------------------------------------------------------------
# Helper
# ---------------------------------------------------------------------------

def _user_has_role(user, role_name):
    """Vérifie si un utilisateur possède un rôle donné (par nom exact)."""
    if not user or user.is_anonymous:
        return False
    return user.roles.filter(name=role_name).exists()


def _user_has_any_role(user, *role_names):
    """Vérifie si un utilisateur possède au moins un des rôles listés.

    Le Super-Administrateur satisfait toute vérification, sans avoir à
    figurer dans la liste. C'est une décision de conception : le privilège
    devient structurel au lieu de dépendre de la vigilance de chaque
    appelant à penser à l'ajouter — un oubli l'enfermait dehors, et il y en
    avait déjà.

    Cela ne lui retire rien nulle part : les vérifications qui *restreignent*
    d'après un rôle (masquer le budget d'un projet à un développeur, borner
    un queryset) interrogent `user.roles.filter(...)` directement et ne
    passent pas par ici. Un super-admin n'est donc jamais traité comme un
    développeur par effet de bord.
    """
    if not user or user.is_anonymous:
        return False
    if _user_has_role(user, ROLE_SUPER_ADMIN):
        return True
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

    def has_permission(self, request, view):
        # DRF n'appelle has_object_permission() que sur les actions qui
        # passent par get_object() (retrieve/update/destroy) — sans ce
        # garde, une vue qui utilise cette classe SEULE (sans queryset
        # scopé) laisserait passer n'importe quel utilisateur authentifié
        # sur list/create, la vérif "membre du projet" ne s'appliquant
        # jamais. Le vrai filtrage doit aussi venir de get_queryset().
        return bool(request.user and request.user.is_authenticated)

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

    def has_permission(self, request, view):
        # Voir IsProjectMember.has_permission — même piège DRF (has_object_
        # permission n'est jamais consulté sur list/create).
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        assigned = getattr(obj, 'assigned_to', None)
        if assigned is None:
            assigned = getattr(obj, 'assigned_developer', None)
        return assigned is not None and assigned == request.user


# ---------------------------------------------------------------------------
# Permissions modulaires fines (RBAC par module & action)
# ---------------------------------------------------------------------------

def user_has_module_action(user, module_key: str, action: str) -> bool:
    """Vérifie si un utilisateur possède une action donnée sur un module donné.

    1. Super-Administrateur a accès complet à toutes les actions sur tous les modules.
    2. Surcharge personnelle (user.permission_overrides) :
       Si le module est présent dans les overrides de l'utilisateur,
       cette configuration s'applique en priorité absolue (strict override).
    3. Rôles applicatifs : sinon, union des permissions définies sur les rôles.
    """
    if not user or user.is_anonymous:
        return False

    if _user_has_role(user, ROLE_SUPER_ADMIN):
        return True

    overrides = getattr(user, 'permission_overrides', None)
    if isinstance(overrides, dict) and module_key in overrides:
        allowed_actions = overrides.get(module_key) or []
        return action in allowed_actions

    # Pas d'override pour ce module : union des permissions des rôles
    for role in user.roles.all():
        role_perms = role.permissions or {}
        if action in role_perms.get(module_key, []):
            return True

    return False


class HasModulePermission(permissions.BasePermission):
    """Vérifie que l'utilisateur dispose de l'action requise pour ce module.

    Mappe la méthode HTTP vers l'action de base :
    - SAFE_METHODS -> 'voir'
    - POST -> 'creer'
    - PUT, PATCH -> 'modifier'
    - DELETE -> 'supprimer'
    """
    module_key = None

    def __init__(self, module_key=None):
        if module_key:
            self.module_key = module_key

    def __call__(self):
        return self

    def has_permission(self, request, view):
        if not request.user or request.user.is_anonymous:
            return False

        module = self.module_key or getattr(view, 'module_key', None)
        if not module:
            return True

        if request.method in permissions.SAFE_METHODS:
            action = 'voir'
        elif request.method == 'POST':
            action = 'creer'
        elif request.method == 'DELETE':
            action = 'supprimer'
        else:
            action = 'modifier'

        return user_has_module_action(request.user, module, action)



def is_gerant(user) -> bool:
    """Peut statuer au palier « Gérant » des circuits de validation.

    Le gérant désigné (User.is_gerant) ; à défaut de gérant désigné, le
    Super-Admin tient lieu de gérant (comportement historique). Un
    Super-Admin garde ce droit dans tous les cas : c'est le compte de
    secours si le gérant est absent ou désactivé."""
    if not user or not getattr(user, 'is_authenticated', False) or not user.is_active:
        return False
    if getattr(user, 'is_gerant', False):
        return True
    from core.constants import ROLE_SUPER_ADMIN
    return has_role(user, ROLE_SUPER_ADMIN)


def gerant_recipients():
    """Qui prévenir quand une demande attend le Gérant : le gérant désigné
    s'il existe et est actif, sinon les Super-Admins."""
    from core.constants import ROLE_SUPER_ADMIN
    from core.models import User
    gerant = User.objects.filter(is_gerant=True, is_active=True)
    if gerant.exists():
        return gerant
    return User.objects.filter(is_active=True, roles__name=ROLE_SUPER_ADMIN).distinct()


class IsGerant(permissions.BasePermission):
    """Palier Gérant — voir is_gerant()."""

    def has_permission(self, request, view):
        return is_gerant(request.user)
