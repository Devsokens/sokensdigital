# Module Messagerie

## Architecture : Firestore comme source unique du contenu

Le contenu de la messagerie (salons, messages, réactions, pièces jointes,
épinglage) vit **exclusivement dans Firestore**, jamais dupliqué dans
Postgres. Django n'est jamais dans le chemin critique de l'envoi/réception
d'un message — le frontend écrit/lit directement Firestore via le SDK
client, en temps réel (`onSnapshot`).

```
frontend/lib/firebase/chat.ts
  ├─ subscribeToRooms()       → écoute chatRooms/{id} (temps réel)
  ├─ subscribeToMessages()    → écoute chatRooms/{id}/messages (temps réel)
  ├─ sendMessage()            → écrit dans Firestore directement
  ├─ toggleReaction()         → écrit dans Firestore directement
  └─ togglePinned()           → écrit dans Firestore directement
```

La sécurité (qui peut lire/écrire quel salon) est appliquée par
**`firestore.rules`**, pas par Django — Firestore vérifie côté serveur
Google que l'utilisateur authentifié a le droit d'accéder au document
demandé (appartenance département/projet, ou membre direct pour les DM).

### Types de salons
- `COMPANY` — un salon global, tout le monde peut lire, écriture restreinte
  (direction/marketing) sauf annonces.
- `DEPARTMENT` — un salon par département, créé automatiquement par Django
  à la création du département (`core/views.py::DepartmentViewSet.perform_create`
  → `upsert_chat_room()`).
- `PROJECT` — salon par projet.
- `DIRECT` — messages privés 1-à-1, id déterministe (`dm_{uid1}_{uid2}`
  triés) pour éviter les doublons si on relance une conversation avec la
  même personne.

### Fichiers (avatars, pièces jointes)
Ne vivent pas dans Firestore (mauvais fit pour du binaire) — uploadés via
Django vers Cloudinary, l'URL résultante est stockée comme simple champ
texte dans le document Firestore. Détail complet dans
[02-stockage-fichiers-et-migration-cloud.md](./02-stockage-fichiers-et-migration-cloud.md).

## ⚠️ Point d'architecture non résolu : deux systèmes de gouvernance de salons

Il existe **deux façons distinctes** de gérer "qui a le droit d'être dans
quel salon", construites à des moments différents, qui **coexistent sans
être consolidées** :

1. **Le système en prod, utilisé par ce qui a été construit dans cette
   session** : appel direct à `core/firestore_client.py`
   (`upsert_chat_room()`, `set_chat_room_members()`) depuis les vues Django
   concernées (ex. `DepartmentViewSet.perform_create`), sans aucune table
   Postgres de gouvernance. Le salon existe uniquement comme document
   Firestore.

2. **L'app Django `messaging`** (`backend/messaging/`) — modèles
   `ChannelMetadata` et `ChannelParticipant`, prévue par le cahier des
   charges (§5.1.A) pour piloter la gouvernance des salons *depuis*
   Postgres (RBAC, appartenance département/projet) et synchroniser vers
   Firestore. **Cette app existe dans le code mais n'est pas branchée sur
   le flux réellement utilisé par le frontend actuel.**

Autre incohérence liée : l'app `messaging` référence `technique.Project`
(département Technique), alors que le module Projets construit dans cette
session utilise `projects.Project` (app pré-existante `main`) — deux
modèles Project distincts, non reliés. Les salons de projet créés via
`projects/views.py` ne sont donc pas visibles pour l'app `messaging`.

**Ce n'est pas cassé aujourd'hui** — le flux Firestore direct fonctionne et
c'est ce que les utilisateurs voient. Mais avant de développer davantage
sur `backend/messaging/`, une décision d'équipe est nécessaire :

- **Option A** — Supprimer l'app `messaging` (ou la geler), garder le
  système Firestore-direct qui est déjà en prod. Le plus simple, mais
  s'éloigne du cahier des charges §5.1.A tel qu'écrit.
- **Option B** — Migrer le système Firestore-direct pour passer par l'app
  `messaging` (Postgres devient la source de vérité de la gouvernance,
  Firestore reste la source de vérité du contenu). Plus proche du cahier
  des charges, mais nécessite de résoudre le doublon `projects.Project` /
  `technique.Project` d'abord, et de réécrire les points d'entrée actuels
  (`DepartmentViewSet.perform_create`, création de salon projet, etc.).

Voir [04-roadmap-et-dette-technique.md](./04-roadmap-et-dette-technique.md)
pour le suivi de cette décision.

## Notifications push (Firebase Cloud Messaging)

Pas encore implémenté. Techniquement indépendant du sujet stockage/messagerie
temps réel — Cloud Messaging n'a pas d'exigence de plan payant (contrairement
à Storage), donc pas de blocage connu pour l'ajouter plus tard. Voir la
roadmap.
