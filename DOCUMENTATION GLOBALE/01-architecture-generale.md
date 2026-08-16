# Architecture générale

## Vue d'ensemble

```
┌─────────────────────┐      REST (JSON)      ┌──────────────────────┐
│  Frontend Next.js    │ ───────────────────▶  │  Backend Django       │
│  (Vercel)             │ ◀───────────────────  │  (Render, Docker)    │
└──────────┬───────────┘                        └──────────┬───────────┘
           │                                                │
           │ SDK Firebase (Auth, Firestore)                 │ psycopg2
           ▼                                                ▼
┌──────────────────────┐                        ┌──────────────────────┐
│  Firebase             │                        │  Supabase Postgres    │
│  - Auth (comptes)     │                        │  (base applicative     │
│  - Firestore           │                        │   principale)          │
│    (messagerie temps  │                        └──────────────────────┘
│    réel, profils)      │
└──────────────────────┘                        ┌──────────────────────┐
                                                  │  Upstash Redis         │
           Upload fichiers (via Django)          │  (cache + file Celery) │
           ▼                                     └──────────────────────┘
┌──────────────────────┐
│  Cloudinary            │   ┌──────────────────────┐
│  (avatars, pièces      │   │  Supabase Storage      │
│  jointes chat)         │   │  (assets site marketing│
└──────────────────────┘   │   uniquement — CMS)     │
                             └──────────────────────┘
```

## Les briques et leur rôle

### Frontend — Next.js 16 (Turbopack), déployé sur **Vercel**
- Toute l'interface (site public + back-office `/admin`).
- Parle au backend Django en REST (`NEXT_PUBLIC_API_BASE_URL`).
- Parle directement à Firebase (Auth + Firestore) via le SDK client
  `firebase/*` — pas de proxy Django pour l'authentification ou la
  messagerie temps réel, c'est le SDK qui gère la connexion en direct.

### Backend — Django + Django REST Framework, déployé sur **Render** (Docker)
- API REST versionnée (`/api/v1/...`), un module Django par département
  métier : `core`, `projects`, `hr`, `marketing`, `finance`, `technique`,
  `administration`, `messaging` (voir [03-module-messagerie.md](./03-module-messagerie.md)
  pour le cas particulier de ce dernier).
- Authentification : `core.authentication.FirebaseAuthentication` — vérifie
  le token Firebase ID envoyé en `Authorization: Bearer ...` par le
  frontend, ne gère aucune session/mot de passe lui-même.
- RBAC (rôles applicatifs) géré côté Django (`core.permissions.has_role`),
  synchronisé avec le rôle stocké dans le profil Firestore de l'utilisateur.

### Base de données applicative — **Supabase Postgres** (pas Render)
- Toutes les données métier "classiques" : projets, RH, finance, marketing,
  audit log, etc. — tout ce qui n'est pas la messagerie temps réel.
- Choisi plutôt que le Postgres gratuit de Render, qui est supprimé
  définitivement 30+14 jours après création. Le plan gratuit Supabase se
  met en pause après 7 jours d'inactivité mais ne supprime jamais les
  données (clic "Restore" pour réactiver).
- Détail complet : `docs/backend-specifications.md` §0.

### Cache & file de tâches — **Upstash Redis**
- `django-redis` pour le cache, Celery pour les tâches asynchrones (leads,
  notifications, génération de PDF, publication réseaux sociaux, rappels
  programmés).
- Choisi plutôt que le Key Value gratuit de Render (zéro persistance disque,
  redémarrages de maintenance imprévisibles).

### Firebase — **Auth + Firestore uniquement** (pas de Storage, pas de Cloud Messaging pour l'instant)
- **Auth** : comptes utilisateurs (email/mot de passe), source de vérité de
  l'identité. Le token ID Firebase est ce que le frontend envoie à Django à
  chaque requête API.
- **Firestore** : deux usages —
  1. **Profils** (`profiles/{uid}`) : rôle, département, nom, avatar — lu
     par le frontend directement, et par Django via
     `core/firestore_client.py` pour la synchro RBAC.
  2. **Messagerie temps réel** (`chatRooms/{id}/messages/{id}`) — voir
     [03-module-messagerie.md](./03-module-messagerie.md).
- **Storage n'est PAS utilisé.** Google exige désormais un compte de
  facturation (plan Blaze) même pour rester dans le quota gratuit — décision
  explicite de ne pas y souscrire pour l'instant. Voir le fichier suivant
  pour ce qui est utilisé à la place.

### Stockage de fichiers — **Cloudinary** (utilisateurs) + **Supabase Storage** (marketing)
Deux destinations distinctes, volontairement séparées :
- **Cloudinary** : avatars de profil, pièces jointes de la messagerie —
  trafic généré par les utilisateurs de l'app, potentiellement variable.
- **Supabase Storage** (bucket `site-content`) : uniquement les assets du
  CMS marketing (logos partenaires, photos d'équipe, vidéos de démo
  showcase) — trafic public du site vitrine.
- Historique complet des raisons de ce choix et **guide de migration futur**
  dans [02-stockage-fichiers-et-migration-cloud.md](./02-stockage-fichiers-et-migration-cloud.md).

## Qui parle à qui (résumé)

| Depuis | Vers | Comment |
|---|---|---|
| Frontend | Backend Django | REST, `Authorization: Bearer <firebase-id-token>` |
| Frontend | Firebase Auth | SDK client (`firebase/auth`) |
| Frontend | Firestore | SDK client (`firebase/firestore`), lecture/écriture directe régie par `firestore.rules` |
| Frontend | Cloudinary | Jamais directement — toujours via un endpoint Django (`/api/v1/uploads/...`) qui fait l'upload avec les identifiants serveur |
| Backend Django | Supabase Postgres | `psycopg2` / ORM Django, `DATABASE_URL` |
| Backend Django | Upstash Redis | `django-redis` / Celery, `REDIS_URL` |
| Backend Django | Firebase Admin SDK | `firebase-admin` (Python) — vérifie les tokens, lit/écrit Firestore côté serveur (ex. création d'un profil à la provision d'un employé) |
| Backend Django | Cloudinary | SDK `cloudinary` (Python), identifiants dans `backend/.env` |
| Backend Django | Supabase Storage | REST direct (`requests`), identifiants `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` |

## Pourquoi le frontend n'uploade jamais directement vers un service de stockage

Volontaire et important pour la suite : **le frontend ne connaît aucun
identifiant de stockage** (pas de clé Cloudinary, pas de clé Supabase côté
client). Tout upload de fichier passe par un endpoint Django
(`/api/v1/uploads/avatar/`, `/api/v1/uploads/chat-attachment/`), qui lui-même
appelle `backend/core/storage.py`. Cette indirection a deux effets :

1. Les identifiants du fournisseur de stockage ne sont jamais exposés côté
   navigateur.
2. **Changer de fournisseur de stockage ne touche qu'un seul fichier
   backend** (`core/storage.py`) — zéro changement frontend, zéro changement
   d'URL d'API publique. C'est ce qui rend la migration future simple : voir
   [02-stockage-fichiers-et-migration-cloud.md](./02-stockage-fichiers-et-migration-cloud.md).
