# Spécifications Backend — Soken's Digital

> Document de référence unique pour le développement du backend, feature par
> feature. Toute nouvelle fonctionnalité codée doit être ajoutée/mise à jour
> ici en même temps que le code (source de vérité partagée entre l'équipe et
> le Swagger généré par `drf-spectacular`).

---

## 0. Base de données : PostgreSQL 16

**Réponse à la question posée : PostgreSQL, pas de débat.** Ce n'est pas
seulement la suite logique de l'existant (`docker-compose.yml` fait déjà
tourner `postgres:16-alpine`, `settings.py` lit déjà `DATABASE_URL` via
`dj_database_url`) — c'est aussi une contrainte dure imposée par les specs
elles-mêmes :

- **Vues matérialisées** (§4.6 Comptabilité, §4.5 Marketing) : fonctionnalité
  native PostgreSQL (`CREATE MATERIALIZED VIEW` / `REFRESH MATERIALIZED
  VIEW`). MySQL ne les supporte pas ; SQLite non plus.
- **JSONField avancé** (`permissions`, `tags`, `additional_images`,
  `payload_details`) : PostgreSQL a l'implémentation JSONB la plus mature de
  l'écosystème Django (indexable, requêtable).
- **GenericForeignKey** massivement utilisé (`AuditLog`, `JournalEntry`,
  `BankStatementLine`) : fonctionne partout, mais les index et la volumétrie
  attendue (audit trail immuable, écritures comptables) veulent un moteur
  robuste en écriture concurrente.
- **Django full-text / agrégations lourdes** (pipeline pondéré, DSO,
  rapports financiers) : `Sum`, `Count`, fenêtres analytiques — PostgreSQL est
  le backend le plus performant et le mieux supporté par l'ORM pour ça.

En local/dev : conteneur `postgres:16-alpine` (déjà en place).

**En prod, la base est hébergée sur Supabase, pas sur Render.** Le Postgres
managé gratuit de Render est supprimé **définitivement** 30 jours après sa
création (+14 jours de grâce, 44 jours max) — inacceptable pour une base sur
laquelle toute l'équipe construit. Supabase (plan free) a un comportement
très différent : le projet se **met en pause** après 7 jours d'inactivité,
mais les données ne sont **jamais supprimées** — juste besoin de cliquer
"Restore" dans le dashboard Supabase pour réactiver (pas de réveil
automatique à la requête suivante, contrairement à des alternatives comme
Neon — à surveiller si l'API est inutilisée plus d'une semaine, ex. vacances).
Limites du plan gratuit : 500 Mo de base, 5 Go d'egress/mois, 2 projets actifs
max. `render.yaml` ne provisionne donc **pas** de base — `DATABASE_URL` est
une variable à renseigner à la main dans le dashboard Render avec la chaîne
de connexion Supabase (mode "Connection pooling", pas la connexion directe).

**Redis** reste le second pilier, mais hébergé sur **Upstash** (pas Render) :
cache (`django-redis`, déjà branché), file Celery (leads, notifications,
génération PDF, publication réseaux sociaux, rappels programmés), et clé de
cache des dashboards. Écarté du Key Value gratuit de Render pour deux
raisons : aucune persistance disque (perte de données à chaque redémarrage,
et Render peut redémarrer l'instance "à tout moment" pour maintenance), et
ça évite de déclencher la demande de carte bancaire liée aux ressources de
type base de données dans un Blueprint. Upstash (plan free) : 256 Mo, 500K
commandes/mois, aucune carte requise, pas d'expiration par inactivité
documentée. `REDIS_URL` est, comme `DATABASE_URL`, une variable à renseigner
à la main dans Render (`rediss://...`, connexion TLS).

Firebase (déjà utilisé pour l'auth) n'a **pas** de produit Redis/cache — le
seul Redis dans l'écosystème Google est Memorystore, un service Google Cloud
séparé et payant dès la création (pas de plan gratuit), donc écarté aussi.

**Stockage de fichiers (PDF, images, exports)** : Google Drive, comme prévu
dans les specs métier d'origine (factures, contrats RH, médias CMS convertis
en WebP). Nécessite un compte de service Google Drive (même mécanisme que
Firebase Admin) — pas bloquant pour le déploiement initial, à mettre en place
avant le module Devis/Facturation ou CMS.

---

## 1. Stack technique (rappel, ne change pas)

| Couche | Choix | Statut |
|---|---|---|
| Framework | Django 5.x + Django REST Framework | En place |
| Base de données | PostgreSQL 16, hébergée sur **Supabase** (pas Render, voir §0) | En place localement ; projet Supabase à créer par l'équipe |
| Cache / broker | Redis 7, hébergé sur **Upstash** | Branché en cache Django (`django-redis`) et broker Celery |
| Tâches async | Celery + Celery Beat | `sokens_backend/celery.py` créé, aucune tâche métier encore écrite |
| Auth | Firebase Admin (vérification de token) → `core.User` interne | Fonctionnel (uid stable via `firebase_uid`, lien auto au premier login) ; SDK initialisé mais attend un vrai `FIREBASE_SERVICE_ACCOUNT_JSON` en prod |
| Docs API | `drf-spectacular` (Swagger UI + Redoc) | Branché sur `/api/schema/`, `/api/docs/`, `/api/redoc/` — 1 endpoint réel documenté (`/api/v1/auth/me/`) |
| Fichiers (PDF, images, exports) | Google Drive | Décidé, pas encore intégré (`core/services/drive.py` à créer), pas bloquant avant le module Devis/CMS |
| Déploiement backend | Render (Docker Web Service uniquement) | `render.yaml` prêt, service à créer par l'équipe (comptes Render/Firebase/Vercel obtenus) |
| Déploiement frontend | Vercel | Pas encore déployé |
| Chiffrement au repos | `django-cryptography-django5` (fork Django 5.x) | Fonctionnel, `email_hash` (SHA-256) ajouté pour l'unicité/recherche réelle (voir §9) |

---

## 2. Architecture applicative : découpage en apps Django

L'existant ne contient qu'une seule app (`core`). Vu le nombre de domaines
métier décrits, on découpe en apps par département — plus lisible, plus
testable, permissions plus faciles à isoler. `core` reste le socle partagé.

```
backend/
├── core/          # User, Role, Department, AuditLog, Session, auth, permissions de base
├── hr/             # EmployeeProfile, Contract              (Admin/RH)
├── projects/       # Project, Timesheet, ProjectChannel      (Technique)
├── finance/        # Account, JournalEntry, TransactionLine, Invoice, InvoiceLine,
│                   # BankStatementLine, TaxDeclaration, DisbursementRequest
├── marketing/       # Lead, Quote, QuoteLine, SocialPost, CMS (HeroSection, Service,
│                   # ProjectPortfolio, BlogPost, Testimonial, Partner)
└── dashboard/       # Endpoint agrégé /api/v1/dashboard/global/ uniquement (lecture
                    # cross-département, pas de modèles propres)
```

**Décision de réconciliation** : les specs fournies définissent `Quote` /
`QuoteLine` deux fois (une version simple sous Comptabilité §4.2, une version
complète avec `tracking_token`, `opened_at`, `signed_at` sous Marketing §4.2).
On retient **la version Marketing** (plus complète, cohérente avec le cycle
Lead → Quote → conversion client) comme unique source de vérité. Comptabilité
n'interagit avec `Quote` qu'en lecture (validation des prix/remises) et
possède son propre `Invoice`/`InvoiceLine`, généré à la conversion d'un
`Quote` accepté.

**Note** : `ProjectPortfolio` (CMS, contenu public "études de cas" —
correspond aux pages `/projects` déjà construites côté frontend) est distinct
de `Project` (suivi opérationnel interne : timesheets, décaissements,
messagerie). Un lien optionnel `ProjectPortfolio.linked_project` pourra être
ajouté plus tard si on veut publier automatiquement un projet interne clos.

---

## 3. Authentification & Comptes (`core`)

Fondation de tout le reste — **première brique à coder**.

### 3.1 Flux d'authentification

- Le frontend s'authentifie auprès de **Firebase** (déjà configuré côté
  Next.js — variables `NEXT_PUBLIC_FIREBASE_*`), obtient un ID token.
