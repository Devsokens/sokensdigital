# Audit Sécurité Extrême — Backend Django + Frontend Next.js

**Date:** 2026-08-17 | **Méthode:** lecture directe du code (settings, auth, permissions, uploads, templates, frontend) — pas d'hypothèses, chaque finding est sourcé à un fichier:ligne.

**Ce qui est déjà solide** (vérifié, pas re-signalé en faille) : HSTS + cookies secure + HTTPONLY conditionnés à `DEBUG=False`, `SECRET_KEY` refuse de booter sur le fallback en prod, `CORS_ALLOW_ALL_ORIGINS` lié à `DEBUG`, throttling DRF en place (anon/user/webhook scopés), `hmac.compare_digest` pour la vérif webhook signature (constant-time, correct), Argon2 en premier hasher, aucune injection SQL/eval/exec/pickle/subprocess trouvée nulle part dans le code applicatif, `.env` jamais tracké en git, aucun secret en dur trouvé, Firestore rules interdisent l'auto-provisioning de profil.

---

## 🔴 CRITIQUE

### C1. Auto-provisioning silencieux de tout compte Firebase vérifié

**Fichier:** `backend/core/authentication.py:43-59`

```python
try:
    user = User.objects.get(firebase_uid=uid)
except User.DoesNotExist:
    existing = User.objects.filter(firebase_uid__isnull=True, email_hash=hash_email(email)).first()
    if existing:
        existing.firebase_uid = uid
        existing.save(update_fields=['firebase_uid'])
        user = existing
    else:
        user = User.objects.create(email=email, firebase_uid=uid, is_active=True)
```

**Le problème:** si aucun compte Django pré-provisionné ne correspond à l'email, **un `User` actif est créé à la volée** pour n'importe quel token Firebase valide. `firestore.rules` interdit bien l'auto-création de *profil Firestore*, mais rien côté Firebase Auth lui-même n'empêche une inscription self-service (`createUserWithEmailAndPassword`) si le provider Email/Password est activé sur le projet Firebase (réglage par défaut de la console Firebase, indépendant des Firestore rules). Un attaquant qui s'inscrit ainsi obtient un ID token valide → `verify_id_token()` réussit → Django lui crée un `User.is_active=True` sans rôle.

**Impact réel:** ce nouvel utilisateur passe `IsAuthenticated` (permission par défaut DRF) sur **tout endpoint qui ne surcharge pas explicitement `permission_classes`** — dont la messagerie interne (créer un canal `DIRECT`/`GROUP`, lister les collègues via `UserBriefSerializer`), voir `messaging/views.py:21` ("créables par tout utilisateur authentifié"). Aucun rôle métier n'est nécessaire pour ce sous-ensemble d'API. C'est une porte d'entrée dans le système pour quiconque possède juste une adresse email.

**Solution robuste** (ne casse rien : le flux légitime — compte pré-provisionné par email_hash — reste identique) :

```python
try:
    user = User.objects.get(firebase_uid=uid)
except User.DoesNotExist:
    existing = User.objects.filter(firebase_uid__isnull=True, email_hash=hash_email(email)).first()
    if existing:
        existing.firebase_uid = uid
        existing.save(update_fields=['firebase_uid'])
        user = existing
    else:
        # Refuser l'auto-provisioning : un compte doit être créé par un
        # Super-Admin/RH (ProvisionUserView) avant qu'un token Firebase ne
        # soit accepté. Sans ce garde, n'importe qui avec une adresse email
        # et un provider Firebase Auth ouvert (Email/Password self-signup)
        # obtient un User Django actif et passe IsAuthenticated partout.
        raise exceptions.AuthenticationFailed(
            'Aucun compte Soken\'s Digital associé à cette adresse. '
            'Contactez un administrateur pour être provisionné.'
        )
except Exception:
    raise exceptions.AuthenticationFailed('Could not retrieve user.')
```

