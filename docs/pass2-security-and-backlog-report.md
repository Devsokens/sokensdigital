# Rapport — Pass 2 : Backlog + Durcissement Sécurité + Module Messagerie

Date : 2026-08-08 · Branche : `taiger_technique` · Périmètre : tous départements
sauf **Comptabilité/Finance** et **Commercial/Marketing** (explicitement exclus).

Ce rapport documente chaque décision prise avec « carte blanche » sécurité,
ses alternatives, et pourquoi le choix retenu l'a été. Suivi d'un état des
lieux complet vérifié par exécution réelle de la suite de tests (pas
seulement une relecture de code).

---

## 1. Découvertes critiques (non demandées, trouvées en testant)

Le pass 1 (merge Herbert_technique) n'avait jamais été testé avec un
environnement Python réel — aucun `pytest` n'avait tourné. Ce pass a trouvé
un venv fonctionnel dans `backend/venv/`, installé les dépendances
manquantes, et lancé la suite pour de vrai. Résultat : plusieurs bugs
**bloquants pour tout déploiement**, invisibles à la seule lecture de code.

### 1.1 Migration fantôme qui supprimait tout le RBAC (CRITIQUE)
`backend/core/migrations/0002_remove_user_roles_delete_role.py` était un
reliquat de l'ancienne branche HEAD (avant la fusion RBAC), non en conflit
donc jamais examiné lors du merge pass 1. Il supprimait le modèle `Role` et
le champ `User.roles` **juste après leur création** par la migration 0001.
Toute exécution réelle de `manage.py migrate` aurait laissé la base sans
aucune table de rôles — chaque vérification `user.roles.filter(...)` du
RBAC construit en pass 1 et pass 2 aurait planté au runtime.
**Fix : suppression du fichier.**

**Pourquoi c'est grave** : ce bug ne se voit pas en lisant le code Django
(les modèles et les vues sont corrects) — seul l'état réel des migrations
appliquées le révèle. Sans exécution de test, il serait passé en production
tel quel.

### 1.2 `has_role()` supprimé du merge, 5 apps cassées à l'import
Le merge pass 1 a remplacé `core/permissions.py` intégralement par la
version Herbert_technique, qui n'a pas de fonction `has_role()` — alors que
`core/views.py`, `finance/views.py`, `hr/views.py`, `marketing/views.py` et
`projects/views.py` l'importent tous. **Le backend entier ne démarrait
pas** (`ImportError` dès le chargement de `urls.py`).
**Fix : fonction `has_role()` restaurée comme alias de compatibilité.**

### 1.3 Vocabulaire de rôles à deux langues
Les fichiers ci-dessus utilisaient encore les anciens noms SNAKE_CASE de
l'ère Firestore (`'SUPER_ADMIN'`, `'CHEF_DE_PROJET'`, `'RESPONSABLE_RH'`...)
alors que le RBAC Django utilise des noms français (`'Super-Administrateur'`,
`'Chef de Projet'`...). Résultat : même avec `has_role()` restauré, **tous
les contrôles d'accès de ces apps échouaient silencieusement** (personne
n'a jamais le rôle recherché → 403 partout).
**Fix appliqué** dans `core/`, `hr/`, `projects/` (dans le périmètre) —
littéraux remplacés par les constantes de `core/constants.py`.
**Non touché** dans `finance/` et `marketing/` (hors périmètre explicite) —
ces deux apps restent non fonctionnelles jusqu'à ce que quelqu'un fasse le
même travail sur leurs fichiers. Voir §6.

### 1.4 Throttling DRF cassait 100 % des tests (introduit par ce pass)
En ajoutant le rate-limiting global (§3.2), le cache Redis est sollicité à
chaque requête API. Le garde `if 'test' in sys.argv` (pré-existant, pour
basculer sur un cache mémoire pendant les tests) ne détecte que
`manage.py test`, jamais `pytest` — le runner réel de ce repo. Sans Redis
lancé localement, **chaque appel API en test retournait 500**.
**Fix : détection élargie (`PYTEST_CURRENT_TEST`, `'pytest' in sys.modules`).**
Trouvé et corrigé dans la même session grâce au test réel — sans ça, ce
bug aurait été livré avec le throttling.

