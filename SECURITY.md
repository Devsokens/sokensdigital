# 🔒 SECURITY.md — Soken's Digital

Kit de sécurité applicative adapté à la stack réelle du projet :
**Backend** Django 5 + DRF (`backend/`, auth Firebase via `core.authentication.FirebaseAuthentication`)
**Frontend** Next.js App Router (`frontend/`)
**Stockage** Cloudinary (avatars, chat, fichiers) + Supabase Storage (images marketing)
**Infra** Render (backend), Redis (cache/throttle/Celery), Firebase Auth

Dernier audit : 2026-08-23. Ce document reflète l'état réel constaté dans le code, pas un
générique — quand une case est cochée, c'est vérifié dans `backend/` ou `frontend/`, pas supposé.

---

## 1. État par couche de menace

| Couche | Statut | Preuve / mécanisme |
|---|---|---|
| **Injection SQL** | ✅ | ORM Django partout, aucun `.raw()`/`.extra()`/`cursor.execute` avec input utilisateur trouvé dans `backend/` |
| **Auth** | ✅ | Firebase ID token vérifié côté serveur (`core.authentication.FirebaseAuthentication`), `SECRET_KEY` refuse de démarrer en prod si non défini ([settings.py](backend/sokens_backend/settings.py)) |
| **Mots de passe** | ✅ | Argon2 en premier hasher, validators Django standards |
| **IDOR / accès** | ✅ (à re-vérifier par app) | `get_queryset()` filtré par rôle/appartenance dans chaque ViewSet (ex. `finance/views.py`), `core.permissions.has_role` |
| **Mass assignment** | ✅ | `UserSerializer` (lecture `/auth/me/`) est **read-only complet** ; l'écriture passe par `MeUpdateSerializer`, whitelist explicite (`first_name`, `last_name`, `avatar_url`) — pas de `role`/`is_staff` exposé au self-update |
| **Élévation de privilège** | ✅ | Changement de rôle réservé Super-Admin (`SetUserRoleSerializer`, cf. commentaire "Super-Admin only") |
| **Webhooks** | ✅ | Signature HMAC-SHA256 vérifiée avec `hmac.compare_digest` (timing-safe) dans `administration/views.py` (e-signature webhook) |
| **Upload fichiers** | 🟡 | Whitelist MIME + taille max + recompression Pillow (`core/storage.py`) — **mais SVG passe non filtré** (voir §5 Gaps) |
| **Headers sécurité (API)** | ✅ | HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` actifs dès `DEBUG=False` |
| **Headers sécurité (site Next.js)** | ✅ (corrigé) | Étaient absents — ajoutés dans [next.config.ts](frontend/next.config.ts) (CSP, X-Frame-Options, etc.) |
| **CORS** | ✅ | `CORS_ALLOW_ALL_ORIGINS` lié à `DEBUG` → fail-closed en prod si `CORS_ALLOWED_ORIGINS` oublié |
| **Rate limiting** | 🟡 | `AnonRateThrottle`/`UserRateThrottle` globaux + limiteur Redis dédié sur leads/tickets (`marketing.ratelimit.is_rate_limited`) — scope `public_write` défini mais non appliqué partout (voir §5) |
| **XSS stocké (blog public)** | 🟡 | `dangerouslySetInnerHTML` sans sanitization sur le contenu du blog (voir §5) |
| **Secrets** | ✅ | Aucun `.env`/service-account/`client_secret.json` dans l'historique git ; `.gitignore` correct |
| **Tokens à usage public** | ✅ | `tracking_token` (acceptation de devis) = `UUIDField(default=uuid.uuid4)`, non énumérable |

---

## 2. Ce qui est déjà en place (ne pas casser)

- **Auth** : le frontend n'utilise jamais de mot de passe local — Firebase Auth émet un ID token,
  vérifié à chaque requête par `FirebaseAuthentication`. Ne jamais faire confiance à un header
  `X-User-Id`/`X-Role` envoyé par le client.
- **Autorisation** : chaque ViewSet définit `get_queryset()` pour restreindre aux données que le
  rôle courant a le droit de voir. **Toute nouvelle vue DRF doit faire pareil** — ne jamais faire
  `Model.objects.all()` sans filtre de rôle/appartenance dans un ViewSet exposé à plus qu'un
  Super-Admin.
- **Serializers d'écriture** : suivre le modèle `UserSerializer` (lecture, read-only) /
  `MeUpdateSerializer` (écriture, whitelist) plutôt qu'un seul serializer avec `fields = '__all__'`
  dès qu'un modèle a des champs sensibles (rôle, statut, montants figés après validation, etc.).
- **Rate limiting custom** : `marketing.ratelimit.is_rate_limited(key, limit, window)` (Redis) est
  le pattern déjà utilisé pour les endpoints publics sensibles (capture de leads, création/réponse
  de ticket). Réutiliser cette fonction pour tout nouvel endpoint `AllowAny` qui écrit en base.
- **Uploads** : passer par `core/storage.py` (`upload_image`/`upload_avatar`/`upload_video`/
  `upload_file`), jamais écrire un nouvel endpoint d'upload sans repasser par ces validations
  (type MIME, taille, recompression).

---

## 3. Gaps identifiés (2026-08-23) — nécessitent une décision produit

Ces 3 points sont des vrais écarts par rapport à la checklist §4 mais touchent à des choix
fonctionnels (formats acceptés, contenu autorisé) — je ne les ai **pas corrigés seul**, à trancher :

1. **SVG upload non sanitizé** (`core/storage.py`, `ALLOWED_CONTENT_TYPES`) : un SVG contient du XML
   et peut embarquer `<script>`. Il est actuellement accepté et passé tel quel (`PASSTHROUGH_CONTENT_TYPES`)
   sur l'avatar (tout utilisateur authentifié) et les images marketing. Un SVG malveillant ouvert
   directement (pas seulement en `<img>`) peut exécuter du JS dans l'origine Cloudinary/Supabase.
   → Options : (a) retirer `image/svg+xml` d'`ALLOWED_CONTENT_TYPES`, (b) sanitizer côté serveur
   (ex. lib `defusedxml`/whitelist de balises) avant upload.
2. **Contenu du blog rendu sans sanitization** (`frontend/components/blog/article-content.tsx`,
   `dangerouslySetInnerHTML={{ __html: html }}`) : le HTML vient de l'éditeur riche
   (`rich-text-editor.tsx`, marketing/admin uniquement) et est stocké tel quel. Risque XSS stocké
   sur le site public si un compte marketing est compromis. → Recommandation : sanitizer avec
   `isomorphic-dompurify` côté rendu (`ArticleContent`) en défense en profondeur, même si les
   auteurs sont des comptes de confiance.
3. **`public_write` (throttle scope, 10/h) défini mais jamais appliqué** — les endpoints publics
   les plus sensibles (leads, tickets) ont leur propre limiteur Redis, donc protégés dans les
   faits, mais `PublicQuoteAcceptView` (acceptation de devis) n'a que le throttle anonyme global
   (100/h/IP), sans limite dédiée. Risque faible (le `tracking_token` est un UUID4 non
   énumérable) mais pas de défense en profondeur. → Recommandation : ajouter
   `throttle_classes = [ScopedRateThrottle]; throttle_scope = 'public_write'` sur cette vue.

---

## 4. Checklist sécurité — à cocher dans chaque PR

```markdown
### Input Validation
- [ ] Tous les inputs validés (DRF serializer / Zod côté frontend)
- [ ] Longueurs maximales définies (`max_length`)
- [ ] Pas de `fields = '__all__'` sur un modèle avec un champ sensible (rôle, statut figé, montant validé)
- [ ] Pas de SQL brut / `eval()` / `os.system()`