**Action complémentaire (hors code, à faire côté Firebase Console) :** désactiver le provider "Email/Password" self-service dans Firebase Authentication si les comptes sont censés être créés uniquement via `ProvisionUserView`/Console admin — sinon le garde ci-dessus rejette bien l'accès API mais l'attaquant reste capable de créer des comptes Firebase Auth à volonté (bruit, mais plus d'accès data).

---

### C2. XSS stockée — contenu HTML du blog public sans sanitization serveur

**Fichiers:** `backend/marketing/models.py:83` (`BlogPost.content = TextField`, aucune validation), `frontend/components/blog/article-content.tsx:5` (`dangerouslySetInnerHTML={{ __html: html }}`)

**Le problème:** `BlogPost.content` stocke le HTML brut produit par l'éditeur Tiptap admin, sans **aucune sanitization côté serveur** (`grep bleach|nh3|sanitize` → zéro résultat dans tout le repo). Le champ est ensuite injecté tel quel dans le DOM public via `dangerouslySetInnerHTML`. Écriture gated à `IsMarketing` (Responsable Marketing/Super-Admin) — donc pas exploitable par un inconnu — mais :
- un compte marketing compromis (phishing, session volée) devient un vecteur d'XSS stockée touchant **chaque visiteur du site public** (clients, prospects) ;
- rien n'empêche un appel API direct (Postman/curl, hors UI Tiptap) de poster `<script>...</script>` ou `<img src=x onerror=...>` — la restriction Tiptap est côté client, pas une frontière de sécurité ;
- confiance aveugle dans "l'éditeur produit du HTML propre" — un bug Tiptap ou une extension mal configurée suffit.

**Impact:** defacement du site public, injection de scripts de phishing/redirection sur une page vue par des prospects, cryptojacking, SEO poisoning. Site public = confiance zéro dans la source de trafic.

**Solution robuste — sanitization serveur avec allowlist stricte, ne change ni le format stocké ni l'UI Tiptap :**

```python
# backend/marketing/models.py — ou mieux, dans le serializer (validate_content)
import nh3

ALLOWED_TAGS = {
    'p', 'br', 'strong', 'em', 'u', 's', 'a', 'ul', 'ol', 'li',
    'h1', 'h2', 'h3', 'h4', 'blockquote', 'code', 'pre', 'img',
}
ALLOWED_ATTRIBUTES = {
    'a': {'href', 'title', 'target', 'rel'},
    'img': {'src', 'alt', 'title', 'width', 'height'},
}

def sanitize_blog_html(raw_html: str) -> str:
    return nh3.clean(
        raw_html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes={'http', 'https', 'mailto'},  # bloque javascript:, data: sur href/src
    )
```

```python
# marketing/serializers.py — BlogPostSerializer
def validate_content(self, value):
    return sanitize_blog_html(value)
```

`nh3` (binding Rust de `ammonia`, maintenu, rapide, pas de dépendance Python legacy comme `bleach`) — `pip install nh3`, une ligne dans `requirements.txt`. Aucune migration nécessaire (TextField inchangé), aucun changement d'UI : le HTML légitime produit par Tiptap (gras, listes, liens, images) passe intact ; seuls `<script>`, `on*=`, `javascript:` disparaissent silencieusement. Appliquer la même fonction à tout autre champ HTML admin-saisi rendu publiquement (vérifier `PageSection.items` si des champs y contiennent du HTML libre — actuellement non, ce sont des chaînes courtes).

---

## 🟠 HAUTE

### H1. Fuite de message d'exception Firebase au client

**Fichier:** `backend/core/authentication.py:35-36`

```python
except Exception as e:
    raise exceptions.AuthenticationFailed(f'Invalid Firebase ID token: {str(e)}')
```

Le message d'exception brut du SDK Firebase Admin (peut inclure des détails internes : cause de l'échec de vérif de signature, expiration, structure du JWT) est renvoyé tel quel au client. Faible sévérité isolée, mais aide un attaquant à distinguer "token expiré" de "token malformé" de "UID inconnu" pour affiner des tentatives.

