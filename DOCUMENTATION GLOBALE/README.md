# Documentation globale — Soken's Digital

Ce dossier est la documentation d'architecture "vue d'ensemble" du projet :
qui héberge quoi, pourquoi, ce qui a été construit, et comment faire évoluer
les choix d'infrastructure sans tout casser. Il complète (sans le remplacer)
`docs/backend-specifications.md`, qui reste la référence feature-par-feature
du backend.

## Sommaire

1. [Architecture générale](./01-architecture-generale.md) — panorama des
   services (frontend, backend, bases de données, Firebase) et comment ils
   communiquent entre eux.
2. [Stockage de fichiers & migration cloud](./02-stockage-fichiers-et-migration-cloud.md)
   — historique complet de la décision de stockage (Firebase → Supabase →
   Cloudflare R2 → Cloudinary) et **le guide pas-à-pas pour migrer vers un
   autre fournisseur plus tard**.
3. [Module Messagerie](./03-module-messagerie.md) — architecture Firestore
   temps réel + point d'attention sur une duplication existante côté Django.
4. [Roadmap & dette technique](./04-roadmap-et-dette-technique.md) — ce qui
   reste à faire, classé par priorité.

## Comment garder ce dossier à jour

Toute décision d'infrastructure qui change "où vivent les données/fichiers"
ou "quel service externe on paie/n'utilise pas" doit être ajoutée ici, dans
le fichier concerné — avec la date et le **pourquoi**, pas seulement le
"quoi". C'est ce qui permet de comprendre dans six mois pourquoi tel choix a
été fait plutôt qu'un autre, sans avoir à retrouver la conversation d'origine.
