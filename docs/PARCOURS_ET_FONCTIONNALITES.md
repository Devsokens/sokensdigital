# Fonctionnalités récentes et parcours utilisateurs

Ce document décrit le comportement des fonctionnalités ajoutées récemment, la
façon dont elles s'articulent avec l'existant (devis, factures, paiements,
besoins, tickets, projets), et le parcours de chaque profil. Références
détaillées : `ROLES_ET_PERMISSIONS.md`, `ABONNEMENTS_SERVICES.md`.

Sommaire : 1. Rôles et désignations · 2. Besoins et décaissements · 3. Devis ·
4. Factures et taxes · 5. Documents et authentification · 6. Abonnements de
services · 7. Notifications et messagerie · 8. Parcours par profil · 9. Vérification de cohérence et écarts connus.

---

## 1. Rôles et désignations

**13 rôles** : Super-Admin plus 12 rôles fonctionnels (Resp. des Opérations,
Resp. Technique, Resp. Marketing & Communication, Resp. Administratif, Chef de
Projet, Développeur, Commercial, Comptable, Caissier, et 3 sous-traitants :
Développeur, Commercial, Designer).

| Règle | Comportement |
|---|---|
| Attribution | Seul le Super-Admin modifie les rôles d'un compte existant. |
| Cas strict | Un Super-Admin ne peut pas modifier les rôles ni les permissions d'un **autre** Super-Admin (403 ; option masquée dans l'interface). |
| Plafond | 2 rôles fonctionnels maximum par personne, le Super-Admin en plus. Refus 400 côté serveur, blocage dans les formulaires. |
| Création de compte | Super-Admin ou Resp. Administratif ; seul un Super-Admin crée un compte Super-Admin. |
| Suppression / désactivation | Super-Admin uniquement. |
| Sous-traitants | Aucun accès aux finances, au tableau de bord société, ni aux abonnements ; le Sous-traitant Commercial n'a que son portefeuille et ne peut ni envoyer un devis, ni le convertir en facture. |

**Désignations** (champs `is_gerant`, `is_rcf`), attribuées par le Super-Admin :
- Un seul titulaire à la fois pour chacune (contrainte en base).
- **Poste pourvu : toute nomination supplémentaire est refusée (409) et l'option disparaît de l'interface.** Il faut d'abord retirer le titre au titulaire actuel.
- Seul le titulaire en poste **au moment de la demande** signe son palier : aucune substitution, pas même par le Super-Admin. Exception : si le poste était **vacant** à la création du besoin, le palier RCF peut être signé par un Comptable ou le Super-Admin, et le palier Gérant par le Super-Admin.

## 2. Besoins et décaissements

Parcours d'un besoin :
1. **Expression** : tout employé actif (hors sous-traitant) depuis l'interface de son département ; devis ou pièces jointes possibles tant que la demande n'est pas tranchée.
2. **Palier RCF** (statut *En attente RCF*) : le Responsable Comptabilité & Finance désigné à ce moment approuve avec **signature manuscrite**, ou rejette avec un motif obligatoire.
3. **Palier Gérant** (*En attente Gérant*) : le gérant désigné à ce moment approuve avec signature, ou rejette (motif obligatoire).
4. **Approuvé**, puis **Exécuté** par le Comptable (ou le Super-Admin) : l'argent a bougé.
5. Le demandeur est notifié à chaque étape.

Garde-fous : on ne valide jamais sa propre demande ; les deux signatures
figurent sur le bon PDF, avec le nom du gérant en poste ; tout est visible dans
Finance > Décaissement.

## 3. Devis

- Montants saisis en **HT ou TTC** selon le paramètre des devis ; **TVA et CSS dynamiques**, figées sur le devis à sa création.
- Taux TVA/CSS modifiables par le gérant, la comptabilité et le Super-Admin (paramètres des devis, qui reprennent les paramètres Finance).
- Envoi du devis en **PDF** (pas un lien) ; téléchargement possible en administration ; l'envoi est réservé à l'équipe commerciale interne.
- **Nouveau** : l'éditeur propose « + Offre du catalogue » (grille tarifaire) ; le prix TTC de la grille est converti en HT avec les taux du devis.
- Un devis accepté peut être converti en facture (une seule fois) ; le Commercial n'y accède que pour ses propres devis.