### 1.5 Dispatch Celery non défensif (introduit par ce pass, corrigé avant livraison)
Les signaux `messaging` déclenchaient `task.apply_async()` sur **chaque**
création de `Department`/`Project` — y compris dans les tests, où aucun
broker Celery ne tourne. `apply_async()` échoue de façon **synchrone** sans
broker joignable : ça aurait fait planter la création de projet/département
elle-même à chaque incident Redis en prod, pas seulement retardé une
notification. Repéré avant même de lancer les tests (en réfléchissant au
flux), corrigé par un helper centralisé `core/celery_utils.safe_dispatch()`
qui avale l'erreur et logue, appliqué aussi à `technique/signals.py` qui
avait le même risque latent (pré-existant, jamais déclenché par les tests
avant ce pass).

### 1.6 Bug « champ requis jamais fourni » sur les routes nested
Plusieurs serializers exposent un champ FK (`project`, `client`, `channel`,
`task`) marqué requis, alors que la vue le fixe elle-même via l'URL
(`perform_create(serializer.save(project_id=...))`) sans jamais l'inclure
dans le payload attendu du client. Un POST réel échoue en 400 avant même
d'atteindre la logique métier. Trouvé dans `administration`
(`ClientDocument`, `ClientInteraction`) et `messaging`
(`ChannelParticipant`) — corrigé en marquant le champ `read_only`.
**Trouvé mais volontairement non corrigé** dans `technique/serializers.py`
(`ProjectPhaseSerializer`, `TaskSerializer`, `TimeEntrySerializer`) : ces
serializers ont un `validate()` qui lit ce même champ pour une règle
métier (date fin phase ≤ date fin projet, plafond 24h/jour) — le rendre
`read_only` ferait disparaître silencieusement cette validation. La
correction correcte (injecter la valeur dans `request.data` **avant**
`is_valid()`, via un override de `create()`) a été faite dans `technique/
views.py` pour `ProjectPhaseViewSet`, `TaskViewSet`, `TimeEntryViewSet` et
`ProjectDocumentViewSet` — un `_with_injected_fields()` réutilisable.

---

## 2. Choix de sécurité (carte blanche) — avantages / inconvénients

### 2.1 En-têtes et cookies sécurisés (actifs uniquement si `DEBUG=False`)
`SECURE_SSL_REDIRECT`, `SECURE_HSTS_SECONDS=31536000` (1 an, sous-domaines
inclus), `SESSION_COOKIE_SECURE`, `CSRF_COOKIE_SECURE`,
`SECURE_CONTENT_TYPE_NOSNIFF`, `X_FRAME_OPTIONS='DENY'`,
`SECURE_REFERRER_POLICY='same-origin'`.

- **Avantage** : ferme la quasi-totalité des vecteurs XSS-clickjacking et
  force HTTPS y compris pour un utilisateur qui tape `http://` par erreur.
- **Inconvénient** : `SECURE_HSTS_PRELOAD` volontairement laissé à `False`
  — s'inscrire à la liste de préchargement HSTS des navigateurs est un
  engagement quasi irréversible (retrait très lent). À activer plus tard,
  une fois HTTPS confirmé stable en prod, pas dès le premier déploiement.
- Zéro impact en développement (`DEBUG=True` par défaut localement).

