# Rôles et permissions — référentiel 2026

Référentiel unique des rôles de l'ERP de Soken's Digital SARL : le privilège
système **Super-Administrateur** et **12 rôles fonctionnels** (13 rôles), plus
**2 désignations spéciales**. Tout autre rôle a été retiré (voir « Reclassement »).

Sources dans le code :

| Couche | Fichier |
|---|---|
| Backend (noms Django, groupes, permissions par défaut) | `backend/core/constants.py` |
| Correspondance nom applicatif ↔ nom Django, plafond | `backend/core/serializers.py` (`APP_ROLE_TO_DJANGO_ROLE`, `validate_role_set`, `normalize_app_roles`) |
| Classes de permission DRF | `backend/core/permissions.py` |
| Frontend (types, libellés, rôles par pôle) | `frontend/lib/firebase/types.ts` |
| Règles Firestore | `firestore.rules` |
| Migration de reclassement | `backend/core/migrations/0022_referentiel_roles_2026.py` |

## 1. Privilège système (hors plafond de cumul)

| Rôle | Nom applicatif | Attributions |
|---|---|---|
| Super-Administrateur | `SUPER_ADMIN` | Accès complet à tous les modules. Seul habilité à attribuer ou retirer des rôles (Département administratif > Utilisateurs & Rôles) et à nommer le Gérant et le Responsable Comptabilité & Finance. Peut cumuler 2 rôles fonctionnels en plus. |

## 2. Direction et pôles opérationnels

| Rôle | Nom applicatif | Attributions |
|---|---|---|
| Responsable des Opérations | `RESPONSABLE_OPERATIONS` | Pilotage global des projets, contrôle de l'avancement des tâches, suivi des temps passés, respect des délais, audit opérationnel, gestion des départements. |
| Responsable Technique | `RESPONSABLE_TECHNIQUE` | Supervision de l'équipe technique (développeurs internes et sous-traitants), validation technique des besoins, affectation des tickets de développement, qualité du code, accès techniques, base de connaissances. |
| Responsable Marketing & Communication | `RESPONSABLE_MARKETING_COM` | Contenu du site et du blog, modération des commentaires, tunnel commercial et campagnes, création/suivi des devis, supervision des sous-traitants commerciaux. |
| Responsable Administratif | `RESPONSABLE_ADMINISTRATIF` | Gestion administrative globale, dossiers des collaborateurs et associés, contrats de travail et de prestation, départements, archivage documentaire. |

## 3. Exécution interne

| Rôle | Nom applicatif | Attributions |
|---|---|---|
| Chef de Projet | `CHEF_DE_PROJET` | Projets qu'il dirige : découpage et attribution des tâches, coordination, temps passés, validation initiale des besoins de ses projets. |
| Développeur | `DEVELOPPEUR` | Projets auxquels il est affecté, tâches techniques, saisie de son temps, expressions de besoins techniques. |
| Commercial | `COMMERCIAL` | Prospects (leads), création, modification et envoi des devis, paramètres des documents commerciaux. |
| Comptable | `COMPTABLE` | Facturation client/fournisseur, encaissements, exécution des décaissements, pièces de paiement, taux de TVA et de CSS, tableau de bord financier, clôture et fiscalité. |
| Caissier | `CAISSIER` | Caisse au quotidien (entrées et sorties d'espèces), pièces de caisse. |

## 4. Sous-traitants (accès externes cloisonnés)

| Rôle | Nom applicatif | Attributions et limites |
|---|---|---|
| Sous-traitant Développeur | `SOUS_TRAITANT_DEV` | Tâches et tickets des seuls projets auxquels il est assigné (membre), saisie de son temps. Aucune visibilité finances, RH ou autres projets. |
| Sous-traitant Commercial | `SOUS_TRAITANT_COMMERCIAL` | Son propre portefeuille de leads, brouillons de devis : l'**envoi** d'un devis est refusé, il est soumis à validation interne. |
| Sous-traitant Designer | `SOUS_TRAITANT_DESIGNER` | Tâches UI/UX et livrables des projets qui lui sont assignés, sans données financières. |

Un utilisateur qui n'a **que** des rôles de sous-traitant n'accède ni aux
besoins/décaissements, ni aux factures, ni au tableau de bord de la société
(`core.permissions.is_subcontractor_only`).

## 5. Désignations spéciales (cumulables avec tout rôle)

Attribuées exclusivement par un Super-Administrateur, un titulaire unique à la
fois (contraintes en base `single_gerant` et `single_rcf`), hors plafond :

| Désignation | Champ | Attributions |
|---|---|---|
| Gérant | `User.is_gerant` | Dernière signature des expressions de besoins, des demandes d'achat et des devis fournisseurs ; modification des taux de TVA et de CSS. |
| Responsable Comptabilité & Finance | `User.is_rcf` | Première validation (contrôle budgétaire) des expressions de besoins. |

Seuls les titulaires **en poste au moment de la demande** signent leur palier
(`DisbursementRequest.assigned_rcf` / `assigned_gerant`) : aucune substitution,
pas même par un Super-Administrateur.

## 6. Règles d'attribution

- **Autorité unique** : seul le Super-Administrateur attribue ou retire des
  rôles, y compris à la création d'un compte (`POST /api/v1/users/provision/`
  et `POST /api/v1/users/<id>/role/` réservés au Super-Admin).
- **Plafond standard** : 2 rôles fonctionnels au maximum par utilisateur
  (ex. Responsable des Opérations + Chef de Projet).
- **Plafond Super-Admin** : le privilège Super-Admin + 2 rôles fonctionnels
  (ex. Super-Admin + Responsable Administratif + Responsable des Opérations).
- Le plafond est vérifié par le serveur (refus 400) et dans l'interface.

## 7. Reclassement des anciens rôles (migration `core 0022`)

| Ancien rôle | Nouveau rôle |
|---|---|
| Administrateur | Responsable Administratif |
| Responsable RH | Responsable Administratif |
| Directeur Financier | Comptable |
| Support Client | Responsable Technique |
| Consultant | Responsable Technique |
| Responsable Marketing | Responsable Marketing & Communication |
| Autre (`AUTRE`, interface) | retiré, sans équivalent |

La migration reporte les utilisateurs et fusionne les permissions de module
de l'ancien rôle dans le nouveau, supprime les anciens rôles, applique le
plafond (rôles les plus élevés conservés selon l'ordre de
`FUNCTIONAL_ROLES`, retraits journalisés `ROLES_PLAFONNES` dans l'audit) et
aligne les profils Firestore quand les identifiants Firebase sont disponibles.
L'interface reclasse aussi à la volée les anciens noms d'un profil pas encore
aligné (`profileRoles`).