## 4. Factures et taxes

- Mentions obligatoires : identification fournisseur et client (NIF), numéro séquentiel `FAC-AAAA-NNNNN`, détail des lignes, HT / TVA / CSS / autres taxes / TTC, **QR code fiscal** signé.
- Cycle : **Brouillon** → validation par le Comptable → **Validée**. La validation crée l'écriture des ventes (clients 411, ventes 706, TVA 4457, CSS, autres taxes) dans une période comptable ouverte ; une facture validée n'est plus modifiable.
- Encaissement : versements partiels ou solde en une fois, avec reçu PDF. Une facture est « payée » quand les versements reçus couvrent le TTC.
- Le **tableau de bord Finance** affiche TVA et CSS collectées ; relances d'impayés **internes** : chaque jour, pour toute facture validée, échue et non soldée, l'auteur de la facture (et, pour un abonnement, les responsables du pôle), les Comptables et le RCF sont notifiés dans l'application ; **aucun e-mail n'est envoyé au client**, ils le relancent manuellement. Une facture entièrement payée n'est plus relancée.

## 5. Documents et authentification

- Pièces de trésorerie (entrée / sortie) : **logo Soken's Digital**, nom et signature du gérant et du RCF en poste, **QR code d'authentification**.
- Chaque QR renvoie vers une page publique de vérification (`/verification-document` pour les pièces, vérification de facture pour les factures) : la signature (HMAC) est contrôlée côté serveur, sans compte requis.

## 6. Abonnements de services (communication et maintenance)

Une nouvelle app `services` s'appuie sur les modules existants sans créer de second moteur financier.

