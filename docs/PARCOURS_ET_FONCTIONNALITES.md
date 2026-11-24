# Fonctionnalités récentes et parcours utilisateurs

Ce document décrit le comportement des fonctionnalités ajoutées récemment, la
façon dont elles s'articulent avec l'existant (devis, factures, paiements,
besoins, tickets, projets), et le parcours de chaque profil. Références
détaillées : `ROLES_ET_PERMISSIONS.md`, `ABONNEMENTS_SERVICES.md`.

Sommaire : 1. Rôles et désignations · 2. Besoins et décaissements · 3. Devis ·
4. Factures et taxes · 5. Documents et authentification · 6. Abonnements de
services · 7. Notifications et messagerie · 8. Parcours par profil ·
9. Vérification de cohérence et écarts connus · 10. Clôture comptable ·
11. Trésorerie : apport capital en caisse · 12. Actualisation automatique.

*Mis à jour le 24/11/2026.*

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

Garde-fous : on ne valide jamais sa propre demande — **une exception** :
le Responsable Comptabilité & Finance désigné sur la demande peut valider le
palier RCF de ses propres besoins (le Gérant signe toujours ensuite et ne
valide jamais sa propre demande) ; les deux signatures
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
- Encaissement : versements partiels ou solde en une fois, avec reçu PDF. Une facture est « payée » quand les versements reçus couvrent le TTC. **Aucun encaissement sur une facture Brouillon** : elle doit d'abord être validée (écriture comptable).
- **PDF sur une seule page A4**, police 12 px aérée ; au-delà de 8 lignes puis de 14, seul le tableau se resserre.
- **Suppression** (menu « ⋯ » de la liste des factures) : le Comptable ne supprime qu'un brouillon hors abonnement ; une facture validée, payée ou issue d'un abonnement exige le Super-Admin. La suppression emporte versements, reçus, pièces jointes, écritures de vente et le mois d'abonnement rattaché. Refusée si une écriture est dans une période clôturée, rapprochée d'un relevé bancaire, ou si un versement est enregistré en caisse/banque. Audit `FACTURE_SUPPRIMEE`.
- **Analytique Finance et tableau de bord global toujours à jour** : recalculés dès qu'une facture, un versement ou une écriture change (création, modification, suppression).
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

**Suppression d'un abonnement** : Super-Admin uniquement (confirmation en tapant SUPPRIMER) ; emporte ses mois, livrables et factures (même suppression propre et mêmes refus que ci-dessus). Pour un arrêt de contrat, préférer « Résilié ».

**Tableau de bord** : mois commencés non payés, consommation des quotas, alerte de rythme (moins de 40 % produit passé la moitié du mois), périodes terminées non clôturées, renouvellements d'hébergement à 30 jours, tickets sans réponse dans le délai de la formule (72 h / 24 h / 4 h), revenu mensuel récurrent par pôle.

## 7. Notifications et messagerie

