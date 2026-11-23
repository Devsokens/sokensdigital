# Abonnements de services

Communication digitale (pôle Marketing & Communication) et Maintenance &
hébergement (pôle Technique), adossés aux modules Devis, Facture et Paiement
existants. Code : `backend/services/`, écrans `/admin/marketing/abonnements`
et `/admin/technique/abonnements`.

## Catalogue
`ServiceOffer`, pré-rempli depuis la grille tarifaire (migration
`services 0002`) : formules mensuelles Essentiel / Pro / Premium,
prestations ponctuelles, Hébergement & domaine (annuel), Maintenance
Essentiel / Pro / Premium (délai de réponse 72 h / 24 h / 4 h). Prix TTC et
quotas modifiables par le responsable du pôle (onglet « Catalogue &
tarifs »). L'éditeur de devis propose « + Offre du catalogue » (prix
converti en HT).

## Cycle
1. Devis accepté → « Nouvel abonnement » (client, formule, date de début).
2. « Générer la facture du mois » (manuel) : crée la période et sa facture
   BROUILLON (TTC exact de l'offre, taux TVA/CSS en vigueur). Impossible
   tant qu'une période précédente attend son paiement.
3. Paiement complet de la facture (Finance) → la période s'ouvre
   automatiquement, quotas figés (+ report éventuel), notification.
4. Livrables : Brouillon → Contrôle interne → Validé client → Publié
   (Livré pour la maintenance). Le quota n'est consommé qu'à la
   publication / livraison ; au-delà, refus → devis complémentaire.
5. Clôture : rapport (lien ou compte rendu) obligatoire, réunion obligatoire
   pour Premium. Quotas restants perdus, sauf report exceptionnel motivé
   (audit `QUOTA_REPORTE`).

## Tableau de bord
Mois entamés impayés, consommation des quotas, alerte de rythme (moins de
40 % produit passé la moitié du mois), périodes terminées non clôturées,
renouvellements d'hébergement à 30 jours, tickets sans réponse au-delà du
délai de la formule, revenu mensuel récurrent par pôle (aussi dans le
tableau de bord global, clé `subscriptions`).

## Droits
| Pôle | Gestion | Lecture seule |
|---|---|---|
| Communication | Super-Admin, Resp. Marketing & Communication | Comptable, Commercial |
| Maintenance | Super-Admin, Resp. Technique, Resp. des Opérations | Comptable |

Le Comptable peut aussi générer les factures. Sous-traitants : aucun accès.