**Objets** : *offre* (catalogue de la grille) → *abonnement* (client + offre) → *période* (mois, ou année pour l'hébergement ; une facture par période) → *livrables* (production du mois).

**Parcours** :
1. Le responsable du pôle crée l'abonnement (client, formule, début, réseaux ou application maintenue).
2. « Générer la facture du mois » crée la période et une **facture Brouillon** au TTC exact de la formule (taux TVA/CSS en vigueur). Impossible tant que la période précédente n'est pas réglée.
3. Le Comptable valide la facture (écriture comptable) et enregistre le paiement.
4. **Paiement complet → la période s'ouvre automatiquement** (quotas figés, report éventuel ajouté), le pôle est notifié.
5. Les livrables suivent Brouillon → Contrôle interne → Validé client → Publié (*Livré* en maintenance). **Le quota n'est consommé qu'à la publication ou la livraison** ; au-delà, refus avec renvoi vers un devis complémentaire.
6. **Clôture** : rapport obligatoire (lien http(s) ou compte rendu) ; réunion de restitution obligatoire pour Premium ; quotas restants perdus, sauf report exceptionnel motivé (audit `QUOTA_REPORTE`).
7. Le bouton de facturation prépare le mois suivant (aucune tâche planifiée : manuel par choix).

**Droits** : Communication gérée par Super-Admin et Resp. Marketing & Communication ; Maintenance par Super-Admin, Resp. Technique et Resp. des Opérations ; Comptable en lecture et facturation ; Commercial en lecture limitée à son portefeuille ; sous-traitants exclus.

**Tableau de bord** : mois commencés non payés, consommation des quotas, alerte de rythme (moins de 40 % produit passé la moitié du mois), périodes terminées non clôturées, renouvellements d'hébergement à 30 jours, tickets sans réponse dans le délai de la formule (72 h / 24 h / 4 h), revenu mensuel récurrent par pôle.

## 7. Notifications et messagerie

- Notifications in-app, navigateur et e-mail (selon l'événement) ; bouton **Effacer les lues** et marquage comme lues.
- Réunions et rendez-vous : notification à la création, avec lien visio ; les rendez-vous vont à tous les membres.
- Pièces jointes de messagerie **permanentes** (stockage privé, liens signés à la demande) ; création de message horodatée par le serveur.

## 8. Parcours par profil

| Profil | Parcours type |
|---|---|
| **Super-Admin** | Crée les comptes et attribue 1 à 2 rôles ; désigne le Gérant et le RCF ; supervise tous les pôles ; peut tout gérer sauf modifier un autre Super-Admin. |
| **Resp. Administratif** | Crée les comptes (hors Super-Admin), tient les dossiers collaborateurs et contrats ; ne peut ni attribuer de rôle ni supprimer un compte. |
| **Gérant / RCF** | Reçoit une notification pour chaque besoin à son palier, signe ou rejette ; le gérant voit aussi les taxes collectées (avec la comptabilité et le Super-Admin). |
| **Comptable** | Valide les factures, encaisse, exécute les décaissements, règle TVA/CSS, génère les factures d'abonnement. |
| **Resp. Marketing & Communication** | Devis, tunnel commercial, blog, abonnements de communication : abonnement → facture → quota ouvert → livrables → clôture. |
| **Resp. Technique / Opérations** | Projets, maintenance, tickets ; abonnements de maintenance et d'hébergement, suivi des délais de réponse. |
| **Commercial** | Ses leads et ses devis, offres du catalogue dans l'éditeur ; lecture de ses abonnements de communication. |
| **Chef de projet / Développeur** | Projets et tâches, expression de besoins par département ; aucun accès aux abonnements. |
| **Sous-traitants** | Uniquement leurs projets ou leur portefeuille ; jamais de finances ni de tableau de bord société. |

## 9. Vérification de cohérence et écarts connus

**Cohérent avec l'existant (vérifié dans le code et par la suite de tests, qui passe entièrement)** :
- Les abonnements réutilisent `core.permissions.has_role`, `is_subcontractor_only`, `AuditLog`, `notify` et les taux de `FinanceSettings`.
- La facture de période passe par le modèle `Invoice` (numérotation, totaux, validation, écriture comptable, relances, PDF, QR).
- Tous les chemins d'encaissement (solde en une fois, versement reçu, saisie directe) ouvrent la période, via un signal sur `Payment`.
- Les liens de rapport et de preuve sont limités à http(s) ; le Commercial est cloisonné à son portefeuille.

**Écarts corrigés** (suite de tests complète au vert) :
1. **Paiement avant validation** : un versement ou « Marquer comme payée » est refusé sur une facture Brouillon (« Validez d'abord la facture ») ; les boutons d'encaissement sont masqués tant que la facture n'est pas validée. « Versement reçu » ne change plus le statut de la facture (il sautait l'écriture comptable). Une période d'abonnement ne s'ouvre que si sa facture est **validée et** entièrement payée ; la validation d'une facture déjà soldée ouvre aussi la période.
2. **Lien abonnement ↔ devis** : champ « Devis accepté d'origine » à la création ; le serveur refuse un devis non accepté ou appartenant à un autre client.
3. **Doublons** : un second abonnement non résilié pour le même client, la même formule et la même application est refusé.
4. **Menu** : modules de droits dédiés `abonnements-communication` et `abonnements-maintenance`, attribués aux rôles concernés (migration `services 0003`) et réglables par personne dans Utilisateurs & Rôles.
5. **Relances et cache** : point d'entrée `POST /api/v1/cron/daily/` protégé par le secret `CRON_SECRET`, appelé chaque jour à 7 h UTC par le workflow GitHub `daily-jobs.yml` (relances devis et factures). Le tableau de bord global est rafraîchi dès l'ouverture d'une période.

**Reste à faire (hors code)** :
- **Relances** : définir `CRON_SECRET` sur le service backend (Render) et les secrets GitHub `BACKEND_URL` et `CRON_SECRET` ; sans eux, le point d'entrée reste désactivé et le workflow ne fait rien.
- **Règles Firestore** : `firebase deploy --only firestore:rules --project sokensdigital-2d82a` avec le compte propriétaire du projet.
