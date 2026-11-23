# Communication digitale : fonctionnement et parcours utilisateurs

Ce document couvre **uniquement** la gestion des services de communication
digitale (pôle Marketing & Communication) : ce que fait l'ERP, comment cela
s'articule avec les modules existants, et le parcours de chaque personne
concernée. Les abonnements de maintenance et d'hébergement suivent le même
mécanisme mais ne sont pas décrits ici.

---

## 1. Ce qui est géré

Section 07 de la grille tarifaire (prix FCFA TTC) :

| Offre | Type | Prix TTC | Contenu mensuel suivi par l'ERP |
|---|---|---|---|
| Essentiel | Abonnement mensuel | 75 000 F | 1 réseau, 8 publications |
| Pro (conseillé) | Abonnement mensuel | 150 000 F | 2 réseaux, 12 publications, 2 vidéos courtes, 1 campagne pub |
| Premium | Abonnement mensuel | 250 000 F | 3 réseaux, 20 publications, 4 vidéos courtes, 3 campagnes pub, **réunion de restitution obligatoire** |
| Visuel (affiche, flyer, post) | Ponctuel | 10 000 F | — |
| Vidéo courte montée (≤ 60 s) | Ponctuel | 25 000 F | — |
| Campagne sponsorisée (mise en place) | Ponctuel | 30 000 F | — |
| Couverture d'événement | Ponctuel | dès 50 000 F | — |
| Plan de communication (3 mois) | Ponctuel | 150 000 F | — |

Les visuels, textes, la gestion des messages et le rapport mensuel inclus
dans les formules sont suivis comme livrables, sans compteur.

**Principe** : un mois = une facture, réglée en une fois. Le travail du mois
ne commence qu'une fois cette facture validée et entièrement payée.

---

## 2. Où le trouver

| Écran | Accès | Contenu |
|---|---|---|
| Marketing > **Abonnements communication** | `/admin/marketing/abonnements` | Indicateurs, alertes, liste des abonnements, onglet *Catalogue & tarifs* |
| Fiche d'un abonnement | `/admin/marketing/abonnements/<id>` | Périodes, facture de chaque mois, compteurs, livrables, clôture |
| Marketing > **Devis** (éditeur) | `/admin/marketing/devis/nouveau` | Liste « + Offre du catalogue » |
| Finance > **Facturation** | `/admin/finance/facturation/<id>` | Validation et encaissement de la facture du mois |

L'entrée de menu dépend du module de droits **Abonnements communication**
(réglable par personne dans Utilisateurs & Rôles).

---

## 3. Articulation avec l'existant

| Module existant | Rôle dans la communication digitale |
|---|---|
| **Clients** (Administration) | Chaque abonnement est rattaché à une fiche client. Le commercial *attribué* à la fiche voit les abonnements de ce client. |
| **Tunnel commercial / Devis** | Le devis présente la formule (insérée depuis le catalogue, prix converti en HT avec la TVA et la CSS du devis). Le client accepte le devis ; l'abonnement se crée ensuite en reprenant ce devis. |
| **Paramètres des devis / Finance** | Les taux de TVA et de CSS en vigueur (modifiables par le gérant, la comptabilité, le Super-Admin) servent au calcul de chaque facture mensuelle. |
| **Facturation** | La facture du mois est une facture ordinaire : numéro `FAC-AAAA-NNNNN`, mentions obligatoires, QR code fiscal, PDF, envoi par e-mail, rattachée au client et au devis. |
| **Comptabilité** | La validation de la facture passe l'écriture des ventes (411 / 706 / TVA / CSS). Aucun encaissement n'est accepté avant. |
| **Suppression de facture** | Depuis Finance (Super-Admin uniquement pour une facture de mois), la suppression d'une facture de mois supprime aussi ce mois et ses livrables ; l'abonnement reste et le mois peut être refacturé. Refus si période comptable clôturée, rapprochement bancaire ou encaissement en trésorerie. L'analytique Finance s'ajuste immédiatement. |
| **Encaissements** | Versements partiels ou « Marquer comme payée », avec reçu. Le paiement complet ouvre le mois de production. |
| **Relances** | Une facture validée et échue déclenche les relances quotidiennes habituelles (si le planificateur est configuré). |
| **Notifications** | Ouverture d'un mois : notification au responsable de compte et à l'équipe Marketing & Communication. |
| **Journal d'audit** | Création, changement de statut, facturation, clôture et report de quotas sont tracés. |
| **Tableau de bord global** | Nombre d'abonnements actifs, revenu mensuel récurrent, mois impayés entamés (clé `subscriptions`). |

