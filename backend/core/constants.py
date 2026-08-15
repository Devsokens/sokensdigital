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
