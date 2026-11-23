"""
Constantes partagées pour les noms de rôles.

Ces noms correspondent exactement aux valeurs stockées dans la table ``Role``
et sont utilisés à la fois par les permissions RBAC (core.permissions) et
par les filtres de queryset dans les vues.

Centraliser ces noms ici évite les erreurs de typo et facilite le renommage.
"""

# Référentiel des rôles (13) — Soken's Digital SARL.
#
# Privilège système, hors plafond de cumul :
ROLE_SUPER_ADMIN = 'Super-Administrateur'
# Direction et pôles opérationnels :
ROLE_RESPONSABLE_OPERATIONS = 'Responsable des Opérations'
ROLE_RESPONSABLE_TECHNIQUE = 'Responsable Technique'
ROLE_RESPONSABLE_MARKETING_COM = 'Responsable Marketing & Communication'
ROLE_RESPONSABLE_ADMINISTRATIF = 'Responsable Administratif'
# Exécution interne :
ROLE_PROJECT_MANAGER = 'Chef de Projet'
ROLE_DEVELOPER = 'Développeur'
ROLE_COMMERCIAL = 'Commercial'
ROLE_COMPTABLE = 'Comptable'
ROLE_CAISSIER = 'Caissier'
# Sous-traitants (accès externes cloisonnés) :
ROLE_SOUS_TRAITANT_DEV = 'Sous-traitant Développeur'
ROLE_SOUS_TRAITANT_COMMERCIAL = 'Sous-traitant Commercial'
ROLE_SOUS_TRAITANT_DESIGNER = 'Sous-traitant Designer'

# Ordre = priorité (du plus élevé au plus bas), utilisée pour appliquer le
# plafond de cumul lors du reclassement des anciens rôles.
FUNCTIONAL_ROLES = [
    ROLE_RESPONSABLE_OPERATIONS, ROLE_RESPONSABLE_TECHNIQUE, ROLE_RESPONSABLE_MARKETING_COM,
    ROLE_RESPONSABLE_ADMINISTRATIF, ROLE_PROJECT_MANAGER, ROLE_COMPTABLE, ROLE_COMMERCIAL,
    ROLE_DEVELOPER, ROLE_CAISSIER, ROLE_SOUS_TRAITANT_DEV, ROLE_SOUS_TRAITANT_COMMERCIAL,
    ROLE_SOUS_TRAITANT_DESIGNER,
]
ALL_ROLES = [ROLE_SUPER_ADMIN, *FUNCTIONAL_ROLES]
# Plafond de cumul : 2 rôles fonctionnels par utilisateur (le privilège
# Super-Admin n'est pas compté).
MAX_FUNCTIONAL_ROLES = 2
SUBCONTRACTOR_ROLES = [ROLE_SOUS_TRAITANT_DEV, ROLE_SOUS_TRAITANT_COMMERCIAL, ROLE_SOUS_TRAITANT_DESIGNER]
# Rôles internes (salariés) : tout sauf les sous-traitants.
INTERNAL_ROLES = [r for r in ALL_ROLES if r not in SUBCONTRACTOR_ROLES]

# Anciens rôles retirés -> rôle de reclassement (migration core).
LEGACY_ROLE_MAPPING = {
    'Administrateur': ROLE_RESPONSABLE_ADMINISTRATIF,
    'Responsable RH': ROLE_RESPONSABLE_ADMINISTRATIF,
    'Directeur Financier': ROLE_COMPTABLE,
    'Support Client': ROLE_RESPONSABLE_TECHNIQUE,
    'Consultant': ROLE_RESPONSABLE_TECHNIQUE,
    'Responsable Marketing': ROLE_RESPONSABLE_MARKETING_COM,
}

