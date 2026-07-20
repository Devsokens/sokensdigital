# Soken's Digital — Plateforme interne

Site vitrine public + back-office multi-départements (RH, Finance, Technique, Marketing) pour Soken's Digital.

## Architecture

Le projet repose sur **deux backends complémentaires**, chacun responsable d'un périmètre précis — ce n'est pas une redondance, c'est une répartition volontaire (voir `docs/backend-specifications.md §0` pour le détail des raisons) :

| Domaine | Techno | Pourquoi |
|---|---|---|
| Authentification | **Firebase Auth** | Gère les comptes utilisateurs (email/mot de passe). Pas d'auto-inscription publique — les comptes sont créés à la main dans la Console Firebase par un Super-Admin/RH. |
| Identité & rôle (`profiles/{uid}`) | **Firestore** | Source de vérité unique du rôle applicatif (`SUPER_ADMIN`, `RESPONSABLE_RH`, `CHEF_DE_PROJET`, ...). Django lit ce rôle à chaque requête via le SDK Admin (`backend/core/firestore_client.py`) — il n'y a plus de table de rôles côté Django. |
| Chat, notifications, documents internes | **Firestore** | Données temps réel / peu structurées, sécurisées par `firestore.rules` (à la racine du repo). |
| RH, Finance, Projets | **Django REST + PostgreSQL (Supabase)** | Données relationnelles avec logique métier stricte (partie double comptable, workflow de décaissement N1/N2/N3, calcul automatique du coût horaire...). Voir `docs/backend-specifications.md` pour le détail complet, département par département. |
| Cache & broker Celery | **Upstash (Redis)** | Pas le Redis de Render (aucune persistance disque sur le plan gratuit). |
| Hébergement API | **Render** (Web Service Docker uniquement — pas de DB/Redis Render) | https://sokens-backend.onrender.com |
| Hébergement frontend | **Vercel** ⚠️ *déploiement en cours de stabilisation* | Déployé depuis `frontend/` (Root Directory à régler explicitement dans les settings Vercel, le repo contient aussi `backend/`). Build local (`npm run build`) 100% fonctionnel et vérifié ; le domaine de production Vercel renvoie encore 404 au moment d'écrire ces lignes malgré un build réussi côté Vercel — probablement un souci d'assignation de domaine à investiguer (voir onglet **Domains** du projet Vercel). En attendant, tourner en local (`npm run dev`) fonctionne sans problème. |
| Fichiers (contrats, fiches de paie...) | **Google Drive** | Pas encore intégré programmatiquement — liens collés à la main pour l'instant (`file_url` sur `Contract`/`Payslip`). |