### Authentification / Autorisation
- [ ] Vue protégée par `IsAuthenticated` (défaut DRF) sauf si `AllowAny` explicitement justifié
- [ ] Si `AllowAny` + écriture : rate limiting dédié (`marketing.ratelimit.is_rate_limited` ou `ScopedRateThrottle`)
- [ ] `get_queryset()` filtré par rôle/appartenance (pas d'IDOR)
- [ ] Pas de rôle/permission modifiable via un serializer de self-update

### Fichiers
- [ ] Upload passe par `core/storage.py` (type MIME + taille + recompression)
- [ ] Pas de nouveau type MIME "passthrough" sans sanitization (cf. gap SVG §3.1)

### Frontend
- [ ] Pas de `dangerouslySetInnerHTML` sans sanitization (DOMPurify) pour du contenu non garanti sûr
- [ ] `rel="noopener noreferrer"` sur les liens externes en `target="_blank"`

### Infra
- [ ] Pas de secret en dur dans le code (variables d'env uniquement)
- [ ] `next.config.ts` headers de sécurité toujours actifs (ne pas supprimer `headers()`)
```

---

## 5. Scripts de test

Voir [scripts/security/](scripts/security/) :
- `test_idor.sh` — accès croisé aux ressources d'autres utilisateurs
- `test_headers.sh` — vérifie les headers de sécurité (API Django **et** site Next.js)
- `test_ratelimit.py` — vérifie le rate limiting sur les endpoints publics réels du projet
- `test_upload.sh` — upload de fichiers malveillants sur les vrais endpoints d'upload
- `security_scan.sh` — scan rapide global, à lancer avant chaque mise en production

```bash
cd scripts/security
./security_scan.sh https://votre-domaine.com
```

Ces scripts ciblent les endpoints **réels** du projet (`/api/v1/...`), pas des exemples
génériques — à adapter si les routes changent (voir `backend/*/urls.py`).

---

## 6. Ce que ce kit ne couvre pas

Un pentest professionnel reste nécessaire avant tout traitement de données de paiement réelles
(le module Finance gère décaissements/facturation) ou avant une mise en production à fort trafic.
Ce document couvre l'essentiel de l'OWASP Top 10, pas une revue exhaustive de la logique métier
Finance/RH (autorisations fines par rôle, séparation des tâches comptables).
