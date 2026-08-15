# Roadmap & dette technique

## Décisions à prendre (bloquant pour la suite du module concerné)

- **Consolidation Messagerie** — choisir entre garder le flux Firestore
  direct ou brancher l'app Django `messaging` prévue par le cahier des
  charges. Détail : [03-module-messagerie.md](./03-module-messagerie.md).
  Implique aussi de trancher le doublon `projects.Project` /
  `technique.Project`.
- **Frontend Vercel** — le domaine de production renvoie 404 malgré un
  build réussi côté Vercel (probable souci d'assignation de domaine, voir
  onglet **Domains** du projet). En local (`npm run dev`) tout fonctionne.
  À investiguer avec accès au dashboard Vercel.

## Améliorations prévues, non urgentes

- **Notifications push (Firebase Cloud Messaging)** — pas encore
  implémenté. Pas de blocage connu (contrairement à Storage, FCM n'exige
  pas de plan payant).
- **Migration éventuelle du stockage fichiers vers Firebase Storage** — si
  une carte bancaire devient disponible, ça unifierait l'infra sur Firebase
  seul (Auth + Firestore + Storage) au lieu de Cloudinary en plus. Guide
  complet : [02-stockage-fichiers-et-migration-cloud.md](./02-stockage-fichiers-et-migration-cloud.md).
- **Suivi du quota Supabase** — l'organisation était à 250% de son quota
  gratuit d'egress au moment de la rédaction (période de grâce jusqu'au
  14/09/2026, cf. dashboard Supabase → Organization → Billing). Le CMS
  marketing reste dessus ; si le dépassement persiste après la période de
  grâce, ce sera la prochaine chose à traiter (upgrade payant, ou migration
  du bucket `site-content` vers Cloudinary/un autre fournisseur en suivant
  le même guide de migration).

## Historique des grandes décisions (les plus récentes en premier)

| Date | Décision | Raison |
|---|---|---|
| 2026-08 | Stockage fichiers utilisateurs (avatars, pièces jointes) → **Cloudinary** | Firebase Storage/R2/GCS exigent tous une carte bancaire même pour le tier gratuit ; Supabase déjà en dépassement de quota. Cloudinary : inscription confirmée sans carte. |
| 2026-08 | Refonte complète du module Messagerie (DM, réactions, pièces jointes, fils de discussion, liaison projet/lead/devis) | Passage de la maquette "Back Office - Refonte" à une implémentation complète, alignée sur Firestore temps réel. |
| 2026-08 | Refonte de la navigation (rail d'icônes + panneau secondaire, sidebar sombre) | Alignement sur la maquette Canva-style fournie. |
| 2026-08 | Ajout d'un fond vidéo animé au module Projets | Demande explicite ; vidéo compressée via ffmpeg (47 Mo → 1,3 Mo). |
| 2026-08 | Redesign complet du module Projets (cartes, tags, filtres, Kanban de tâches, Team Timesheet) | Alignement sur maquette Canva-style, scope "UI + nouveaux champs backend" choisi explicitement. |
| — | Base applicative sur **Supabase Postgres**, pas le Postgres gratuit de Render | Le Postgres gratuit Render est supprimé définitivement 30+14 jours après création — inacceptable pour une base de production. |
| — | Cache/file de tâches sur **Upstash Redis**, pas le Key Value gratuit de Render | Zéro persistance disque côté Render, redémarrages de maintenance imprévisibles. |

*Ce tableau se complète au fil des sessions — ajouter une ligne à chaque
décision d'infrastructure ou de scope significative, avec la raison, pas
seulement le "quoi".*