---

## 4. Cycle de vie

### 4.1 Abonnement

| Statut | Effet |
|---|---|
| **Actif** | Facturation possible. |
| **Suspendu** | Plus de nouvelle facture ; le mois déjà ouvert peut être terminé et clôturé. |
| **Résilié** | Fin du contrat ; un nouvel abonnement à la même formule redevient possible. |

**Suppression** (Super-Administrateur uniquement, confirmation en tapant SUPPRIMER) : efface l'abonnement, ses mois, ses livrables **et ses factures**, avec leurs versements, reçus, pièces jointes et écritures de vente. Rien n'est supprimé (refus en bloc) si une facture a une écriture dans une période comptable clôturée, une écriture rapprochée d'un relevé bancaire, ou un versement enregistré en caisse ou en banque : la Finance doit d'abord régulariser. Tracé `ABONNEMENT_SUPPRIME` (factures, versements et écritures supprimés), Comptable et Super-Admins prévenus par e-mail. Pour un simple arrêt de contrat, préférer **Résilié**, qui garde l'historique.

Règles à la création :
- formule mensuelle uniquement (les prestations ponctuelles se facturent directement) ;
- si un devis est indiqué, il doit être **accepté** et appartenir au même client ;
- pas de second abonnement non résilié du même client à la même formule.

### 4.2 Mois (période)

```
Générer la facture ──► EN ATTENTE DE PAIEMENT
                          │  Comptable : valider la facture, puis encaisser
                          ▼  (facture validée ET entièrement payée)
                        OUVERT ── production, compteurs ──► Clôturer ──► CLÔTURÉ
```

- La période va du jour de début au même jour du mois suivant moins un (1er au 30 novembre, puis 1er au 31 décembre…).
- Impossible de facturer le mois suivant tant que le mois en cours n'est pas payé : pas de deux mois impayés en parallèle.
- À l'ouverture, les quotas de la formule sont **figés** pour le mois (une modification ultérieure du catalogue ne change pas un mois déjà ouvert), et le report éventuel du mois précédent s'y ajoute.

### 4.3 Livrable

```
Brouillon ──► Contrôle interne ──► Validé client ──► Publié
    ▲               │                    │
    └───────────────┴──── renvoi en brouillon (refus)
```

| Type | Compteur consommé |
|---|---|
| Publication | publications |
| Vidéo courte (≤ 60 s) | vidéos courtes |
| Campagne sponsorisée | campagnes pub |
| Visuel, Gestion des messages, Couverture d'événement | aucun (suivi seulement) |

- Création de livrables uniquement dans un mois **ouvert**.
- **Le compteur ne baisse qu'au passage à « Publié »**, pas à la création. Un livrable publié ne peut plus être modifié ni supprimé.
- Une étape ne peut pas être sautée.
- Si le quota restant ne suffit pas, la publication est refusée : « Quota épuisé : il reste 0 vidéos courtes ce mois-ci. Toute demande hors formule passe par un devis complémentaire. »

### 4.4 Clôture du mois

- **Rapport mensuel obligatoire** : lien `http(s)` ou compte rendu écrit.
- **Premium** : case « Réunion de restitution tenue » obligatoire.
- Quotas non consommés : **perdus**, sauf **report exceptionnel** vers le mois suivant, limité à ce qui reste et accompagné d'un motif (tracé `QUOTA_REPORTE`).

---

## 5. Exemple : formule Pro, novembre 2026

1. Devis DEV-2026-00042 accepté par l'Hôtel X (formule Pro insérée depuis le catalogue).
2. Le Responsable Marketing & Communication crée l'abonnement : client Hôtel X, formule Pro, début le 01/11/2026, réseaux Facebook et Instagram, devis DEV-2026-00042.
3. Il clique sur **Générer la facture du mois** : facture brouillon du 01/11 au 30/11, **126 050,42 HT + TVA 22 689,08 + CSS 1 260,50 = 150 000,00 TTC**, échéance le 01/11.
4. Le Comptable valide la facture (écriture des ventes), l'envoie, puis enregistre le virement de 150 000 F. Le mois passe à **Ouvert** ; l'équipe reçoit la notification.
5. L'équipe crée 12 publications, 2 vidéos, 1 campagne, et les fait avancer jusqu'à « Publié ». Une 3e vidéo demandée par le client est refusée par le compteur : un devis complémentaire « Vidéo courte » (25 000 F) est établi.
6. Le 30/11, le responsable clôture avec le lien du rapport. Une publication restante est reportée en décembre, motif : « tournage reporté par le client ».
7. Il génère la facture de décembre (01/12 au 31/12). À son paiement, décembre s'ouvre avec 13 publications.

