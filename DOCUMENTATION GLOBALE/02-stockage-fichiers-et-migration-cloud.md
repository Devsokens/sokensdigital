# Stockage de fichiers & migration cloud

## Historique de la décision (pourquoi on est sur Cloudinary aujourd'hui)

Le module Messagerie et le module Profil ont besoin d'uploader des fichiers
(photo de profil, pièces jointes de chat). Plusieurs options ont été
essayées dans l'ordre, chacune écartée pour une raison précise — utile à
savoir pour ne pas retomber dans les mêmes murs :

1. **Firebase Storage** (le choix "naturel", même écosystème que
   Auth/Firestore) — **écarté** : Google exige désormais un compte de
   facturation (plan Blaze) pour activer Storage sur un projet, même pour
   rester dans le quota gratuit. Refusé faute de carte bancaire disponible
   à ce moment.
2. **Supabase Storage** (le projet avait déjà un bucket `site-content` pour
   le CMS marketing) — utilisé un temps pour les avatars/pièces jointes,
   puis **écarté pour cet usage** : le projet Supabase de l'organisation
   était déjà à 250% de son quota gratuit d'egress (dépassement constaté
   dans le dashboard Supabase, "Cached Egress Exceeded"). Le garder pour le
   CMS marketing (déjà en place, trafic public du site) mais ne pas y
   ajouter le trafic utilisateur de la messagerie/profil.
3. **Cloudflare R2** (10 Go gratuits, zéro frais d'egress) — **écarté** :
   même mur que Firebase Blaze, Cloudflare exige aussi une carte pour
   activer R2, même si l'usage réel reste dans le tier gratuit.
4. **Google Cloud Storage direct** (contourner Firebase Storage en
   utilisant l'API GCS brute) — **écarté sans même essayer** : c'est le
   même moteur que Firebase Storage, sur le même projet — même exigence de
   compte de facturation avec carte.
5. **Cloudinary** — **retenu**. Plan gratuit (25 crédits ≈ 25 Go), inscription
   testée et confirmée **sans demande de carte bancaire**. Spécialisé
   fichiers/images (redimensionnement à la volée en bonus), API simple.

**Statu quo actuel :** Cloudinary pour tout ce qui est piloté par
l'utilisateur (avatars, pièces jointes chat), Supabase Storage conservé
uniquement pour les assets du CMS marketing (aucun changement là-dessus).

## Pourquoi la migration future sera simple

Le point clé : **aucun code (frontend ou vue Django) ne connaît le nom
"Cloudinary".** Toute la logique d'upload est concentrée dans un seul
fichier, `backend/core/storage.py`, derrière des fonctions au nom neutre :

- `upload_avatar(file)` → retourne une URL publique
- `upload_file(file, folder)` → retourne une URL publique (pièces jointes,
  tout type de fichier)
- `upload_image(file, folder)` / `upload_video(file, folder)` → CMS
  marketing, restent sur Supabase Storage (non concernées par ce guide)

Les vues (`core/views.py` → `AvatarUploadView`, `ChatAttachmentUploadView`)
appellent ces fonctions et ne savent rien du fournisseur derrière. Le
frontend (`frontend/lib/api/upload.ts`) appelle seulement
`/api/v1/uploads/avatar/` et `/api/v1/uploads/chat-attachment/` — deux URLs
Django qui ne changeront jamais, quel que soit le fournisseur de stockage
réel.

**Conséquence concrète : migrer vers un autre cloud ne touche qu'un seul
fichier (`backend/core/storage.py`), jamais le frontend.**

## Guide pas-à-pas : migrer `upload_avatar`/`upload_file` vers un autre fournisseur

Exemple avec un fournisseur S3-compatible (Google Cloud Storage, AWS S3,
Cloudflare R2 le jour où une carte est disponible, Backblaze B2...) — la
même méthode s'applique à n'importe quel service avec une API REST.

### 1. Créer le compte + bucket/ressource chez le nouveau fournisseur
Récupérer les identifiants d'accès (clé API, secret, endpoint/URL de base,
nom du bucket). Les noter, ne rien coder encore.

### 2. Ajouter les nouvelles variables d'environnement
Dans `backend/.env` (local) et dans le dashboard Render (prod) — **ne pas
supprimer les anciennes tout de suite**, pour pouvoir basculer en arrière
si besoin :
```
NOUVEAU_FOURNISSEUR_CLE=...
NOUVEAU_FOURNISSEUR_SECRET=...
NOUVEAU_FOURNISSEUR_BUCKET=...
```

### 3. Ajouter la fonction d'upload dans `core/storage.py`
Suivre le patron déjà en place (`_upload_to_cloudinary`, avant elle
`_upload_to_r2`, avant elle `_upload_bytes` pour Supabase) :
```python
def _upload_to_nouveau_fournisseur(data: bytes, folder: str) -> str:
    # 1. Lire les identifiants depuis os.environ
    # 2. Appeler l'API du fournisseur (SDK officiel ou requests brut)
    # 3. Retourner l'URL publique du fichier uploadé
    # 4. En cas d'échec : raise RuntimeError(message clair)
```

### 4. Rebrancher `upload_avatar` et `upload_file`
Changer uniquement l'appel interne (`_upload_to_cloudinary(...)` →
`_upload_to_nouveau_fournisseur(...)`) dans ces deux fonctions. Rien
d'autre ne bouge — signatures, validations (taille, type MIME), tout reste
identique.