**Règle d'or** : si une donnée a besoin d'intégrité transactionnelle, de jointures, ou de rapports agrégés → Django/Supabase. Si elle est temps réel ou peu structurée → Firestore. Ne pas dupliquer un même domaine des deux côtés (cf. l'incident évité : `Project`/`Department` avaient failli exister dans Firestore ET Django en parallèle).

## Structure du repo

```
backend/           Django REST (apps: core, hr, projects — finance/marketing à venir)
frontend/           Next.js 16 (App Router)
firestore.rules      Règles de sécurité Firestore (à publier manuellement dans la Console, ou via `firebase deploy --only firestore:rules`)
docs/backend-specifications.md   Cahier des charges détaillé + état d'avancement par département
render.yaml          Blueprint Render (Web Service Docker uniquement)
```

## Démarrage local

### Backend (Django)

```bash
cd backend
python -m venv .venv && source .venv/Scripts/activate  # ou .venv/bin/activate sous Linux/Mac
pip install -r requirements.txt
python manage.py migrate
python manage.py test          # 20 tests doivent passer
python manage.py runserver 8000
```

Sans `.env`, le backend retombe sur SQLite local (`db.sqlite3`) — suffisant pour développer une fonctionnalité isolément. **Sans `FIREBASE_SERVICE_ACCOUNT_JSON` ou `GOOGLE_APPLICATION_CREDENTIALS` configuré**, toute route protégée par `FirebaseAuthentication` échoue (le token ne peut pas être vérifié) — récupérer le fichier de clé de service Firebase (Console → Paramètres du projet → Comptes de service) auprès de l'équipe, ne jamais le committer.

### Frontend (Next.js)

```bash
cd frontend
npm install
cp .env.local.example .env.local   # remplir avec les valeurs Firebase (Console → Paramètres du projet → Général → Vos applications)
npm run dev
```

`NEXT_PUBLIC_API_BASE_URL` dans `.env.local` détermine quel backend Django le frontend appelle — `http://localhost:8000` en local, ou directement `https://sokens-backend.onrender.com` si vous ne voulez pas lancer Django localement (pratique, mais nécessite que vos identifiants Firebase soient déjà provisionnés côté Firestore pour que les permissions fonctionnent).

### Docker Compose (alternative, backend + Postgres + Redis locaux)

```bash
docker compose up
```

## Comptes & permissions

Il n'y a pas d'auto-inscription. Pour créer un nouveau compte :
1. Firebase Console → Authentication → Add user (email + mot de passe)
2. Firestore → collection `profiles` → document dont l'ID = l'UID Firebase généré → champs `email`, `firstName`, `lastName`, `role`, `departmentId`, `createdAt`, `updatedAt`

Le rôle (`role`) détermine ce que la personne peut faire, aussi bien côté Firestore (règles) que côté Django (`core.permissions.has_role()`, qui lit ce même champ). Valeurs possibles : `SUPER_ADMIN`, `RESPONSABLE_MARKETING`, `RESPONSABLE_RH`, `COMMERCIAL`, `CHEF_DE_PROJET`, `DEVELOPPEUR`, `COMPTABLE`, `DIRECTEUR_FINANCIER`, `AUTRE`.

Actuellement le frontend (`/admin`) affiche tous les modules à n'importe quel compte connecté — la restriction par rôle se fait uniquement côté API pour l'instant (un compte non-RH qui appelle `/api/v1/hr/employees/` ne voit que sa propre fiche, par exemple). Le filtrage de la sidebar par rôle reste à faire une fois plusieurs rôles réels en usage.

## État d'avancement (voir aussi `docs/backend-specifications.md`)

| Module | Backend | Frontend |
|---|---|---|
| Authentification | ✅ Firebase Auth | ✅ `/connexion` |
| Profil personnel | ✅ Firestore | ✅ `/profil` |
| RH — Employés/Contrats/Fiches de paie | ✅ Django (`hr` app) | ✅ `/admin/rh` |
| RH — Départements | ✅ Django (`core.Department`) | ✅ `/admin/rh/departements` |
| Projets (CRUD, membres) | ✅ Django (`projects` app) | ✅ `/admin/technique/projets` |
| Timesheets (saisie, validation) | ✅ | ✅ `/admin/technique/timesheets` |
| Décaissements — initiation N1 | ✅ (N2/exécution ⏳ — voir §6.3) | ✅ `/admin/technique/decaissements` |
| Finance/Comptabilité (plan comptable, factures, TVA, rapprochement) | ⏳ | ⏳ |
| Marketing/Commercial — Leads (Tunnel commercial) | ✅ | ✅ `/admin/marketing/leads` |
| Marketing/Commercial — Blog (Gestion de contenu) | ✅ | ✅ `/admin/marketing/blog` |
| Marketing/Commercial — Réseaux sociaux (Plan Éditorial) | ✅ (sans moteur de publication réel — voir §7.4) | ✅ `/admin/marketing/plan-editorial` |
| Marketing/Commercial — Dashboard | ✅ (pipeline pondéré, version simplifiée) | ✅ `/admin/marketing/dashboard` |
| Marketing/Commercial — Devis (Pipeline & Devis) | ✅ (PDF/email ⏳ — voir §7.2) | ✅ `/admin/marketing/devis` |
| Marketing/Commercial — Portfolio/Témoignages/Hero (CMS) | ⏳ | ⏳ |
| Dashboard Global | ⏳ bloqué sur Tâches — voir `docs/backend-specifications.md §8` | ⏳ |
| Messagerie (salons Entreprise/Département/Projet, temps réel) | ✅ Firestore (Django pousse salons + membres via l'Admin SDK) | ✅ `/admin/messagerie` |
| Notifications | ⏳ (Firestore prévu) | ⏳ |

## Documentation API

Swagger interactif : https://sokens-backend.onrender.com/api/docs/ (organisé par département : Système / Authentification / Administration & RH / Technique & Projets). En local : `http://localhost:8000/api/docs/`.

## Contribution

Voir `CONTRIBUTING.md` pour les conventions de commit et le workflow de branches prévu (`main`/`develop`/`feature/*`). **Note** : le développement de ce socle technique s'est fait directement sur `main` jusqu'ici (pas de `develop` séparée pour l'instant) — à harmoniser en équipe si on veut vraiment appliquer le GitFlow décrit dans `CONTRIBUTING.md` à partir de maintenant.
