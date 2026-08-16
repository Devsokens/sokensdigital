"""
Constantes partagées pour les noms de rôles.

Ces noms correspondent exactement aux valeurs stockées dans la table ``Role``
et sont utilisés à la fois par les permissions RBAC (core.permissions) et
par les filtres de queryset dans les vues.

Centraliser ces noms ici évite les erreurs de typo et facilite le renommage.
"""

# Rôles principaux
ROLE_SUPER_ADMIN = 'Super-Administrateur'
ROLE_ADMIN = 'Administrateur'
ROLE_PROJECT_MANAGER = 'Chef de Projet'
ROLE_DEVELOPER = 'Développeur'
ROLE_DIRECTEUR_FINANCIER = 'Directeur Financier'
ROLE_COMMERCIAL = 'Commercial'
ROLE_RH_MANAGER = 'Responsable RH'
ROLE_CONSULTANT = 'Consultant'
ROLE_SUPPORT_CLIENT = 'Support Client'
ROLE_COMPTABLE = 'Comptable'
ROLE_RESPONSABLE_MARKETING = 'Responsable Marketing'

# Groupes pratiques pour les filtres de queryset
ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN]
MANAGEMENT_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_PROJECT_MANAGER]
FINANCE_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_DIRECTEUR_FINANCIER]
HR_ROLES = [ROLE_SUPER_ADMIN, ROLE_ADMIN, ROLE_RH_MANAGER]


# ---------------------------------------------------------------------------
# Permissions par rôle (module x action) — module Utilisateurs & Rôles
# ---------------------------------------------------------------------------
# Purement déclaratif : Role.permissions (JSONField, déjà en base, inutilisé
# jusqu'ici) stocke ce choix par rôle et alimente l'éditeur de permissions
# du module Utilisateurs & Rôles. Ce n'est PAS (encore) branché aux
# vérifications réelles côté vues — celles-ci restent sur has_role() par
# nom de rôle (core.permissions). Documenté dans
# DOCUMENTATION GLOBALE/04-roadmap-et-dette-technique.md.

MODULE_ACTIONS = ['voir', 'creer', 'modifier', 'supprimer']

# Clés alignées sur les hrefs de frontend/lib/admin-nav.ts (sans le préfixe
# /admin/) — un id stable, pas une traduction, pour que renommer un libellé
# à l'écran n'oblige pas à migrer les permissions déjà enregistrées.
MODULES = [
    ('dashboard', 'Tableau de bord', 'Général'),
    ('messagerie', 'Messagerie', 'Général'),
    ('rh-dashboard', 'Tableau de bord RH', 'Administration & RH'),
    ('employes', 'Employés', 'Administration & RH'),
    ('departements', 'Départements', 'Administration & RH'),
    ('utilisateurs', 'Utilisateurs & Rôles', 'Administration & RH'),
    ('audit-log', 'Audit Log', 'Administration & RH'),
    ('marketing-dashboard', 'Dashboard Marketing', 'Marketing & Commercial'),
    ('contenu', 'Gestion de contenu', 'Marketing & Commercial'),
    ('plan-editorial', 'Plan Éditorial', 'Marketing & Commercial'),
    ('leads', 'Tunnel commercial', 'Marketing & Commercial'),
    ('devis', 'Devis', 'Marketing & Commercial'),
    ('projets', 'Gestion de projet', 'Technique'),
    ('timesheets', 'Timesheets', 'Technique'),
    ('decaissements', 'Décaissements', 'Technique'),
    ('finance-dashboard', 'Analytique', 'Finance & Comptabilité'),
    ('cloture', 'Clôture comptable', 'Finance & Comptabilité'),
    ('grand-livre', 'Grand Livre', 'Finance & Comptabilité'),
    ('facturation', 'Facturation', 'Finance & Comptabilité'),
    ('rapprochement', 'Rapprochement bancaire', 'Finance & Comptabilité'),
    ('tva', 'Fiscalité (TVA)', 'Finance & Comptabilité'),
]

_ALL_MODULE_KEYS = [key for key, _, _ in MODULES]
_ALL_ACTIONS = list(MODULE_ACTIONS)


def _full(*keys):
    return {key: list(_ALL_ACTIONS) for key in keys}


def _read_only(*keys):
    return {key: ['voir'] for key in keys}


def _merge(*dicts):
    merged = {}
    for d in dicts:
        merged.update(d)
    return merged


# Best-effort snapshot of what each role can already do today per
# has_role() across the codebase (see the 2026-08 RBAC audit entry in the
# roadmap doc) — a starting point to refine from the UI, not a byte-for-byte
# mirror of every call site.
DEFAULT_ROLE_PERMISSIONS = {
    ROLE_SUPER_ADMIN: _full(*_ALL_MODULE_KEYS),
    ROLE_ADMIN: _merge(
        _full(*[k for k in _ALL_MODULE_KEYS if k not in ('utilisateurs', 'audit-log')]),
        _read_only('utilisateurs', 'audit-log'),
    ),
    ROLE_RH_MANAGER: _merge(
        _read_only('dashboard', 'rh-dashboard'),
        {'messagerie': ['voir', 'creer']},
        _full('employes'),
        # NOT departements — DepartmentViewSet is Super-Admin-only on the
        # backend (core.views.IsSuperAdmin), so declaring read access here
        # would show a nav item that 403s the moment it's opened.
        {'utilisateurs': ['voir', 'creer']},
    ),
    ROLE_PROJECT_MANAGER: _merge(
        _read_only('dashboard', 'devis'),
        {'messagerie': ['voir', 'creer']},
        _full('projets'),
        {'timesheets': ['voir', 'creer', 'modifier']},
        {'decaissements': ['voir', 'creer']},
    ),
    ROLE_DEVELOPER: _merge(
        _read_only('dashboard'),
        {'messagerie': ['voir', 'creer']},
        {'projets': ['voir', 'modifier']},
        {'timesheets': ['voir', 'creer']},
    ),
    ROLE_DIRECTEUR_FINANCIER: _merge(
        _read_only('dashboard'),
        {'messagerie': ['voir', 'creer']},
        _read_only('finance-dashboard'),
        _full('cloture', 'grand-livre', 'facturation', 'rapprochement', 'tva'),
        {'decaissements': ['voir', 'modifier']},
    ),
    ROLE_COMPTABLE: _merge(
        _read_only('dashboard'),
        {'messagerie': ['voir', 'creer']},
        _full('grand-livre', 'facturation', 'rapprochement', 'tva'),
        {'decaissements': ['voir', 'modifier']},
    ),
    ROLE_RESPONSABLE_MARKETING: _merge(
        _read_only('dashboard', 'marketing-dashboard'),
        {'messagerie': ['voir', 'creer']},
        _full('contenu', 'plan-editorial', 'leads', 'devis'),
    ),
    ROLE_COMMERCIAL: _merge(
        _read_only('dashboard'),
        {'messagerie': ['voir', 'creer']},
        {'leads': ['voir', 'creer', 'modifier']},
        {'devis': ['voir', 'creer', 'modifier']},
    ),
    ROLE_CONSULTANT: _merge(
        _read_only('dashboard', 'projets'),
        {'messagerie': ['voir']},
    ),
    ROLE_SUPPORT_CLIENT: _merge(
        _read_only('dashboard'),
        {'messagerie': ['voir', 'creer']},
    ),
}
