# Checklist de déploiement — backend Django

Cette checklist prépare le code pour un déploiement (Render, per
`docs/backend-specifications.md`) — elle ne l'exécute pas : aucun accès
Render/Firebase/Vercel n'était disponible dans la session qui l'a rédigée.

## 1. Variables d'environnement à définir (voir `.env.example`)

**Obligatoires en production** (le backend refuse de démarrer sans, ou
tourne en mode dégradé sans) :
- `SECRET_KEY` — doit être une vraie valeur aléatoire longue, jamais la
  valeur de dev codée en dur. **Le backend lève une `RuntimeError` au
  démarrage si absente et `DEBUG=False`** — c'est volontaire (fail loud).
- `DEBUG=False`
- `ALLOWED_HOSTS` — domaines réels (Render ajoute automatiquement son
  propre hostname via `RENDER_EXTERNAL_HOSTNAME`, pas besoin de le lister)
- `DATABASE_URL` — PostgreSQL (voir commentaire `.env.example` sur le
  choix Render vs Supabase selon la politique de rétention gratuite)
- `REDIS_URL` — cache + broker Celery + rate limiting
- `CORS_ALLOWED_ORIGINS` — URL(s) du frontend Next.js en prod. **Sans ça,
  `CORS_ALLOW_ALL_ORIGINS` est lié à `DEBUG` — en prod (`DEBUG=False`)
  aucune origine n'est autorisée par défaut (fail closed), pas toutes.**
- `FIREBASE_SERVICE_ACCOUNT_JSON` (ou `GOOGLE_APPLICATION_CREDENTIALS`) —
  sans ça, `FirebaseAuthentication` échoue pour toute requête authentifiée.

**Recommandées, sinon comportement dégradé mais pas de crash** :
- `SIGNATURE_WEBHOOK_SECRET` — sans elle, le webhook de signature
  électronique refuse tout callback (503). C'est le comportement voulu
  (fail closed plutôt qu'accepter en clair) mais bloque l'intégration
  jusqu'à configuration côté prestataire.
- `EMAIL_HOST` + `EMAIL_HOST_USER`/`EMAIL_HOST_PASSWORD` — sans elles, les
  emails (résolution ticket, alerte expiration doc RH) partent vers la
  console des logs, jamais réellement envoyés.
- `DEFAULT_FROM_EMAIL` — a un défaut (`no-reply@sokensdigital.com`), à
  adapter au vrai domaine.
- `THROTTLE_RATE_*` — valeurs par défaut posées (100/h anon, 2000/h user,
  10/h écriture publique, 60/min webhook), à ajuster selon trafic réel
  observé une fois en prod.
- `FACEBOOK_PAGE_ID`/`FACEBOOK_PAGE_ACCESS_TOKEN` — Marketing, hors
  périmètre de ce pass, mais nécessaires si cette fonctionnalité doit
  tourner.

## 2. Avant le premier déploiement — migrations

```
python manage.py makemigrations --check --dry-run   # doit renvoyer "No changes detected"
python manage.py migrate
```

**Point d'attention chiffrement** (voir rapport §2.5) : si une base de
données de production existe déjà avec des données réelles dans
`ClientDocument.name` ou `EmployeeDocument.document_name` **avant**
d'appliquer la migration `administration/migrations/
0004_encrypt_document_names.py`, ces lignes deviendront illisibles après
migration (colonne passée en chiffré, contenu existant resté en clair).
Sur une base neuve (situation actuelle), aucune action requise.

## 3. Rôles RBAC — amorçage initial

Le RBAC est maintenant 100% côté Django (`Role` + `User.roles`), plus
Firestore. Il faut créer les rôles de base et au moins un compte
Super-Administrateur avant que quiconque puisse utiliser l'admin :

```python
# python manage.py shell
from core.models import Role
for name in ['Super-Administrateur', 'Administrateur', 'Chef de Projet',
             'Développeur', 'Directeur Financier', 'Commercial',
             'Responsable RH', 'Consultant', 'Support Client',
             'Comptable', 'Responsable Marketing']:
    Role.objects.get_or_create(name=name)
```
(Envisager une commande `manage.py` dédiée / une migration de données si
ce bootstrap doit être répétable en CI ou sur un futur environnement.)

## 4. Tests — statut vérifié (voir rapport §5)

```
pytest technique/ administration/ core/ messaging/ projects/ hr/ finance/ marketing/
```
Doit passer intégralement (vérifié : exit 0, y compris `finance/` et
`marketing/` — RBAC migré vers les noms de rôles français lors d'un pass
ultérieur : `ROLE_COMPTABLE`/`ROLE_RESPONSABLE_MARKETING` ajoutés à
`core/constants.py`, littéraux SNAKE_CASE remplacés dans `finance/views.py`,
`marketing/views.py` et `core/views.py`).

## 5. CI — Jenkinsfile

Mis à jour ce pass : ajout étape lint/tests `messaging/`, correction du
chemin `core/tests/` → `core/tests.py` (bug pré-existant qui faisait que
la CI ne testait jamais rien pour `core`), ajout de la branche
`taiger_technique` aux déclencheurs de test technique/administration/core
(elle en était absente, donc ces stages étaient silencieusement skip sur
cette branche).

## 6. Ce qui n'a PAS été fait dans ce pass (à traiter avant prod si concerné)

- Déploiement réel Render/Vercel/Firebase — nécessite credentials non
  disponibles dans cette session.
- Firestore Security Rules pour le module Messagerie — texte fourni dans
  le cahier des charges, pas déployé (accès console Firebase requis).
- Cloud Functions Firebase (mentions → FCM) — idem.
- Tests de charge / audit de pénétration externe (cahier des charges
  §5.5 les mentionne comme exigence annuelle — aucun outillage mis en
  place ici).