- Chaque requête API porte `Authorization: Bearer <id_token>`.
- `core.authentication.FirebaseAuthentication` vérifie le token auprès de
  Firebase Admin, résout/crée le `User` interne via `firebase_uid` (corrigé —
  voir §9), retourne `(user, decoded_token)`.
- **Pas d'auto-inscription publique** : les comptes sont créés par un
  Super-Administrateur ou un Responsable RH (cohérent avec la matrice RBAC —
  aucun rôle "public" ne peut créer un `User`). Le endpoint public de contact
  ne crée que des `Lead`, jamais de `User`.

### 3.2 Endpoints ✅ implémenté (hors items marqués ⏳)

| Méthode | Route | Description | Permission | Statut |
|---|---|---|---|---|
| GET | `/api/v1/auth/me/` | Profil de l'utilisateur courant (infos `User` + `department` — le rôle est lu depuis Firestore côté frontend, pas exposé ici) | `IsAuthenticated` | ✅ |
| PATCH | `/api/v1/auth/me/` | Mise à jour des champs auto-gérables (`first_name`, `last_name`, `avatar_url`) | `IsAuthenticated`, propriétaire uniquement | ✅ |
| POST | `/api/v1/auth/mfa/enable/` | Active `mfa_enabled` | `IsAuthenticated` | ⏳ |
| GET/DELETE | `/api/v1/auth/sessions/` | Sessions actives (`Session`) | `IsAuthenticated`, propriétaire uniquement | ⏳ |

### 3.3 Gestion des utilisateurs (Admin/RH) ✅ implémenté

| Méthode | Route | Description | Permission | Statut |
|---|---|---|---|---|
| GET | `/api/v1/users/` | Liste des comptes Django (mirror row — pas la source de vérité, juste pour lier des enregistrements RH/Finance/Projets) | Super-Admin, Responsable RH | ✅ |
| POST | `/api/v1/users/provision/` | Crée un compte (Firebase Auth + profil Firestore + `User` Django) en un seul appel | Super-Admin, Responsable RH — mais **RH ne peut jamais assigner `SUPER_ADMIN`** (403 sinon) | ✅ |
| PATCH | `/api/v1/users/{id}/role/` | Change le rôle/département d'un utilisateur **existant** | Super-Admin uniquement | ✅ |
| GET/POST | `/api/v1/departments/` | Gestion des départements | Super-Admin uniquement | ✅ |
| GET | `/api/v1/audit-logs/` | Consultation de la table immuable `AuditLog` (alimentée automatiquement à la suppression de tout `LoggedModel`, aucun endpoint d'écriture) | Super-Admin uniquement | ✅ |

**Pourquoi le provisioning passe par Django et pas le SDK client Firebase** :
`createUserWithEmailAndPassword` côté navigateur connecte automatiquement le
navigateur en tant que le nouvel utilisateur créé — ce qui déconnecterait
l'admin de sa propre session. Le SDK Admin (serveur, déjà initialisé dans
`core/apps.py`) n'a pas cet effet de bord.

---

## 4. Département Administration & RH (`hr`)

### 4.1 Modèles

**`EmployeeProfile`**
- `id` (UUID), `user` (OneToOne → `core.User`)
- `hire_date` (Date), `position` (Chaîne), `gross_monthly_salary` (Decimal,
  chiffré), `base_hourly_cost` (Decimal, **calculé automatiquement** à la
  sauvegarde à partir du salaire brut — logique dans `clean()`/`save()`)
- `birth_date` (Date, pour le widget "anniversaires de la semaine" du
  Dashboard Global)

**`Contract`**
- `id` (UUID), `employee` (FK → `EmployeeProfile`)
- `contract_type` (Enum : CDI, CDD, STAGE, PRESTATAIRE), `start_date`,
  `end_date` (null=True)
- `document_url` (Chaîne — lien Google Drive du PDF signé)

### 4.2 Endpoints

| Méthode | Route | Description | Permission |
|---|---|---|---|
| GET/POST | `/api/v1/hr/employees/` | Liste / création de profils employés | Super-Admin, Responsable RH |
| GET/PATCH | `/api/v1/hr/employees/{id}/` | Détail / modification (dont salaire → coût horaire) | Super-Admin, Responsable RH |
| GET | `/api/v1/hr/employees/me/` | Son propre profil (lecture seule) | `IsAuthenticated`, propriétaire |
| GET/POST | `/api/v1/hr/contracts/` | Liste / création de contrats | Super-Admin, Responsable RH |
| GET | `/api/v1/hr/contracts/me/` | Ses propres contrats (téléchargement) | `IsAuthenticated`, propriétaire |

**Sécurité** : `gross_monthly_salary` chiffré au repos (même mécanisme que
`User.email`/`User.phone`). Aucun endpoint ne l'expose à un rôle autre que
Super-Admin/RH — sérialiseur dédié (`EmployeeProfileSelfSerializer`) qui
masque le champ pour la route `/me/`.

---

## 5. Département Technique & Projets (`projects`)