# Groupes pratiques pour les filtres de queryset
# Exécution technique, cloisonnée aux projets dont on est membre.
DEV_LIKE_ROLES = [ROLE_DEVELOPER, ROLE_SOUS_TRAITANT_DEV, ROLE_SOUS_TRAITANT_DESIGNER]
# Pilotage : voient tous les projets.
PROJECT_OVERSIGHT_ROLES = [ROLE_RESPONSABLE_OPERATIONS, ROLE_RESPONSABLE_TECHNIQUE]
ADMIN_ROLES = [ROLE_SUPER_ADMIN, ROLE_RESPONSABLE_ADMINISTRATIF]
MANAGEMENT_ROLES = [ROLE_SUPER_ADMIN, ROLE_RESPONSABLE_OPERATIONS, ROLE_PROJECT_MANAGER]
FINANCE_ROLES = [ROLE_SUPER_ADMIN, ROLE_COMPTABLE]
HR_ROLES = [ROLE_SUPER_ADMIN, ROLE_RESPONSABLE_ADMINISTRATIF]


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
    ('agenda', 'Agenda', 'Général'),
    ('rh-dashboard', 'Tableau de bord RH', 'Administration'),
    ('employes', 'Employés', 'Administration'),
    ('departements', 'Départements', 'Administration'),
    ('clients', 'Clients', 'Administration'),
    ('utilisateurs', 'Utilisateurs & Rôles', 'Administration'),
    ('audit-log', 'Audit Log', 'Administration'),
    ('marketing-dashboard', 'Dashboard Marketing', 'Marketing & Commercial'),
    ('contenu', 'Gestion de contenu', 'Marketing & Commercial'),
    ('plan-editorial', 'Plan Éditorial', 'Marketing & Commercial'),
    ('leads', 'Tunnel commercial', 'Marketing & Commercial'),
    ('projets-soumis', 'Projets soumis', 'Marketing & Commercial'),
    ('devis', 'Devis', 'Marketing & Commercial'),
    ('analytique-marketing', 'Analytique web', 'Marketing & Commercial'),
    ('abonnements-communication', 'Abonnements communication', 'Marketing & Commercial'),
    ('projets', 'Gestion de projet', 'Technique'),
    ('timesheets', 'Timesheets', 'Technique'),
    ('maintenance', 'Maintenance', 'Technique'),
    ('abonnements-maintenance', 'Abonnements maintenance', 'Technique'),
    ('decaissements', 'Décaissements', 'Technique'),
    ('cahier-des-charges', 'Cahier des charges', 'Technique'),
    ('analytique-technique', 'Analytique web', 'Technique'),
    ('finance-dashboard', 'Analytique', 'Finance & Comptabilité'),
    ('cloture', 'Clôture comptable', 'Finance & Comptabilité'),
    ('grand-livre', 'Grand Livre', 'Finance & Comptabilité'),
    ('facturation', 'Facturation', 'Finance & Comptabilité'),
    ('encaissements', 'Encaissements', 'Finance & Comptabilité'),
    ('rapprochement', 'Rapprochement bancaire', 'Finance & Comptabilité'),
    ('tva', 'Fiscalité (TVA)', 'Finance & Comptabilité'),
    ('achats', 'Opérations d\'achats', 'Finance & Comptabilité'),
    ('tresorerie', 'Trésorerie (caisse & banque)', 'Finance & Comptabilité'),
    ('tickets', 'Tickets', 'Support Client'),
    ('base-connaissances', 'Base de connaissances', 'Support Client'),
    ('parametres', 'Paramètres', 'Paramètres'),
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
    ROLE_RESPONSABLE_OPERATIONS: _merge(
        _full('abonnements-maintenance'),
        _read_only('dashboard', 'audit-log', 'analytique-technique', 'clients'),
        {'messagerie': ['voir', 'creer']},
        {'agenda': ['voir', 'creer', 'modifier']},
        _full('projets', 'timesheets', 'maintenance', 'departements', 'cahier-des-charges'),
        {'projets-soumis': ['voir', 'modifier']},
        {'tickets': ['voir', 'modifier']},
    ),
    ROLE_RESPONSABLE_TECHNIQUE: _merge(
        _full('abonnements-maintenance'),
        _read_only('dashboard', 'analytique-technique', 'clients'),
        {'messagerie': ['voir', 'creer']},
        {'agenda': ['voir', 'creer', 'modifier']},
        _full('projets', 'maintenance', 'cahier-des-charges', 'tickets', 'base-connaissances'),
        {'timesheets': ['voir', 'creer', 'modifier']},
        {'projets-soumis': ['voir', 'modifier']},
        {'decaissements': ['voir', 'creer']},
    ),
    ROLE_RESPONSABLE_MARKETING_COM: _merge(
        _full('abonnements-communication'),
        _read_only('dashboard', 'marketing-dashboard', 'analytique-marketing'),
        {'messagerie': ['voir', 'creer']},
        {'agenda': ['voir', 'creer', 'modifier']},
        _full('contenu', 'plan-editorial', 'leads', 'devis', 'cahier-des-charges', 'projets-soumis'),
        {'clients': ['voir', 'creer', 'modifier']},
    ),
    ROLE_RESPONSABLE_ADMINISTRATIF: _merge(
        _read_only('dashboard', 'audit-log'),
        {'messagerie': ['voir', 'creer']},
        {'agenda': ['voir', 'creer', 'modifier']},
        _full('rh-dashboard', 'employes', 'departements', 'clients'),
        {'utilisateurs': ['voir']},
    ),
    ROLE_PROJECT_MANAGER: _merge(
        _read_only('dashboard', 'devis', 'analytique-technique', 'clients'),
        {'messagerie': ['voir', 'creer']},
        {'agenda': ['voir', 'creer', 'modifier']},
        _full('projets', 'maintenance', 'cahier-des-charges'),
        {'timesheets': ['voir', 'creer', 'modifier']},
        {'decaissements': ['voir', 'creer']},
        {'projets-soumis': ['voir', 'modifier']},
    ),
    ROLE_DEVELOPER: _merge(
        _read_only('dashboard', 'analytique-technique'),
        {'messagerie': ['voir', 'creer']},
        {'agenda': ['voir', 'creer', 'modifier']},
        {'projets': ['voir', 'modifier']},
        {'timesheets': ['voir', 'creer']},
        {'maintenance': ['voir', 'creer']},
        {'projets-soumis': ['voir', 'modifier']},
        _full('cahier-des-charges'),
    ),
    ROLE_COMMERCIAL: _merge(
        _read_only('abonnements-communication'),
        _read_only('dashboard', 'analytique-marketing'),
        {'messagerie': ['voir', 'creer']},
        {'agenda': ['voir', 'creer', 'modifier']},
        {'leads': ['voir', 'creer', 'modifier']},
        {'devis': ['voir', 'creer', 'modifier']},
        {'clients': ['voir', 'creer', 'modifier']},
        {'projets-soumis': ['voir', 'creer', 'modifier']},
    ),
    ROLE_COMPTABLE: _merge(
        _read_only('abonnements-communication', 'abonnements-maintenance'),
        _read_only('dashboard'),
        {'messagerie': ['voir', 'creer']},
        {'agenda': ['voir', 'creer', 'modifier']},
        _read_only('finance-dashboard'),
        _full('cloture', 'grand-livre', 'facturation', 'rapprochement', 'tva', 'achats', 'tresorerie', 'encaissements'),
        {'decaissements': ['voir', 'modifier']},
    ),
    ROLE_CAISSIER: _merge(
        _read_only('dashboard'),
        {'messagerie': ['voir', 'creer']},
        {'agenda': ['voir', 'creer', 'modifier']},
        {'tresorerie': ['voir', 'creer']},
        _read_only('encaissements'),
    ),
    # Sous-traitants : cloisonnés aux projets / leads qui leur sont
    # assignés ; aucune finance, RH, ni autre projet.
    ROLE_SOUS_TRAITANT_DEV: _merge(
        {'messagerie': ['voir', 'creer']},
        {'projets': ['voir', 'modifier']},
        {'timesheets': ['voir', 'creer']},
    ),
    ROLE_SOUS_TRAITANT_COMMERCIAL: _merge(
        {'messagerie': ['voir', 'creer']},
        {'leads': ['voir', 'creer', 'modifier']},
        {'devis': ['voir', 'creer', 'modifier']},
    ),
    ROLE_SOUS_TRAITANT_DESIGNER: _merge(
        {'messagerie': ['voir', 'creer']},
        {'projets': ['voir', 'modifier']},
        {'timesheets': ['voir', 'creer']},
    ),
}