### 5. Adapter les tests
Dans `backend/core/tests.py`, `AvatarUploadViewTests` et
`ChatAttachmentUploadViewTests` mockent aujourd'hui
`core.storage.cloudinary.uploader.upload`. Remplacer ce mock par
l'équivalent du nouveau SDK (même principe : mocker l'appel réseau sortant,
vérifier le code retour et l'URL construite).

### 6. Valider
```bash
cd backend
DEBUG=True ./.venv/Scripts/python.exe manage.py test core
```
Puis, comme fait lors du passage à Cloudinary, un test réel via
`manage.py shell` avec un vrai fichier avant de considérer que c'est prêt
en prod (voir la commande utilisée dans l'historique de session — upload
d'une image de test, vérification que l'URL retournée est accessible).

### 7. Déployer
Ajouter les nouvelles variables d'environnement dans le dashboard Render,
redéployer. **Aucun redéploiement frontend nécessaire** — c'est tout
l'intérêt de l'indirection.

### Ce qu'il ne faut PAS faire
- Ne pas faire parler le frontend directement au SDK du nouveau fournisseur
  (perte de l'indirection, ré-exposition d'identifiants côté client, retour
  en arrière sur ce qui a justifié ce choix d'architecture).
- Ne pas migrer les fichiers déjà uploadés automatiquement en changeant
  juste la config — les URLs déjà enregistrées en base (`avatar_url`,
  `attachment.url` dans Firestore) pointent vers l'ancien fournisseur et
  continueront de fonctionner tant qu'il reste actif. Une vraie migration
  de fichiers existants est une opération à part (script de copie
  ancien→nouveau bucket + mise à jour des URLs stockées), pas couverte ici
  car pas encore nécessaire.

## Quand reconsidérer ce choix

- **Si une carte bancaire devient disponible** : Firebase Storage (Blaze)
  redevient l'option la plus cohérente avec le reste de l'écosystème déjà
  utilisé (Auth, Firestore) — évite d'avoir un troisième fournisseur
  (Cloudinary) en plus de Firebase et Supabase. Migration : suivre le guide
  ci-dessus avec le SDK `firebase-admin` (déjà une dépendance backend) côté
  `_upload_to_firebase_storage`.
- **Si le volume de fichiers dépasse le quota gratuit Cloudinary (25 Go)** :
  vérifier d'abord si c'est du stockage (fichiers accumulés — envisager une
  purge/rétention) ou de la bande passante (fichiers très consultés —
  envisager un CDN devant, ou un fournisseur avec egress illimité comme R2
  une fois une carte disponible).