---

## 6. Parcours par profil

### Responsable Marketing & Communication (gestion complète)
1. Tient le **catalogue** : prix, quotas, réunion obligatoire, activation d'une offre.
2. Prépare le devis avec « + Offre du catalogue » et le fait accepter.
3. Crée l'**abonnement** à partir du devis accepté.
4. Génère la **facture du mois** et prévient la comptabilité.
5. Une fois le mois ouvert, crée et fait valider les **livrables**, suit les compteurs.
6. Surveille les **alertes** : mois impayé entamé, rythme insuffisant, mois terminé non clôturé.
7. **Clôture** le mois avec le rapport, décide d'un éventuel report, puis génère la facture suivante.
8. Suspend ou résilie l'abonnement si besoin.

### Commercial (lecture seule, son portefeuille)
- Insère les offres du catalogue dans ses devis.
- Voit les abonnements des clients qui lui sont attribués ou issus de ses devis : mois en cours, consommation, factures.
- Ne crée ni ne modifie aucun abonnement ; une demande hors formule devient un nouveau devis.

### Comptable
- Voit tous les abonnements de communication en lecture.
- Peut générer la facture du mois.
- **Valide** la facture puis **encaisse** ; c'est le paiement complet d'une facture validée qui ouvre le mois.
- Rapproche facturé et livré grâce aux mois clôturés et à leurs rapports.

### Gérant
- Fixe, avec la comptabilité et le Super-Admin, les taux de TVA et de CSS appliqués aux factures mensuelles.

### Super-Administrateur
- Tous les droits ci-dessus ; règle par personne l'accès au module *Abonnements communication*.

### Autres profils
- Responsable Technique et Responsable des Opérations gèrent la maintenance, pas la communication.
- Développeurs, chefs de projet et sous-traitants n'ont aucun accès aux abonnements.

---

## 7. Indicateurs et alertes

| Indicateur | Définition |
|---|---|
| Abonnements actifs | Abonnements au statut Actif. |
| Revenu mensuel récurrent | Somme des prix TTC mensuels des abonnements actifs. |
| Mois impayés entamés | Mois commencé dont la facture n'est pas réglée : le client est servi sans avoir payé. |
| Alerte de rythme | Plus de la moitié du mois écoulée et moins de 40 % des quotas publiés : risque de tout livrer en fin de mois. |
| Mois terminé non clôturé | Mois fini sans rapport : écart entre facturé et livré. |

Chaque alerte ouvre la fiche de l'abonnement concerné.

---

## 8. Messages d'erreur courants

| Message | Cause | Que faire |
|---|---|---|
| « Validez d'abord la facture (écriture comptable) avant d'enregistrer un paiement. » | Encaissement d'une facture brouillon | Le Comptable valide la facture. |
| « La facture de la période en cours n'est pas encore réglée. » | Facturation du mois suivant alors que le mois en cours est impayé | Encaisser d'abord le mois en cours. |
| « Période non ouverte : la facture du mois doit être entièrement payée avant toute production. » | Livrable créé sur un mois impayé | Attendre le paiement complet. |
| « Quota épuisé… » | Publication au-delà de la formule | Devis complémentaire. |
| « Le rapport mensuel est obligatoire… » / « …réunion de restitution… » | Clôture incomplète | Joindre le rapport ; cocher la réunion (Premium). |
| « Un report exceptionnel doit être motivé. » | Report sans motif | Saisir le motif. |
| « Ce client a déjà un abonnement en cours à cette formule. » | Doublon | Modifier ou résilier l'abonnement existant. |
| « Seul un devis accepté peut ouvrir un abonnement. » | Devis non accepté | Faire accepter le devis. |

---

## 9. Points d'attention

- La facture du mois suivant est générée **à la main** (choix de fonctionnement) : penser à la créer en fin de mois.
- Les **relances automatiques** d'impayés supposent le planificateur configuré (secret `CRON_SECRET` sur le backend, secrets GitHub `BACKEND_URL` et `CRON_SECRET`).
- Un prix ou un quota personnalisé pour un client peut être saisi sur l'abonnement (champ réservé à l'API pour l'instant, pas encore dans l'écran).
- Les livrables ne sont pas encore reliés aux tâches de projet depuis l'interface.