> Département dont la spec détaillée n'a pas été fournie in extenso — les
> informations ci-dessous sont **déduites** des références croisées dans la
> matrice RBAC (Timesheets, décaissements N1 liés à un projet, messagerie de
> projet). `Project`/`ProjectMember` sont implémentés (✅ voir §9 item 16) ;
> `Timesheet` et `ProjectChannel`/`ProjectMessage` restent à faire. `client`
> (FK → `ClientAccount`) a été omis du modèle implémenté — `ClientAccount`
> n'est toujours pas défini (§13), à ajouter une fois clarifié.

### 5.1 Modèles

**`Project`** ✅ implémenté
- `id` (UUID), `name`, `status` (Enum : EN_COURS, EN_PAUSE, TERMINE, ANNULE)
- `lead_project_manager` (FK → `User`, nullable), `team_members` (M2M →
  `User`, via `ProjectMember`)
- `start_date`, `end_date` (validé : `end_date >= start_date`), `budget`
  (Decimal, nullable — la restriction de visibilité par rôle sur ce champ
  n'est pas encore appliquée au niveau serializer, à faire avec la RBAC
  complète)

**`ProjectMember`** ✅ implémenté — table de jointure `project`/`user`,
contrainte d'unicité, `created_at` pour audit.

**`Timesheet`** ✅ implémenté
- `id` (UUID), `project` (FK), `user` (FK), `date`, `hours` (Decimal,
  0 < heures ≤ 24), `description`, `status` (Enum : SOUMIS, VALIDE, REJETE)
- Contrainte d'unicité `(project, user, date)` — une seule saisie par jour
  et par projet (vérifiée côté vue pour renvoyer un 400 propre plutôt que
  laisser remonter l'`IntegrityError` de la contrainte DB).

**`ProjectChannel` / `ProjectMessage`**
- Canal de messagerie par projet (`ProjectChannel` 1-1 avec `Project`),
  `ProjectMessage` (auteur, contenu, horodatage) — probablement à terme sur
  websocket/Firebase Realtime plutôt que du polling REST pur ; le CRUD REST
  sert de fallback/historique.

### 5.2 Endpoints

| Méthode | Route | Description | Permission | Statut |
|---|---|---|---|---|
| GET/POST | `/api/v1/projects/` | Liste / création | Chef de Projet, Super-Admin (création) ; lecture élargie (lead, membre, ou rôle Directeur Financier/Super-Admin) | ✅ |
| GET/PATCH/DELETE | `/api/v1/projects/{id}/` | Détail / modification | Lead du projet, Super-Admin (écriture) ; lead/membre/rôle élargi (lecture) | ✅ |
| POST | `/api/v1/projects/{id}/members/` | Ajouter un membre | Lead du projet, Super-Admin | ✅ |
| DELETE | `/api/v1/projects/{id}/members/{membership_id}/` | Retirer un membre | Lead du projet, Super-Admin | ✅ |
| GET/POST | `/api/v1/projects/{id}/timesheets/` | Feuilles de temps du projet | Équipe assignée (soumission de ses propres heures), Chef de Projet (voit tout) | ✅ |
| POST | `/api/v1/projects/{id}/timesheets/{ts_id}/validate/` | Validation d'une feuille de temps | Chef de Projet du projet, Super-Admin | ✅ |

**Messagerie du projet** ✅ implémentée, mais **pas** comme un endpoint
Django ci-dessus : le chat vit entièrement dans Firestore
(`chatRooms/project-{id}` + sous-collection `messages`), conformément à la
règle d'architecture "Firestore possède identité/rôle/chat". Django ne fait
que pousser le salon (`upsert_chat_room`) et la liste des `memberUids`
(`set_chat_room_members`) via l'Admin SDK, à chaque création de projet ou
changement de membres (`ProjectViewSet.perform_create`/`add_member`/
`remove_member`, `core/firestore_client.py`). Idem pour les salons de
département (`chatRooms/dept-{id}`, `DepartmentViewSet.perform_create`). Le
salon `chatRooms/company` (annonces d'entreprise) est unique et n'est
rattaché à aucun modèle Django — il se crée une fois par environnement via
`python manage.py create_company_room`. Front : `lib/firebase/chat.ts` +
écran `/admin/messagerie`, lecture/écriture temps réel via `onSnapshot`.

**Dépendance croisée** ✅ implémentée : `finance.DisbursementRequest`
référence `projects.Project` — un Chef de Projet ne peut initier une
demande (N1) que pour un projet dont il est `lead_project_manager`
(vérifié dans `DisbursementRequestViewSet.perform_create`, 403 sinon).

---

## 6. Département Comptabilité & Finance (`finance`)

✅ implémenté (§4.1/§4.2 de la spec rôles), avec des simplifications
délibérées documentées section par section — ce n'est **pas** le plan
comptable OHADA complet ni un export FEC certifié DGFiP, juste assez de
structure pour poser des écritures équilibrées et calculer la TVA.

### 6.1 Plan Comptable & Écritures (partie double)

**`Account`** ✅ — `code` (unique), `name`, `account_class` (Enum
ACTIF/PASSIF/CHARGE/PRODUIT/TVA). Pas de hiérarchie parent/enfant — plan
comptable simplifié, pas le PCG/OHADA complet.

**`AccountingPeriod`** ✅ — `label` (ex. `2026-07`), `start_date`,
`end_date`, `status` (Enum OUVERTE/CLOTUREE), `closed_by`/`closed_at`.
Ouverture/clôture réservées à Directeur Financier + Super-Admin
(`IsDirecteurFinancierOrSuperAdmin`, §4.1 "Seul rôle, avec le Super-Admin,
habilité à ouvrir ou verrouiller définitivement des exercices").

**`JournalEntry`** ✅ (Grand Livre) — `period` (FK, `PROTECT`),
`journal_code` (Enum VE/AC/BQ/OD), `date`, `label`, `created_by`,
`source_invoice` (FK nullable — renseigné quand l'écriture vient de la
validation automatique d'une facture, pas d'une saisie manuelle).
Immuable une fois postée (pas d'update/destroy, même logique que
`AuditLog`) — une correction se fait par contre-écriture, pas par édition.

**`TransactionLine`** ✅ — `entry` (FK, `related_name='lines'`), `account`
(FK, `PROTECT`), `label`, `debit`/`credit` (Decimal, l'un des deux doit être
nul), `lettrage_code` (rempli lors du rapprochement bancaire, §6.4).

**Règle d'équilibre** ✅ : `JournalEntrySerializer.validate()` rejette toute
écriture où `sum(lines.debit) != sum(lines.credit)`, ou avec moins de deux
lignes — validation atomique, toutes les lignes créées dans le même appel
(`POST /api/v1/finance/journal-entries/`).

**Verrouillage d'exercice** ✅ : `JournalEntrySerializer.validate()` rejette
toute nouvelle écriture si la période visée est `CLOTUREE`.

**Déclencheurs automatiques** : seule la validation de facture (§6.2) est
câblée aujourd'hui. Note de frais et lettrage bancaire ne génèrent **pas**
d'écriture automatique — `ExpenseReport` n'existe pas comme modèle
(§13, question ouverte), et le lettrage (§6.4) associe une ligne existante
à une transaction bancaire sans en créer une nouvelle.

### 6.2 Facturation

`Quote`/`QuoteLine` restent la propriété du module **Marketing** (§7.2) —
pas de lien direct `Quote → Invoice` implémenté (§13, question ouverte sur
`ClientAccount`) : `Invoice` se crée indépendamment aujourd'hui, avec juste
un `client_name` texte libre.

**`Invoice`** ✅ — `invoice_number` (auto, `FAC-{année}-{seq:05d}`),
`client_name`, `issue_date`, `due_date`, `amount_ht`, `vat_rate` (défaut
`finance.models.DEFAULT_VAT_RATE` — même avertissement placeholder que
`marketing.models.DEFAULT_VAT_RATE`, taux non confirmé), `amount_ttc`
(calculé serveur), `status` (Enum BROUILLON/VALIDEE).

**`POST /api/v1/finance/invoices/{id}/validate/`** ✅ (Comptable/Super-Admin)
— exige une `AccountingPeriod` **ouverte** couvrant `issue_date` (400 sinon),
puis poste automatiquement une `JournalEntry` équilibrée : débit Client
(411) = TTC, crédit Prestations (706) = HT, crédit TVA collectée (4457) =
TVA. Les comptes 411/706/4457 sont créés à la volée (`get_or_create`) s'ils
n'existent pas encore.

**Non implémenté** : génération PDF, envoi email, relances automatiques sur
échéance dépassée (même limitation que `Quote.send()`, §7.2 — aucune
librairie PDF ni backend email configuré).

### 6.3 Décaissements ✅ implémenté (N1 → N2/N3 → exécution, complet)

**`DisbursementRequest`** ✅ — `project` (FK nullable), `requested_by`,
`amount`, `beneficiary`, `reason`, `status` (Enum EN_ATTENTE_N1/
EN_ATTENTE_N2/APPROUVE/REJETE/EXECUTE), `decided_by`/`decided_at`,
`executed_by`/`executed_at`.

Workflow complet :
- **N1 (initiation)** ✅ : Chef de Projet, restreint à ses propres projets
  (`project.lead_project_manager == request.user`, 403 sinon).
  `POST /api/v1/finance/disbursement-requests/`.
- **N2/N3 (validation hiérarchique finale)** ✅ : `POST
  /api/v1/finance/disbursement-requests/{id}/approve/` `{decision: APPROUVE
  | REJETE}` — Directeur Financier/Super-Admin uniquement. Modélisé comme
  une **seule** étape d'approbation finale (le spec parle de "N2/N3" mais
  aucun rôle d'approbateur N1 intermédiaire distinct n'existe) plutôt que
  deux statuts EN_ATTENTE_N2 séquentiels.
- **Exécution** ✅ : `POST
  /api/v1/finance/disbursement-requests/{id}/execute/` — Comptable/
  Super-Admin, uniquement depuis `APPROUVE` → `EXECUTE`. Ne génère **pas**
  d'écriture comptable automatique (contrairement à la validation de
  facture) — pas de compte "tiers"/charge dédié défini pour ça encore.

### 6.4 Rapprochement bancaire (sans API bancaire directe)

**`BankStatementImport`** ✅ — métadonnées d'un lot d'import (`filename`,
`imported_by`). Le fichier CSV lui-même n'est **pas** stocké (pas de backend
de stockage de fichiers configuré) — seules les lignes déjà parsées sont
envoyées (`POST /api/v1/finance/bank-imports/` avec `rows: [{date, label,
amount}]`), pas d'upload de fichier brut ni de parsing CSV côté serveur.