### 2.2 Rejet du `SECRET_KEY` par défaut en production
`settings.py` lève une `RuntimeError` au démarrage si `DEBUG=False` et que
`SECRET_KEY` est toujours la valeur de fallback codée en dur (visible dans
l'historique git).

- **Avantage** : impossible de déployer par erreur avec une clé publique —
  une clé volée permet de forger des cookies de session et des tokens de
  réinitialisation de mot de passe.
- **Inconvénient** : un déploiement mal configuré ne démarre pas du tout
  (fail loud) plutôt que de tourner en dégradé. C'est le compromis voulu —
  un 500 immédiat et explicite vaut mieux qu'une faille silencieuse.

### 2.3 Rate limiting (DRF throttling)
`AnonRateThrottle`/`UserRateThrottle` globaux (100/h anon, 2000/h user,
configurables par variable d'env) + `ScopedRateThrottle` renforcé sur le
webhook de signature (60/min).

- **Avantage** : ralentit le bruteforce et le scraping sans configuration
  d'infra supplémentaire (réutilise le cache Redis déjà en place).
- **Inconvénient** : repose sur le cache — dégradation silencieuse si Redis
  tombe (le throttling cesse de compter, pas de blocage des requêtes ;
  DRF fail-open sur erreur cache). Valeurs par défaut arbitraires, à
  ajuster avec du trafic réel observé.

### 2.4 Webhook signature électronique — vérification HMAC (CRITIQUE, déjà en dette avant ce pass)
`SignatureWebhookView` acceptait n'importe quel POST pour faire passer un
contrat à SIGNÉ (déjà signalé par le security review du début de session).
Ajout : vérification HMAC-SHA256 du corps brut contre `X-Signature`, avec
`SIGNATURE_WEBHOOK_SECRET`. Sans secret configuré → 503 (refuse plutôt que
d'accepter en clair).

- **Avantage** : ferme un contournement de logique métier critique (un
  attaquant pouvait signer/annuler n'importe quel contrat sans
  authentification).
- **Inconvénient** : nécessite une coordination avec le prestataire de
  signature électronique pour partager le secret — tant que ce n'est pas
  fait, le webhook réel (production) refusera tout, ce qui est le
  comportement voulu (fail closed) mais bloque l'intégration jusqu'à
  configuration.

### 2.5 Chiffrement AES au repos étendu
`User.phone` n'était en fait jamais chiffré malgré l'intention déclarée en
pass 1 (`email` l'était, `phone` avait juste un commentaire TODO oublié) —
corrigé. Ajout du même chiffrement sur `ClientDocument.name` et
`EmployeeDocument.document_name` (un nom de fichier type
"Licenciement_Untel.pdf" est en lui-même une donnée sensible,
indépendamment du flag `is_sensitive`).

- **Avantage** : conforme à l'exigence du cahier des charges
  (« Chiffrement AES-256 des données sensibles au repos »).
- **Inconvénient réel, à lire avant migration en prod** : si des données
  existent déjà en base au moment du déploiement, la migration change
  seulement le type de colonne côté Django — les lignes déjà en clair
  deviennent **illisibles** (Django tentera de les déchiffrer et
  échouera). Une base neuve (pas encore de données réelles, situation
  actuelle) n'a pas ce problème. Documenté explicitement dans le
  docstring de la migration `administration/migrations/
  0004_encrypt_document_names.py`.
- **Effet de bord accepté** : un champ chiffré n'est plus filtrable/
  recherchable côté base (ciphertext non déterministe) — aucun des deux
  champs n'était utilisé dans un `search_fields`/filtre, vérifié avant
  d'appliquer.

### 2.6 IDOR / scoping objet — cohérence 404 vs 403
Plusieurs corrections de ce pass (technique + messaging) font qu'un
utilisateur sans accès à un objet reçoit **404** plutôt que 403, parce que
le `get_queryset()` de la vue le filtre avant même que l'action soit
atteinte.

- **Avantage** : ne révèle pas l'existence de l'objet à quelqu'un qui n'a
  pas le droit de le voir — 404 est en fait *meilleur* que 403 du point de
  vue fuite d'information (403 confirme "ça existe, tu n'as juste pas le
  droit" ; 404 ne confirme rien).
- **Inconvénient** : expérience utilisateur légèrement moins explicite
  côté frontend (un 404 sur une action ressemble à un objet supprimé, pas
  à un refus d'accès) — à garder en tête si le frontend affiche des
  messages différenciés par code HTTP.

---

## 3. Backlog fermé ce pass (résumé, détail dans les commits)

**Technique** : doublon AuditLog sur `change_status` corrigé (acteur réel
tracé via `_audit_user`, plus de double écriture) · alerte budget
(`check_budget_alerts`) crée réellement une `Notification` dédupliquée ·
email résolution ticket effectivement envoyé (`django.core.mail`, backend
console par défaut tant qu'`EMAIL_HOST` n'est pas configuré) · défense en
profondeur modèle pour la règle phase-TERMINE-sans-LIVRABLE et le plafond
24h/jour TimeEntry (en plus de la validation serializer déjà là) ·
scoping Task élargi pour couvrir un dev assigné à une tâche même hors
`Project.members` formel.

**Administration** : modèle `Contact` ajouté (manquant du cahier des
charges §4.5), lié à `ClientInteraction.contact` avec validation
cross-client · écriture `ClientDocument` restreinte (Admin/DirFinancier,
Commercial limité à DEVIS) · scoping `ClientInteraction`/`Contact` sur
l'accès réel au client · relances Celery interactions + alerte expiration
document RH (notification + email) réellement implémentées · notification
globale `AdministrativeRecord` à la publication · passerelle de validation
paie minimale (`PayrollValidationView` : bulk-import `hr.Payslip` →
`EmployeeDocument`, chiffré).

**Non traité, signalé explicitement** : passerelle notes de frais
(`NoteDeFrais` → validation Administration) — aucun modèle `NoteDeFrais`
n'existe nulle part dans le code, le module financier dédié qui devrait le
porter (département Finance) est hors périmètre de ce pass.

---

## 4. Module Messagerie — construit de zéro (backend uniquement)

Nouvelle app Django `messaging/` : modèles `ChannelMetadata`/
`ChannelParticipant` (gouvernance PostgreSQL), signaux de synchronisation
automatique (création Département/Projet → salon Firestore + tables de
sync via Celery, défensif), endpoints DRF (canaux + participants, scoping
par appartenance), tests complets.

**Non fait, décision actée avec vous** : Cloud Functions Firebase (mentions
→ FCM) et Firestore Security Rules — nécessitent un accès console Firebase
absent de cette session ; le texte des règles est documenté dans le cahier
des charges fourni et prêt à être déployé manuellement.

**Point d'architecture non résolu, à trancher avec l'équipe** (documenté en
tête de `messaging/models.py`, pas décidé unilatéralement) :
1. Un système de salons Firestore ad-hoc existe déjà (`core/views.py` pour
   les départements, `projects/views.py` pour les projets), sans table de
   sync PostgreSQL — il coexiste avec ce nouveau module sans le remplacer.
2. Le champ `project` de `ChannelMetadata` pointe vers `technique.Project`
   — **il existe un second modèle `Project` complètement séparé dans l'app
   `projects`** (pré-existante, main). Les deux départements ont chacun
   leur notion de "projet", non reliées. Ce doublon existait déjà avant ce
   pass (découvert en creusant `projects/views.py` pour comprendre le
   système de salons Firestore existant) — il n'a pas été résolu ici, c'est
   une décision produit/archi qui vous revient.

---

## 5. Vérification — suite de tests réelle, pas juste relue

Environnement : venv `backend/venv/` (trouvé sur disque), dépendances
manquantes installées (`pytest`, `pytest-django`, `factory-boy`,
`django-cryptography-django5`, `django-redis`, `Pillow`, etc.),
`manage.py check` et `manage.py makemigrations --check --dry-run` passent
à zéro (migrations 100 % synchronisées avec l'état des modèles).

```
pytest technique/ administration/ core/ messaging/ projects/ hr/
→ exit code 0, aucun échec
```

`finance/` et `marketing/` échouent intégralement (mêmes causes que §1.3 —
vocabulaire de rôles obsolète, hors périmètre de ce pass, non corrigé).

---

## 6. Hors périmètre — état exact pour la suite

- **Finance** (`finance/views.py`) et **Marketing** (`marketing/views.py`,
  `core/views.py` pour la partie recherche/liste utilisateurs spécifique
  marketing) : rôles SNAKE_CASE non migrés vers les noms français —
  RBAC non fonctionnel (fail-closed, 403 partout) jusqu'à correction. Même
  mécanique de fix que §1.3, appliquable rapidement (remplacement de
  littéraux) une fois ces départements repris.
- **Rôle `Comptable`** : absent de `core/constants.py`, utilisé en dur
  dans `core/views.py`/`finance/views.py` — aucune constante à réutiliser
  pour ce département tant qu'il n'est pas construit.
- **`NoteDeFrais`** : modèle inexistant, touchpoint Administration
  bloqué en amont.

---

## 7. Déploiement — voir `docs/deployment-checklist.md`