**Fix:**
```python
except Exception:
    logger.warning('Firebase token verification failed', exc_info=True)
    raise exceptions.AuthenticationFailed('Invalid or expired authentication token.')
```
(ajouter `import logging; logger = logging.getLogger(__name__)` en tête de fichier)

---

### H2. Crash non catché sur header Authorization malformé

**Fichier:** `backend/core/authentication.py:19-20`

```python
parts = auth_header.split()
if parts[0].lower() != 'bearer':
```

Si `auth_header` est une chaîne non-vide mais uniquement des espaces (`"   "`), elle passe le test `if not auth_header` (truthy) puis `.split()` retourne `[]` → `parts[0]` lève `IndexError` non catché → **500 Internal Server Error** au lieu d'un 401 propre. En prod (`DEBUG=False`), pas de fuite de stacktrace au client grâce au handler déjà en place, mais c'est un déni de service trivial par requête malformée et un signal bruyant dans les logs Render pour rien.

**Fix:**
```python
parts = auth_header.split()
if not parts or parts[0].lower() != 'bearer':
    return None
```

---

### H3. Upload de pièces jointes chat sans restriction de type

**Fichier:** `backend/core/storage.py:159-164` (`upload_file`)

```python
def upload_file(file, folder: str) -> str:
    """... No type restriction beyond the size cap — the caller is always
    an authenticated user, same trust level firestore/storage.rules
    granted any signed-in user before Storage required Blaze."""
    if file.size > MAX_FILE_UPLOAD_SIZE:
        raise ValidationError(...)
    return _upload_to_cloudinary(file.read(), folder)
```

N'importe quel utilisateur authentifié (y compris un compte issu de C1 si non corrigé) peut uploader **n'importe quel type de fichier** jusqu'à 20 Mo — exécutables, scripts, HTML avec payload, archives piégées — partagé ensuite en pièce jointe de chat vers des collègues qui font confiance au lien (domaine Cloudinary de l'entreprise). Vecteur de distribution de malware interne ou de phishing latéral (un compte compromis piège ses propres collègues).

**Fix — allowlist par extension/MIME, sans casser l'usage légitime chat (documents, images, PDF) :**

```python
ALLOWED_CHAT_ATTACHMENT_TYPES = {
    'image/png', 'image/jpeg', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv',
    'application/zip',
}

def upload_file(file, folder: str) -> str:
    if file.content_type not in ALLOWED_CHAT_ATTACHMENT_TYPES:
        raise ValidationError(f'Type de fichier non autorisé : {file.content_type}.')
    if file.size > MAX_FILE_UPLOAD_SIZE:
        raise ValidationError('Le fichier dépasse la taille maximale autorisée (20 Mo).')
    return _upload_to_cloudinary(file.read(), folder)
```