**`BankTransaction`** ✅ — `date`, `label`, `amount`, `matched_line` (FK
`TransactionLine`, `OneToOne`), `status` (Enum NON_LETTRE/LETTRE).

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/v1/finance/bank-imports/` | Import de lignes déjà parsées (pas de CSV brut) |
| GET | `/api/v1/finance/bank-imports/{id}/transactions/{tx_id}/suggestions/` | Suggestions = lignes non lettrées du compte `512` au même montant (pas de correspondance floue sur le libellé) |
| POST | `/api/v1/finance/bank-imports/{id}/transactions/{tx_id}/match/` | Lettrage manuel — `{line_id}` → statut `LETTRE`, `lettrage_code` généré |

Pas de verrouillage définitif après lettrage (contrairement au brouillon
initial) — un lettrage peut en théorie être refait via un nouveau `match`.

### 6.5 Déclarations fiscales & TVA

**`TaxDeclaration`** ✅ — `period` (OneToOne → `AccountingPeriod`),
`status` (Enum BROUILLON/VALIDEE), `collected_vat`, `deductible_vat`,
`net_vat`, `generated_by`, `validated_by`/`validated_at`.

| Méthode | Route | Permission |
|---|---|---|
| POST | `/api/v1/finance/tax-declarations/generate/` `{period_id}` | Comptable/Super-Admin — recalcule `collected_vat`/`deductible_vat` depuis les `TransactionLine` postées sur les comptes `4457`/`4456` de la période (`update_or_create`, donc regénérable) |
| POST | `/api/v1/finance/tax-declarations/{id}/validate/` | Directeur Financier/Super-Admin uniquement (§4.1 "Gouvernance fiscale" — validation/signature) |

Pas de génération de "liasse fiscale" formatée — juste les trois montants.

### 6.6 Rapports & Tableau de bord Finance

| Méthode | Route | Permission |
|---|---|---|
| GET | `/api/v1/finance/dashboard/` | Directeur Financier/Super-Admin uniquement (§4.1 "Analytique & Reporting") |
| GET | `/api/v1/finance/accounting-periods/{id}/fec-export/` | Comptable/Directeur Financier/Super-Admin — export texte simplifié (8 colonnes essentielles), **pas** le format FEC DGFiP certifié à 18 colonnes obligatoires |

Contenu du dashboard, calculé à la volée (pas de vue matérialisée ni de
cache Redis) :
- `cash_balance` : solde du compte `512` (débit − crédit, toutes périodes).
- `gross_result` : produits − charges (classes `PRODUIT`/`CHARGE`), toutes
  périodes confondues.
- `dso_days` : délai moyen `due_date - issue_date` sur les factures
  `VALIDEE` avec échéance — approximation du DSO réel (qui se calcule
  normalement sur l'encaissement effectif, non suivi ici).
- `executed_disbursements_by_project` : total des décaissements `EXECUTE`
  groupés par projet. **Pas une vraie marge par projet** — le revenu par
  projet n'est pas suivi côté Django (`Quote` ne référence pas `Project`,
  §13) donc ce n'est que le coût, pas marge = revenu − coût.

---

## 7. Département Marketing & Communication (`marketing`)

### 7.1 Leads ✅ implémenté (hors items marqués ⏳)

**`Lead`** — `id` (UUID), `first_name`, `last_name`, `company_name`,
`email` (indexé), `phone`, `source` (Enum FORMULAIRE_CONTACT/
FORMULAIRE_DEVIS/APPEL_ENTRANT/SITE_WEB/EVENEMENT), `message`, `status`
(Enum NOUVEAU/QUALIFIE/PROPOSITION_EN_COURS/PERDU/CONVERTI), `assigned_to`
(FK → `User`, null=True), `qualification_score` (0–100). `client` (FK →
`ClientAccount`) omis — `ClientAccount` toujours pas défini (§13).

| Méthode | Route | Description | Permission | Statut |
|---|---|---|---|---|
| POST | `/api/v1/public/leads/` | Ingestion publique (formulaire site vitrine) | **Public** — rate limiting Redis (3/IP/min) | ✅ (reCAPTCHA ⏳ — pas de clé configurée) |
| GET/POST | `/api/v1/marketing/leads/` | Liste (filtrée par `assigned_to` pour les commerciaux) / création manuelle | Responsable Marketing, Commercial (ses leads), Super-Admin | ✅ |
| PATCH | `/api/v1/marketing/leads/{id}/` | Qualification, réassignation | Responsable Marketing, Super-Admin (tout) ; Commercial (ses leads assignés) | ✅ |
| POST | `/api/v1/marketing/leads/{id}/convert/` | Conversion en `ClientAccount` (transaction atomique) | Responsable Marketing, Commercial (ses leads), Super-Admin | ⏳ (bloqué sur `ClientAccount` indéfini) |

Notification (signal `post_save` → Celery → Firebase + email) : ⏳ pas
implémentée (pas de backend email configuré, pas de collection Firestore
`notifications` câblée côté serveur).

### 7.2 Devis ✅ implémenté (hors PDF/email, ⏳)

**`Quote`** — `id` (UUID), `lead` (FK, null=True), `created_by` (FK →
`User` — pas dans la liste de champs d'origine, nécessaire pour filtrer
"les siens" côté Commercial), `quote_number` (unique,
`DEV-{annee}-{seq:05d}`, généré en séquence par année), `issue_date`,
`expiry_date`, `status` (Enum BROUILLON/ENVOYE/ACCEPTE/REFUSE),
`discount_amount`, `total_ht`, `total_ttc` (les deux recalculés côté
serveur à chaque écriture d'une ligne — jamais fait confiance côté
client), `tracking_token` (UUID v4, généré crypto), `opened_at`,
`signed_at`, `parent_quote`/`version` (mécanisme de versionnage). `client`
(FK → `ClientAccount`) omis — même question ouverte que sur `Lead` (§13).

> ⚠️ **TVA** : `total_ttc = total_ht × (1 + 18%)` — 18% est un taux
> **placeholder** (référence OHADA/CEMAC courante), aucun taux confirmé
> pour la juridiction réelle de Soken's Digital n'a été communiqué. À
> corriger dès que la Comptabilité confirme le taux applicable
> (`marketing.models.DEFAULT_VAT_RATE`).

**`QuoteLine`** ✅ — `id` (UUID), `quote` (FK, `related_name='lines'`,
`CASCADE`), `service_title`, `quantity`, `unit_price`, `total_line`
(recalculé côté serveur à chaque `save()`).

**Verrouillage & versionnage** ✅ : `ENVOYE`/`ACCEPTE`/`REFUSE` → lecture
seule (rejet 400 sur PATCH) ; `POST /clone/` crée une nouvelle `Quote`
BROUILLON (`parent_quote` + `version` incrémentée) avec les mêmes lignes.

| Méthode | Route | Description | Permission | Statut |
|---|---|---|---|---|
| GET/POST | `/api/v1/marketing/quotes/` | Liste / création (BROUILLON) | Commercial (les siens), Chef de Projet (lecture seule, collaboration technique), Super-Admin | ✅ |
| PATCH/DELETE | `/api/v1/marketing/quotes/{id}/` | Édition (BROUILLON uniquement — 400 sinon) | Commercial propriétaire, Super-Admin | ✅ |
| POST | `/api/v1/marketing/quotes/{id}/send/` | Passage à `ENVOYE` (requiert ≥1 ligne) | Commercial propriétaire, Super-Admin | ✅ (génération PDF + email ⏳ — pas de lib PDF ni backend email configurés) |
| POST | `/api/v1/marketing/quotes/{id}/clone/` | Nouvelle version | Commercial propriétaire, Super-Admin | ✅ |
| GET | `/api/v1/public/quotes/track/{tracking_token}/` | Consultation publique par le client, enregistre `opened_at` (une seule fois) | **Public** (token = auth) | ✅ (API seulement — pas de page frontend publique dédiée, ⏳) |

### 7.3 CMS (site vitrine public)

Modèles prévus : `HeroSection`, `Service`, `ProjectPortfolio`, `BlogPost`,
`Testimonial`, `Partner` — correspondent terme à terme aux sections déjà
codées en frontend statique (`Hero`, `Services`, `RecentProjects`,
`BlogInsights`, `Testimonials`, `PartnerLogos`). Seul `BlogPost` est
implémenté pour l'instant ; les autres suivront sur le même principe.

**`BlogPost`** ✅ implémenté — `id`, `title`, `slug` (unique, auto-généré
via `slugify`), `author` (FK → `User`), `excerpt`, **`content` (JSON, pas
`content_html`)**, `visual_icon`/`visual_label`/`visual_sublabel`, `tags`
(JSON), `status` (Enum BROUILLON/PUBLIE — passage à `PUBLIE` fixe
`published_at` automatiquement si vide), `meta_description`.

> **Écart assumé avec la version initiale de cette spec** : `content_html`
> aurait exigé un rendu HTML brut, alors que le frontend existant
> (`lib/blog/posts.ts`, `lib/blog/types.ts`) affiche un contenu **structuré**
> (paragraphes, titres, blocs de code, tableaux, comparatifs, callouts) via
> un composant de rendu dédié. `content` est donc un tableau JSON qui
> reprend exactement la forme `Block[]` du frontend — migrer vers du HTML
> brut aurait cassé ce rendu. Les champs `icon` (type `LucideIcon` côté
> frontend, dans `visual_icon` et les blocs `callout`) sont stockés comme
> **noms d'icônes** (string, ex. `"ShieldCheck"`) — un composant React ne se
> sérialise pas ; le frontend devra faire la correspondance nom → composant
> à la migration.

Upload d'image → conversion WebP + Google Drive : ⏳ pas implémenté (même
limitation que les autres départements, voir §0/§13).

| Méthode | Route | Permission | Statut |
|---|---|---|---|
| GET | `/api/v1/public/cms/blog/` , `/api/v1/public/cms/blog/{slug}/` | **Public**, lecture seule, `status=PUBLIE` uniquement | ✅ |
| GET/POST/PATCH/DELETE | `/api/v1/marketing/cms/blog/` | Responsable Marketing, Super-Admin uniquement | ✅ |
| — | `/api/v1/public/cms/projects/`, `/testimonials/`, `/partners/`, `/hero/` + équivalents `/marketing/cms/...` | idem | ⏳ (modèles pas encore créés) |

### 7.4 Publications Réseaux Sociaux & Plan Éditorial ✅ implémenté (hors moteur de publication, ⏳)

**`SocialPost`** ✅ — `title`, `content`, `image_path`, `additional_images`
(JSON), `platform` (Enum LINKEDIN/TWITTER/FACEBOOK/INSTAGRAM/YOUTUBE),
`scheduled_at`, `status` (Enum DRAFT/SCHEDULED/PUBLISHED/FAILED/CANCELLED),
`published_at`, `post_url`, `author` (FK), `notes`, `tags` (JSON).

**Validation par plateforme** ✅ (serializer + `clean()`) : `TWITTER` →
`content` ≤ 280 caractères ; `INSTAGRAM` → `image_path` obligatoire.

> ⏳ **Moteur de publication non implémenté** : pas de cron Celery Beat
> interrogeant les posts `SCHEDULED`, pas d'appel aux API externes
> (LinkedIn/Facebook Graph/etc.), pas de rappels J-3h/J-2h/J-1h — aucune
> credential de plateforme n'est configurée. `schedule`/`cancel` ne
> changent que le statut en base ; rien ne se publie réellement nulle
> part pour l'instant. Passerelle CMS → Réseaux sociaux (auto-génération
> d'un `SocialPost` DRAFT à la publication d'un `BlogPost`) : ⏳ pas fait.

| Méthode | Route | Permission | Statut |
|---|---|---|---|
| GET/POST | `/api/v1/marketing/social-posts/` | Responsable Marketing, Super-Admin (tout statut) ; Commercial (création `DRAFT` uniquement — 400 s'il tente un autre statut) | ✅ |
| PATCH/DELETE | `/api/v1/marketing/social-posts/{id}/` | Responsable Marketing, Super-Admin (tout) ; Commercial (lecture de ses propres posts uniquement) | ✅ |
| POST | `/api/v1/marketing/social-posts/{id}/schedule/` | Responsable Marketing, Super-Admin — requiert `scheduled_at` déjà renseigné | ✅ (statut seulement, voir note ci-dessus) |
| POST | `/api/v1/marketing/social-posts/{id}/cancel/` | Responsable Marketing, Super-Admin — uniquement depuis DRAFT/SCHEDULED | ✅ |

### 7.5 Dashboard Marketing ✅ implémenté (version simplifiée)

- **Pipeline commercial pondéré** ✅ — `Sum(estimated_value *
  qualification_score / 100)` sur les leads actifs (NOUVEAU/QUALIFIE/
  PROPOSITION_EN_COURS ; PERDU/CONVERTI exclus). `estimated_value` a été
  **ajouté à `Lead`** (absent du modèle original) — sans valeur monétaire
  il n'y a rien à pondérer ; `Quote.total_ht` serait la source plus
  précise une fois `Quote` construit (§7.2, ⏳).
- **Statistiques réseaux sociaux** ✅ (partiel) — répartition par statut
  et par plateforme (posts `PUBLISHED`) ; pas de répartition par créneau
  horaire (nécessiterait un historique réel de publications, qu'on n'a
  pas tant que le moteur de publication n'existe pas).
- **Cache Redis (TTL 1-2h)** : ⏳ pas encore branché — calcul à la volée
  pour l'instant (le volume actuel ne le justifie pas encore).

| Méthode | Route | Permission | Statut |
|---|---|---|---|
| GET | `/api/v1/marketing/dashboard/` | Responsable Marketing, Super-Admin (complet) ; Commercial/Chef de Projet (lecture limitée à leur périmètre) | ✅ |

---

## 8. Dashboard Global (`dashboard`)

Page d'atterrissage **de tous les employés** à la connexion — zéro donnée
financière/RH sensible, agrégats anonymisés uniquement :

- Projets `EN_COURS`/complétés, tâches validées du mois.
- Nouveaux leads qualifiés de la semaine (**sans** noms/détails de contact).
- Derniers articles publiés / prochaines publications programmées.
- Anniversaires de la semaine, nouveaux arrivants, effectif actif par
  département.
- Annonces globales de la direction (canal de messagerie interne).

**Interdiction stricte** (à faire respecter dans le serializer, pas
seulement en frontend) : aucune jointure vers CA, marges, taux horaires,
salaires, statut de devis, contenu des messages de leads.

**Cache Redis 4h**, purge simple (pas d'invalidation fine — la fraîcheur
n'est pas critique pour ces widgets).

| Méthode | Route | Permission |
|---|---|---|
| GET | `/api/v1/dashboard/global/` | `IsAuthenticated` simple — **tout utilisateur actif rattaché à un département**, sans distinction de rôle |

---

## 9. Correctifs déjà appliqués (socle technique, avant toute feature)

1. ✅ `settings.py` : `SECRET_KEY`/`DEBUG`/`ALLOWED_HOSTS`/`CORS_ALLOWED_ORIGINS`
   lus depuis l'environnement (`.env` local, variables Render en prod).
2. ✅ `firebase_uid` ajouté à `User` ; `FirebaseAuthentication` corrigé (ne
   référence plus un champ `username` inexistant), et lie automatiquement un
   compte pré-provisionné (ex. via `bootstrap_admin`) au premier login réel
   au lieu de créer un doublon.
3. ✅ Firebase Admin SDK initialisé dans `core/apps.py` (`ready()`), via
   `FIREBASE_SERVICE_ACCOUNT_JSON` (Render) ou `GOOGLE_APPLICATION_CREDENTIALS`
   (local/Docker).
4. ✅ `drf-spectacular` branché : `/api/schema/`, `/api/docs/` (Swagger UI),
   `/api/redoc/`.
5. ✅ `whitenoise` + `STORAGES` pour servir les fichiers statiques (admin
   Django) en production.
6. ✅ `Dockerfile` : `gunicorn` + `collectstatic` au build + `entrypoint.sh`
   (migration automatique au démarrage) au lieu du serveur de dev.
7. ✅ `render.yaml` : Blueprint Web Service (Docker) uniquement — ni Postgres
   ni Key Value dedans. `DATABASE_URL` pointe vers Supabase, `REDIS_URL` vers
   Upstash, tous deux en variables manuelles (voir §0).
8. ✅ Bug de syntaxe pré-existant corrigé dans `core/models.py` (apostrophes
   mal échappées dans deux messages de validation — empêchait littéralement
   le démarrage de l'app).
9. ✅ `django-cryptography` (incompatible Django 5.x, `django.utils.baseconv`
   supprimé) remplacé par le fork maintenu **`django-cryptography-django5`**
   — même API, aucun changement de code ailleurs.
10. ✅ `email_hash` (SHA-256 déterministe) ajouté à `User` : l'ancien
    `unique=True` sur `email` (champ chiffré, donc chiffrement non
    déterministe) ne bloquait pas réellement les doublons en base. Vérifié
    par test : une tentative de doublon lève maintenant `IntegrityError`.
11. ✅ `core/admin.py` : `UserAdmin` par défaut de Django cassait (attend un
    champ `username` qui n'existe pas sur notre `User` basé sur `email`) —
    remplacé par un `UserAdmin` adapté.
12. ✅ `django-filter`, `django-redis` ajoutés et branchés (pagination,
    filtrage, cache).
13. ✅ `sokens_backend/celery.py` créé (broker/backend Redis), résout le
    `celery -A sokens_backend` du `docker-compose.yml`.
14. ✅ Commande `python manage.py bootstrap_admin --email ...` — crée ou
    promeut le premier Super-Administrateur (pas d'auto-inscription publique
    par design, voir §3.1).
15. ✅ Première route réelle : `GET`/`PATCH /api/v1/auth/me/` (profil courant,
    écriture limitée aux champs auto-éditables). Testée (`core/tests.py`,
    3 tests, `force_authenticate` — pas de dépendance réseau Firebase).
    A aussi révélé et corrigé un bug DRF : sans jeton, l'API renvoyait `403`
    au lieu de `401` (`FirebaseAuthentication.authenticate_header()` manquant).
16. ✅ App `projects` créée : modèles `Project`/`ProjectMember`, endpoints
    `GET/POST /api/v1/projects/`, `GET/PATCH/DELETE /api/v1/projects/{id}/`,
    `POST /api/v1/projects/{id}/members/`,
    `DELETE /api/v1/projects/{id}/members/{membership_id}/`. Permissions via
    `core.permissions.has_role()`.
17. ✅ **Pivot identité** : Firestore (`profiles/{uid}.role`) devient la
    source de vérité du rôle applicatif — `core.Role`/`User.roles` (M2M)
    supprimés. `FirebaseAuthentication` récupère le rôle Firestore à chaque
    requête (`core/firestore_client.py`) et l'attache à `request.user`
    (transitoire, jamais persisté) ; `has_role()` le lit directement.
    Répartition finale : Firestore = identité/rôle/chat/notifications ;
    Django/Supabase = RH/Finance/Projets (voir `README.md`).
18. ✅ App `hr` créée : `EmployeeProfile` (calcul auto de
    `base_hourly_cost`), `Contract`, `Payslip`. `Responsable RH` = CRUD
    complet, collaborateur standard = lecture seule de son propre dossier
    (salaire masqué). Endpoints `core` ajoutés : `DepartmentViewSet`
    (Super-Admin), `UserListView` (lecture seule, Super-Admin/RH).
19. ✅ App `marketing` créée (premier module) : `Lead`, ingestion publique
    `POST /api/v1/public/leads/` (rate limiting Redis 3/IP/min — reCAPTCHA
    ⏳ pas de clé), `GET/POST/PATCH /api/v1/marketing/leads/` (Responsable
    Marketing = tout, Commercial = ses leads assignés uniquement).
    30 tests au total dans le repo, tous passants.
20. ✅ Swagger réorganisé par tags de département (Système /
    Authentification / Administration & RH / Technique & Projets /
    Marketing & Commercial) + `OpenApiAuthenticationExtension` pour le
    bouton "Authorize" (Bearer/Firebase ID token).
21. ✅ Provisioning de compte complet (`POST /api/v1/users/provision/` —
    Firebase Auth + profil Firestore + `User` Django en un appel, avec
    rollback si une étape échoue après la création Firebase),
    changement de rôle d'un utilisateur existant
    (`PATCH /api/v1/users/{id}/role/`, Super-Admin uniquement), et lecture
    de l'`AuditLog` (`GET /api/v1/audit-logs/`, Super-Admin uniquement).
    Frontend : assistant de création d'employé en 3 étapes (Identité →
    Accès plateforme → Infos RH) dans une modal "slide-in" depuis la
    droite (`components/ui/sheet.tsx`, wrap de `@base-ui/react` Dialog).
    Zone de contenu `/admin` passée en thème clair (fond blanc), sidebar
    inchangée (tokens `--sidebar-*` déjà indépendants du thème principal).
    Gestion documentaire (upload fiches de paie/contrats sur Google Drive)
    toujours ⏳ — seul le collage manuel de lien `file_url` existe.
22. ✅ Sidebar admin restructurée par département — n'affiche que des
    écrans réellement fonctionnels (retrait des placeholders Projets/
    Finance/Messagerie, sans backend ni écran). 3 nouveaux écrans :
    **Utilisateurs & Rôles** (`/admin/rh/utilisateurs`, Super-Admin —
    fusionne `GET /api/v1/users/` (Django) et la collection Firestore
    `profiles` par email pour afficher/éditer rôle + département de
    chaque compte), **Audit Log** (`/admin/rh/audit-log`, Super-Admin,
    lecture seule), **Leads** (`/admin/marketing/leads/`, Responsable
    Marketing/Commercial — qualification, score, réassignation).
    `core.views.CanListUsers` (nouvelle permission) élargit
    `GET /api/v1/users/` à Responsable Marketing (lecture seule,
    nécessaire pour réassigner un lead à un Commercial).
23. ✅ Département Technique complété (Timesheets, Décaissements N1,
    écran Gestion de projet), **Messagerie temps réel** ajoutée (hors §1-9
    d'origine — chat vit entièrement dans Firestore `chatRooms/*`, Django
    ne fait que pousser salons/membres via l'Admin SDK à la création d'un
    Département/Projet, voir §5.2), puis **Département Comptabilité &
    Finance complété** (§6, réécrit ci-dessus pour refléter le code réel
    plutôt que le brouillon initial) : Clôture comptable, Grand Livre
    (écritures équilibrées, période verrouillable), Facturation (validation
    → écriture auto), Rapprochement bancaire (import + lettrage manuel),
    TVA (génération + signature CFO), export FEC simplifié, Décaissements
    étendu à l'approbation (N2/N3) et l'exécution. 112 tests au total dans
    le repo, tous passants.

---

## 10. Conventions API (transverses à tout le backend)

- **Préfixe** : `/api/v1/...`. Espace de nommage public non-authentifié :
  `/api/v1/public/...` (leads, tracking de devis, lecture CMS).
- **Pagination** : `PageNumberPagination` DRF par défaut (`page`,
  `page_size`), sauf endpoints d'export (FEC, SAGE/CIEL — non paginés,
  fichier complet).
- **Filtrage** : `django-filter` (déjà branché en `DEFAULT_FILTER_BACKENDS`)
  pour les listes volumineuses (`Lead`, `TransactionLine`, `SocialPost`).
- **Format d'erreur** : structure DRF standard
  `{"detail": "...", "code": "..."}` ; pas de format custom sauf validation
  multi-champs (`{"field": ["message"]}`, déjà le comportement DRF natif).
- **Audit** : toute mutation sur les modules Comptabilité, RH et
  Réseaux Sociaux écrit dans `AuditLog` (via `AuditLog.objects.log_action(...)`,
  déjà existant). Pas de PUT/PATCH/DELETE sur `AuditLog` lui-même — jamais.
- **Swagger** : chaque nouvelle vue DRF doit avoir une docstring claire et,
  si besoin, `@extend_schema(...)` (`drf-spectacular`) pour documenter les
  cas non triviaux (upload CSV, endpoints d'action `/convert/`, `/send/`,
  etc.) — le Swagger généré est ce que l'équipe (et potentiellement des
  intégrateurs externes SAGE/CIEL) consultera en premier.

---

## 11. Matrice RBAC consolidée

| Rôle | Leads | Devis | CMS | Réseaux Sociaux | RH (profils/contrats) | Projets/Timesheets | Comptabilité | Dashboards |
|---|---|---|---|---|---|---|---|---|
| **Super-Administrateur** | CRUD complet | CRUD complet | CRUD complet | CRUD complet | CRUD complet + rôles/permissions | CRUD complet | CRUD complet + clôture exercice | Tous, complets |
| **Responsable RH** | — | — | — | — | CRUD complet (hors rôles/permissions) | — | — | Global |
| **Responsable Marketing** | CRUD complet | CRUD complet | CRUD complet | CRUD complet (planif + publication) | — | Lecture | — | Marketing complet, Global |
| **Commercial** | Ses leads uniquement | Ses devis (création + envoi) | Lecture seule | Proposition (`DRAFT` uniquement) | Son profil (lecture) | — | — | Limité à son périmètre, Global |
| **Chef de Projet** | Lecture seule | Collaboration technique | Lecture seule | Lecture seule | Son profil (lecture) | CRUD sur ses projets, validation timesheets équipe | Décaissements N1 (ses projets) | Projets propres, Global |
| **Développeur/Ingénieur** | — | — | — | — | Son profil (lecture) | Timesheets (les siennes), messagerie projet | — | Global |
| **Directeur Financier (CFO)** | Lecture seule | Validation prix/remises | Lecture seule | Lecture seule | Son profil (lecture) | Lecture | Complet + clôture exercice + validation N2/N3 + TVA | Finance complet, Global |
| **Comptable** | — | Lecture (conversion facture) | Lecture seule | Lecture seule | Son profil (lecture) | Lecture | Écritures, factures, rapprochement, TVA (brouillon), exécution décaissements | Finance opérationnel, Global |
| **Stagiaires / Invités / Autres** | — | — | — | — | Son profil (lecture) | — | — | Global uniquement |

**Règles absolues (jamais d'exception, même Super-Admin)** :
- `BankStatementLine.is_reconciled = True` → ligne définitivement figée
  (aucun rôle ne peut la modifier/supprimer ensuite).
- `AuditLog` → aucun endpoint PUT/PATCH/DELETE n'existe, point final.
- Dashboard Global → zéro donnée financière/RH nominative, quel que soit le
  rôle du lecteur (ce n'est pas une question de permission mais d'absence
  totale de la donnée dans le serializer).

---

## 12. Ordre d'implémentation proposé (feature par feature)

Séquence logique — chaque étape est testable/démontrable seule avant de
passer à la suivante :

1. **Finaliser le socle** — corriger `django-cryptography`, générer et
   appliquer la première migration, vérifier `/api/docs/` en local.
2. **Authentification & `/auth/me/`** — première route protégée réelle,
   valide tout le pipeline Firebase → `User`.
3. **Administration/RH** — `User`/`Role`/`Department` déjà là ;
   ajouter `EmployeeProfile`/`Contract`. Nécessaire pour peupler des comptes
   de test pour la suite.
4. **CMS (lecture publique)** — bas risque, réutilise directement le contenu
   déjà en dur côté frontend (`lib/blog/posts.ts`, `lib/projects/projects.ts`) ;
   bonne validation de bout en bout frontend ↔ backend.
5. **Leads** — formulaire public déjà existant côté frontend
   (`/demarrer-un-projet`) à brancher sur `POST /api/v1/public/leads/`.
6. **Devis & Facturation** — dépend de Leads + Comptabilité (comptes de base
   à seed).
7. **Comptabilité cœur** (plan comptable, écritures, verrouillage
   d'exercice) — fondation pour décaissements, TVA, rapports.
8. **Décaissements & Rapprochement bancaire**.
9. **Réseaux sociaux & plan éditorial** — le plus dépendant de Celery Beat,
   à faire quand l'infra async est déjà rodée sur les étapes précédentes.
10. **Dashboards** (Finance, Marketing, Global) — en dernier, car ils
    agrègent tout ce qui précède.

---

## 13. Ce qu'il reste à clarifier avec toi

- **Département Technique/Projets** (§5) : je n'ai que des références
  croisées, pas la spec complète comme pour Comptabilité/Marketing. À détailler
  avant de le coder (surtout `Project`/`Timesheet`/messagerie).
- **`ClientAccount`** est référencé partout (Lead, Quote, Invoice) mais
  jamais spécifié en détail — je le déduis comme faisant partie du module
  Admin/RH ou d'un module `clients` séparé. À confirmer.
- **Seuils de validation hiérarchique** des décaissements (montants
  déclenchant N1/N2/N3) : pas de valeur donnée, à définir.
- **Intégrations réseaux sociaux réelles** (LinkedIn/Facebook/etc.) :
  nécessitent des credentials API tierces par plateforme — à obtenir avant
  l'étape 9.
- **Déploiement réel** : comptes Render/Firebase/Vercel obtenus par
  l'équipe — je n'ai pas d'accès direct à ces dashboards (pas de navigateur
  authentifié dans cet environnement), donc la création du projet Supabase,
  du service Render et du déploiement Vercel se fait main dans la main :
  vous cliquez, je vérifie/teste chaque URL dès qu'elle existe.