**Notifications**
- In-app, navigateur (push) et e-mail selon l'événement ; bouton **Effacer les lues** et marquage comme lues.
- Réunions et rendez-vous : notification à la création, avec lien visio ; les rendez-vous vont à tous les membres.
- **Nouveau message** : chaque message envoyé (hors réponses en fil) notifie les autres membres du salon, in-app et push. Titre = expéditeur (et nom du groupe), texte = aperçu du message ; le clic ouvre directement la discussion (`/admin/messagerie?room=…`). Une seule notification par message, contenu relu en base par le serveur (impossible d'en forger). Salon Entreprise : tous les comptes actifs ; Département : ses employés ; Projet / Direct : leurs membres.

**Messagerie** (mise en page des applications de messagerie mobiles)
- Liste des discussions : recherche, filtres *Toutes / Groupes / Privées*, **aperçu du dernier message**, heure, non-lus en gras avec pastille, tri par activité récente. Sur mobile, liste puis conversation plein écran.
- Conversation : bulles (les miennes à droite), heure dans la bulle, séparateurs « Aujourd'hui / Hier », saisie arrondie extensible, pièces jointes, liens vers projet / lead / devis, réactions, épingles, réponses en fil.
- **Accusés de lecture** : deux coches grises = envoyé, bleues = lu (par tous en discussion privée ou groupe de projet ; par au moins un collègue dans les grands groupes, nombre de lecteurs au survol). Le serveur enregistre la lecture (`POST /api/v1/chat/rooms/<id>/read/`).
- **Salons de département** : à l'ouverture de la messagerie, le serveur crée le salon du département de la personne s'il manque et aligne le département du profil (`POST /api/v1/chat/rooms/ensure/`). Renommer un département renomme son salon.
- **Thème sombre** : palette dédiée, contraste correct.
- Pièces jointes **permanentes** (stockage privé, liens signés à la demande) ; création de message horodatée par le serveur.

## 8. Parcours par profil

| Profil | Parcours type |
|---|---|
| **Super-Admin** | Crée les comptes et attribue 1 à 2 rôles ; désigne le Gérant et le RCF ; supervise tous les pôles ; seul à supprimer abonnements, factures validées et périodes comptables ; peut tout gérer sauf modifier un autre Super-Admin. |
| **Resp. Administratif** | Crée les comptes (hors Super-Admin), tient les dossiers collaborateurs et contrats ; ne peut ni attribuer de rôle ni supprimer un compte. |
| **Gérant / RCF** | Reçoit une notification pour chaque besoin à son palier, signe ou rejette ; le RCF peut valider le palier RCF de ses propres besoins ; il est notifié (avec l'action à faire) quand une période comptable est supprimée ; le gérant voit aussi les taxes collectées. |
| **Comptable** | Valide les factures, encaisse, exécute les décaissements, règle TVA/CSS, génère les factures d'abonnement. |
| **Resp. Marketing & Communication** | Devis, tunnel commercial, blog, abonnements de communication : abonnement → facture → quota ouvert → livrables → clôture. |
| **Resp. Technique / Opérations** | Projets, maintenance, tickets ; abonnements de maintenance et d'hébergement, suivi des délais de réponse ; le Resp. des Opérations est informé des suppressions de période comptable. |
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


## 10. Clôture comptable : suppression d'une période

- **Super-Admin uniquement**, bouton « Supprimer » dans Finance > Clôture comptable, **triple confirmation** (la dernière en tapant le libellé exact de la période, vérifié aussi par le serveur).
- **Les écritures comptables sont conservées** : elles restent « sans période » puis sont **rattachées automatiquement** à la prochaine période créée qui couvre leur date. Grand Livre, analytique et rapports gardent toutes les données.
- Refusée si la période est **clôturée** (la rouvrir d'abord : ses écritures verrouillées redeviendraient modifiables) ou si sa **déclaration fiscale est validée**.
- **Notifications distinctes** :
  - *Responsable des Opérations* : information (qui, quelle période, données conservées, aucune action requise) ;
  - *Responsable Comptabilité & Finance* (à défaut, les Comptables), aussi par e-mail : nombre d'écritures sans période et action attendue (créer une période couvrant ces dates).
- Audit `PERIODE_COMPTABLE_SUPPRIMEE`.

## 11. Trésorerie : apport capital converti en caisse

- Pièce de caisse **Entrée**, motif « Conversion d'apport capital en liquidité de caisse » : les fonds de l'apport passent en caisse pour régler les charges en espèces. Plafond : apport disponible (capital apporté − converti + retourné).
- Pièce de caisse **Sortie**, motif « Retour de la caisse vers l'apport capital » : plafond = converti encore en caisse, dans la limite du solde réel.
- **Le capital social (compte 101) n'est jamais modifié.** Écritures au rapprochement : conversion = Débit Caisse 530 / Crédit Banque 512 ; retour = l'inverse (hypothèse : apport déposé en banque).
- Suivi : `GET /api/v1/treasury/capital-liquidity/`, affiché dans le formulaire.

## 12. Actualisation automatique

- Les écrans de données (tableaux de bord, Finance, Marketing, RH, Technique, Support, Agenda, Abonnements…) se rechargent **en arrière-plan toutes les 30 s**, uniquement si l'onglet est visible et que l'utilisateur est inactif (aucune saisie, aucune fenêtre ouverte, aucune action depuis 20 s), ainsi qu'au retour sur l'onglet. Pas d'écran de chargement, filtres et défilement conservés.
- Exclus volontairement : l'éditeur de sections de page et le détail d'un département (une actualisation écraserait la saisie ou la sélection).
- **Nouvelle version** déployée (`/api/version`) : rechargement automatique si l'onglet est caché, sinon bandeau « Actualiser / Plus tard ».
- Messagerie et notifications : temps réel (Firestore).