Ajuster la liste selon les besoins réels observés en usage (garder restrictif, étendre à la demande plutôt que l'inverse).

---

### H4. Aucun header Content-Security-Policy

**Fichiers:** `backend/sokens_backend/settings.py` (absent), Next.js config (absent)

Aucun CSP nulle part — `X-Content-Type-Options: nosniff` et `X-Frame-Options: DENY` sont en place (bon), mais pas de CSP en défense-en-profondeur contre l'XSS (particulièrement pertinent vu C2). Sans CSP, un payload XSS qui passe malgré la sanitization (bug futur, faille zero-day dans `nh3`, autre vecteur non encore identifié) s'exécute sans aucune barrière supplémentaire.

**Fix backend (API — moins critique mais gratuit) :**
```python
# settings.py, dans le bloc `if not DEBUG:`
SECURE_CROSS_ORIGIN_OPENER_POLICY = 'same-origin'
```

**Fix frontend (Next.js — c'est ici que ça compte, site public + admin) :**
```ts
// next.config.ts
async headers() {
  return [{
    source: '/:path*',
    headers: [{
      key: 'Content-Security-Policy',
      value: [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline'", // Next.js hydration nécessite unsafe-inline sauf nonce configuré
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' https: data:", // Cloudinary/Supabase Storage
        "connect-src 'self' https://*.googleapis.com https://firestore.googleapis.com " + (process.env.NEXT_PUBLIC_API_BASE_URL ?? ''),
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; '),
    }],
  }];
}
```
Démarrer en mode `Content-Security-Policy-Report-Only` une semaine pour calibrer sans rien casser (Firebase/Cloudinary/Supabase ont des domaines précis à whitelister), puis basculer en enforcing.

---

### H5. `DocumentAttachment` — modèle sans validation, MEDIA_ROOT/MEDIA_URL absents

**Fichiers:** `backend/core/models.py:248-278`, `backend/sokens_backend/settings.py` (aucun `MEDIA_ROOT`/`MEDIA_URL`)

Le modèle existe (`FileField(upload_to='documents/%Y/%m/%d/')`, destiné aux pièces justificatives Finance : chèques, bordereaux, attestations) mais :
- **aucun endpoint ne l'expose encore** (vérifié : pas de ViewSet, pas d'action `create` — actuellement mort, donc pas exploitable *aujourd'hui*) ;
- `MEDIA_ROOT`/`MEDIA_URL` ne sont **pas configurés** — storage par défaut = `FileSystemStorage` sur disque local, sans route pour servir les fichiers, et sur Render le disque est **éphémère** (perdu à chaque redeploy) — pour des pièces justificatives comptables (obligation de conservation), c'est une perte de données garantie le jour où quelqu'un branche l'upload ;
- aucune validation de type/taille au niveau modèle ou serializer.

**Ce n'est pas exploitable aujourd'hui**, mais c'est une mine posée pour la prochaine session qui câble l'upload sans y repenser. Fix préventif :

```python
# core/models.py — DocumentAttachment
from django.core.validators import FileExtensionValidator

ALLOWED_DOCUMENT_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png']
MAX_DOCUMENT_SIZE = 10 * 1024 * 1024  # 10 Mo

def validate_document_size(file):
    if file.size > MAX_DOCUMENT_SIZE:
        raise ValidationError('Le fichier dépasse 10 Mo.')

class DocumentAttachment(LoggedModel):
    ...
    file = models.FileField(
        upload_to='documents/%Y/%m/%d/',
        validators=[
            FileExtensionValidator(allowed_extensions=ALLOWED_DOCUMENT_EXTENSIONS),
            validate_document_size,
        ],
    )
```
Et router le storage vers Cloudinary/Supabase (déjà utilisés ailleurs dans `core/storage.py`) plutôt que `FileSystemStorage` avant de câbler le premier endpoint d'upload — pas de fix "settings.py" universel ici, à faire au moment de l'implémentation de l'upload réel plutôt que deviner un `MEDIA_ROOT` qui ne servira jamais.

---

### H6. Django admin exposé à `/admin/`, pas de rate-limit sur le login

**Fichiers:** `backend/sokens_backend/urls.py:19`, `backend/core/management/commands/bootstrap_admin.py`

`bootstrap_admin` crée des comptes `is_staff=True, is_superuser=True` avec `set_password()` — donc des mots de passe Django utilisables existent pour se logger sur `/admin/`. Ce formulaire de login (`django.contrib.admin`) n'est **pas couvert par les throttle classes DRF** (celles-ci ne s'appliquent qu'aux vues DRF) — aucun verrouillage de compte, aucun rate-limit sur les tentatives, chemin `/admin/` prévisible.

**Fix — rate-limit dédié sans toucher à l'admin lui-même, via middleware ou django-axes :**
```bash
pip install django-axes
```
```python
# settings.py
INSTALLED_APPS += ['axes']
MIDDLEWARE.insert(MIDDLEWARE.index('django.contrib.auth.middleware.AuthenticationMiddleware') + 1,
                   'axes.middleware.AxesMiddleware')
AUTHENTICATION_BACKENDS = ['axes.backends.AxesStandaloneBackend', 'django.contrib.auth.backends.ModelBackend']
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = 1  # heure
AXES_LOCKOUT_PARAMETERS = ['username']
```
Verrouille après 5 tentatives échouées par compte, 1h de cooldown — zéro impact sur l'usage légitime, ni sur l'API (DRF/Firebase auth non affectés, seul `/admin/` passe par `AuthenticationBackend`).

**Alternative plus radicale, si `/admin/` n'est utilisé que par les devs (pas par le personnel au quotidien) :** déplacer le path vers une valeur non devinable via env var :
```python
# urls.py
path(os.environ.get('DJANGO_ADMIN_PATH', 'admin/'), admin.site.urls),
```
Sécurité par l'obscurité seule = insuffisant, mais réduit le bruit de scan automatisé en complément de H6 ci-dessus (jamais en remplacement).

---

## 🟡 MOYENNE

### M1. Permissions objet qui "fail open" sur les actions non-détail

**Fichier:** `backend/core/permissions.py:137-200` (`IsOwner`, `IsProjectMember`, `IsAssignedDeveloper`)

Ces trois classes ne surchargent que `has_object_permission()`, jamais `has_permission()`. Piège classique DRF : `has_permission()` par défaut retourne `True` (non surchargé), et `has_object_permission()` n'est vérifié par DRF **que** quand la vue appelle explicitement `self.check_object_permissions()` — ce qui arrive automatiquement sur `retrieve/update/destroy` (actions "détail", via `get_object()`), **mais pas sur `list`/`create`** sauf logique manuelle dans la vue.

**Conséquence concrète:** si une vue utilise `permission_classes = [IsAssignedDeveloper]` seule (sans combiner avec `IsAuthenticated` + scoping de queryset), un `list` ou `create` sur cette vue passe pour **n'importe quel utilisateur authentifié**, pas seulement le développeur assigné — la vérification "assigné" ne s'applique qu'une fois qu'un objet précis est ciblé.

**Vérification requise (pas trouvé de cas concret exploité dans ce pass — à confirmer par grep) :**
```bash
grep -rn "permission_classes = \[IsAssignedDeveloper\]\|permission_classes = \[IsOwner\]\|permission_classes = \[IsProjectMember\]" backend --include="*.py"
```
Si un de ces trois est utilisé **seul** (sans `IsAuthenticated` composé et sans `get_queryset()` scopé côté vue), corriger soit en composant `[IsAuthenticated, IsAssignedDeveloper]` **et** en scopant `get_queryset()` (le vrai fix — la permission objet seule ne protège jamais `list`), soit en ajoutant :
```python
class IsAssignedDeveloper(permissions.BasePermission):
    def has_permission(self, request, view):
        # Sur list/create sans objet précis, retomber sur IsAuthenticated —
        # le filtrage réel doit venir de get_queryset() de la vue.
        return request.user and request.user.is_authenticated

    def has_object_permission(self, request, view, obj):
        ...  # inchangé
```

### M2. Secrets long-lived en variables d'environnement plates

`GMAIL_REFRESH_TOKEN`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `SIGNATURE_WEBHOOK_SECRET`, `CLOUDINARY_API_SECRET`, `SUPABASE_SERVICE_ROLE_KEY` — tous stockés en env vars Render standard (pratique correcte, pas d'anti-pattern), mais aucune rotation planifiée mentionnée, et n'importe qui avec accès au dashboard Render voit ces valeurs en clair. Pas un bug de code — **contrôle d'accès organisationnel** : limiter qui a accès au dashboard Render/env vars de prod, envisager un secret manager (Render a un "Secret Files" natif, ou migrer vers Doppler/Vault si l'équipe grossit). Documenté ici pour traçabilité, pas de fix code.

### M3. Pas de CAPTCHA/anti-bot sur les formulaires publics (contact, devis)

`marketing/ratelimit.py` throttle déjà les écritures publiques (`public_write` scope) — bonne défense contre le spam automatisé volumétrique, mais un attaquant patient/distribué (IP rotation) reste sous le radar. Pas critique (le throttle existant couvre le cas commun), mais si le volume de spam devient un problème opérationnel : ajouter Cloudflare Turnstile (gratuit, pas de cookie tiers, RGPD-friendly) sur `ContactFormView`/`QuoteCreateView` publics.

---

## 🟢 BASSE / DURCISSEMENT

### B1. `CORS_ALLOW_CREDENTIALS = True` + liste d'origines env-driven

Correct tel que configuré (`CORS_ALLOWED_ORIGINS` = liste exacte, jamais wildcard), mais fragile si un futur déploiement ajoute par erreur `*` ou un domaine trop large à la variable d'env. Ajouter un test de non-régression :
```python
# core/tests.py
def test_cors_never_wildcards_with_credentials(self):
    from django.conf import settings
    if not settings.DEBUG:
        self.assertNotIn('*', settings.CORS_ALLOWED_ORIGINS)
```

### B2. `SECURE_HSTS_PRELOAD = False`

Choix documenté et raisonnable (engagement difficile à annuler) — à revisiter une fois le domaine de prod stable depuis plusieurs mois, soumission à hstspreload.org à considérer alors. Pas une faille, note de suivi.

### B3. Logging — vérifier qu'aucune donnée sensible ne fuite dans les logs

`LOGGING` capture toute exception `django.request` non gérée vers stdout (capturé par Render). Bon réflexe pour le debug, mais si une future vue lève une exception contenant un mot de passe/token en clair dans son message (ex: un `raise ValueError(f"bad token: {token}")` mal pensé), ça finit dans les logs Render en clair. Pas de cas trouvé actuellement — discipline à maintenir : jamais de secret/PII dans un message d'exception.

---

## Récapitulatif priorisé

| # | Sévérité | Fichier | Effort fix | Casse logique métier ? |
|---|----------|---------|-----------|------------------------|
| C1 | 🔴 Critique | core/authentication.py | 10 min | Non — flux légitime inchangé |
| C2 | 🔴 Critique | marketing/models.py + serializers.py | 30 min (+ `pip install nh3`) | Non — HTML légitime préservé |
| H1 | 🟠 Haute | core/authentication.py | 5 min | Non |
| H2 | 🟠 Haute | core/authentication.py | 2 min | Non |
| H3 | 🟠 Haute | core/storage.py | 10 min | À valider avec métier (liste de types) |
| H4 | 🟠 Haute | settings.py + next.config.ts | 1h (calibrage CSP) | Non si Report-Only d'abord |
| H5 | 🟠 Haute | core/models.py | 20 min | Non — modèle pas encore utilisé |
| H6 | 🟠 Haute | urls.py + django-axes | 20 min | Non |
| M1 | 🟡 Moyenne | core/permissions.py | Investigation puis 15 min | Dépend de l'usage trouvé |
| M2 | 🟡 Moyenne | — (organisationnel) | — | — |
| M3 | 🟡 Moyenne | marketing views | 30 min si activé | Non |
| B1-B3 | 🟢 Basse | tests + doc | 20 min | Non |

**Rien dans cette liste ne nécessite de migration destructive ni de changement de comportement pour un utilisateur légitime déjà provisionné correctement.**

## Ordre d'implémentation recommandé

1. **C1 + H1 + H2** (même fichier, même passage — 15 min total)
2. **C2** (nh3 + validate_content)
3. **H3** (allowlist upload_file)
4. **H5** (validators DocumentAttachment, avant que quiconque câble l'upload)
5. **M1** (grep de vérification d'abord — peut ne rien nécessiter)
6. **H6** (django-axes)
7. **H4** (CSP — le plus long à calibrer proprement, faire en dernier avec Report-Only)

Prêt à implémenter 1-6 immédiatement si tu valides. H4 nécessite un aller-retour de calibrage (Report-Only quelques jours) donc à traiter séparément.
