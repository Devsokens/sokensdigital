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

**`Timesheet`**
- `id` (UUID), `project` (FK), `user` (FK), `date`, `hours` (Decimal),
  `description`, `status` (Enum : SOUMIS, VALIDE, REJETE)

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
| GET/POST | `/api/v1/projects/{id}/timesheets/` | Feuilles de temps du projet | Équipe assignée (soumission), Chef de Projet (validation) | ⏳ |
| POST | `/api/v1/projects/{id}/timesheets/{ts_id}/validate/` | Validation d'une feuille de temps | Chef de Projet du projet | ⏳ |
| GET/POST | `/api/v1/projects/{id}/messages/` | Messagerie du projet | Équipe assignée + Chef de Projet | ⏳ |

**Dépendance croisée** : `finance.DisbursementRequest` référence
`projects.Project` (un Chef de Projet ne peut initier une demande que pour
ses propres projets — filtre `project__lead_project_manager=request.user` ou
`request.user in project.team_members`).

---

## 6. Département Comptabilité & Finance (`finance`)

### 6.1 Plan Comptable & Écritures (partie double, OHADA)

**`Account`** — `id` (UUID), `code` (max 10, unique, indexé), `name`,
`account_type` (Enum ACTIF/PASSIF/CHARGE/PRODUIT), `parent` (FK récursive),
`is_active`, `is_system` (bloque la suppression si `True`).

**`JournalEntry`** — `id` (UUID), `entry_number` (unique, séquentiel
`JO-{annee}-{seq:05d}`), `accounting_date`, `journal_code` (Enum
VT/ACH/BQ/OD), `description`, `content_type`/`object_id` (`GenericForeignKey`
vers `Invoice`, `ExpenseReport` ou `DisbursementRequest`).

**`TransactionLine`** — `id` (UUID), `journal_entry` (FK,
`related_name='lines'`, `CASCADE`), `account` (FK), `debit`/`credit`
(Decimal 12,2, défaut 0.00), `description`, `reconciled` (bool).

**Règle d'or (validateur serializer ou `clean()`)** : rejet si
`sum(lines.debit) != sum(lines.credit)` pour une même `JournalEntry` —
implémenté comme validation **transactionnelle** (toutes les lignes créées
dans un seul appel API atomique, pas de PATCH partiel qui casserait
l'équilibre).

**Déclencheurs automatiques (signaux + Celery)** :
- Facture émise (`Invoice.status → EMISE`) → écriture Client (411) / Produit
  (701) / TVA collectée (443).
- Note de frais validée → écriture Charge (61/62) / Tiers (467).
- Décaissement exécuté (`DisbursementRequest.status → EXECUTE`) → écriture
  Tiers/Charge / Banque (521).
- Lettrage bancaire validé → écriture de virement/banque, ligne figée.

**Verrouillage d'exercice** : validateur/middleware qui rejette tout
POST/PUT/DELETE sur `TransactionLine` si `accounting_date` appartient à une
période dont l'exercice (`FiscalYear`, à créer) est `status = CLOS`.

### 6.2 Devis & Facturation

`Quote`/`QuoteLine` : propriété du module **Marketing** (voir §7.2) —
Comptabilité y accède en lecture pour validation des prix.

**`Invoice`** — `id` (UUID), `quote` (FK, null=True — facture peut naître
sans devis préalable), `client` (FK → `ClientAccount`), `invoice_number`
(unique, séquentiel), `status` (Enum BROUILLON/EMISE/PAYEE/EN_RETARD),
`total_ht`, `total_ttc`, `due_date`.

**`InvoiceLine`** — mêmes principes que `QuoteLine` (copiées depuis le devis
à la conversion).

**Flux de conversion** : `POST /api/v1/finance/quotes/{id}/convert/` copie
les lignes du `Quote` accepté vers un nouvel `Invoice` (BROUILLON). Le
passage à `EMISE` : scelle la facture (lecture seule sauf statut), génère le
PDF (Google Drive), déclenche l'écriture comptable via tâche Celery
asynchrone.

**Relances** : tâche Celery Beat quotidienne — factures `EMISE` avec
`due_date` dépassée → email de relance + statut `EN_RETARD`.

### 6.3 Décaissements

**`DisbursementRequest`** — `id` (UUID), `project` (FK →
`projects.Project`, nullable pour les décaissements non liés à un projet),
`amount` (Decimal FCFA), `beneficiary`, `reason`, `status` (Enum
ATTENTE_N1/ATTENTE_N2/APPROUVE/REJETE/EXECUTE).

**Validation hiérarchique** (seuils à définir en config, ex. `Role.permissions`
ou table `ApprovalThreshold` dédiée) :
- **N1** (initiation) : Chef de Projet / Commercial concerné.
- **N2/N3** (approbation stratégique) : Directeur Financier, Super-Admin.
- **Exécution** : Comptable, Directeur Financier → déclenche l'écriture
  comptable automatique.

### 6.4 Rapprochement bancaire (sans API bancaire directe)

**`BankStatementLine`** — `id` (UUID), `bank_account` (Chaîne), `operation_date`,
`label`, `amount` (signé), `is_reconciled` (bool, défaut False),
`content_type`/`object_id` (`matched_to`, vers `Invoice` ou dépense).

| Méthode | Route | Description |
|---|---|---|
| POST | `/api/v1/finance/bank-statement/import/` | Import CSV (`date,libelle,montant`), validation stricte du format |
| GET | `/api/v1/finance/bank-statement/suggestions/` | Moteur de suggestion (montant + libellé ≈ client) |
| POST | `/api/v1/finance/bank-statement/{id}/reconcile/` | Valide le lettrage → écriture comptable → **verrouillage définitif** (PUT/DELETE bloqués ensuite, pour **tous** les rôles, y compris Super-Admin) |

### 6.5 Déclarations fiscales & TVA

**`TaxDeclaration`** — `id` (UUID), `period` (`MM-YYYY`), `collected_tva`,
`deductible_tva`, `tax_to_pay`, `status` (Enum BROUILLON/VALIDE).

Pré-remplissage par agrégation (`Sum` Django ORM) sur les comptes 443/445 de
la période. Génération d'un état exportable imitant la liasse fiscale.

| Méthode | Route | Permission |
|---|---|---|
| GET/POST | `/api/v1/finance/tax-declarations/` | Comptable (création BROUILLON) |
| POST | `/api/v1/finance/tax-declarations/{id}/validate/` | Directeur Financier uniquement |

### 6.6 Rapports & Tableau de bord Finance

- **Vue matérialisée PostgreSQL** : chiffre d'affaires, trésorerie nette,
  encours clients (`REFRESH MATERIALIZED VIEW` déclenché par signal ou tâche
  Celery périodique).
- **Cache Redis** sur `/api/v1/finance/dashboard/`, TTL 1–2h, invalidé sur
  signal (facture de gros montant, lettrage validé).

| Méthode | Route | Permission |
|---|---|---|
| GET | `/api/v1/finance/dashboard/` | Comptable (rapports opérationnels), CFO (accès complet stratégique) |
| GET | `/api/v1/finance/reports/general-ledger/` | Grand livre | Comptable, CFO |
| GET | `/api/v1/finance/reports/fec/` | Export FEC (texte plat, UTF-8, chronologique, non altérable) | Comptable, CFO |
| GET | `/api/v1/finance/reports/export/{format}/` | Export SAGE/CIEL (CSV/JSON structuré) | Comptable, CFO |

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

### 7.2 Devis (source de vérité — voir réconciliation §2)

**`Quote`** — `id` (UUID), `lead` (FK, null=True), `client` (FK, null=True),
`quote_number` (unique, `DEV-{annee}-{seq:05d}`), `issue_date`, `expiry_date`,
`status` (Enum BROUILLON/ENVOYE/ACCEPTE/REFUSE), `discount_amount`,
`total_ht`, `total_ttc`, `tracking_token` (UUID, généré crypto), `opened_at`,
`signed_at`.

**`QuoteLine`** — `id` (UUID), `quote` (FK, `related_name='lines'`,
`CASCADE`), `service_title`, `quantity`, `unit_price`, `total_line`
(recalculé côté serveur à chaque `save()`, jamais fait confiance côté
client).

**Verrouillage & versionnage** : `ENVOYE`/`ACCEPTE`/`REFUSE` → lecture seule ;
toute modification passe par `POST /clone/` (nouvelle version incrémentée
`-V2`).

| Méthode | Route | Description | Permission |
|---|---|---|---|
| GET/POST | `/api/v1/marketing/quotes/` | Liste / création (BROUILLON) | Commercial (les siens), Chef de Projet (collaboration technique), Super-Admin |
| PATCH | `/api/v1/marketing/quotes/{id}/` | Édition (BROUILLON uniquement) | Idem + validation prix par CFO |
| POST | `/api/v1/marketing/quotes/{id}/send/` | Passage à `ENVOYE`, génération PDF, email avec lien de tracking | Commercial propriétaire, Super-Admin |
| POST | `/api/v1/marketing/quotes/{id}/clone/` | Nouvelle version | Idem |
| GET | `/api/v1/public/quotes/track/{tracking_token}/` | Consultation publique par le client, enregistre `opened_at` | **Public** (token = auth) |

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

### 7.4 Publications Réseaux Sociaux & Plan Éditorial

**`SocialPost`** (modèle donné intégralement dans la spec source — repris
tel quel) : `title`, `content`, `image_path`, `additional_images` (JSON),
`platform` (Enum LINKEDIN/TWITTER/FACEBOOK/INSTAGRAM/YOUTUBE),
`scheduled_at`, `status` (Enum DRAFT/SCHEDULED/PUBLISHED/FAILED/CANCELLED),
`published_at`, `post_url`, `author` (FK), `notes`, `tags` (JSON).

**Validation par plateforme** (serializer) : ex. `TWITTER` → `content` ≤ 280
caractères ; `INSTAGRAM` → `image_path` obligatoire.

**Moteur de publication** : Celery Beat, cron chaque minute —
`SocialPost.objects.filter(status='SCHEDULED', scheduled_at__lte=now())` →
appel API externe (LinkedIn/Facebook Graph/etc.) → `PUBLISHED` +
`published_at` + `post_url`, ou `FAILED` si rejet.

**Rappels J-3h/J-2h/J-1h** : au passage à `SCHEDULED`, 3 tâches Celery
`countdown` sont planifiées. **Règle de sécurité critique** : au déclenchement,
le worker **re-vérifie** `status == 'SCHEDULED'` en base avant d'notifier —
sinon la tâche s'arrête silencieusement (annulation/report gérés
naturellement, pas de nettoyage de tâches à faire).

**Passerelle CMS → Réseaux sociaux** : `BlogPost.status → PUBLIE` peut
générer un `SocialPost` en `DRAFT` pré-rempli (titre + extrait + lien).

| Méthode | Route | Permission |
|---|---|---|
| GET/POST | `/api/v1/marketing/social-posts/` | Responsable Marketing, Super-Admin (tout statut) ; Commercial (création `DRAFT` uniquement — 400 s'il tente `SCHEDULED`) |
| PATCH | `/api/v1/marketing/social-posts/{id}/` | Idem |
| POST | `/api/v1/marketing/social-posts/{id}/schedule/` | Passage à `SCHEDULED`, déclenche les 3 rappels | Responsable Marketing, Super-Admin |
| POST | `/api/v1/marketing/social-posts/{id}/cancel/` | Annulation | Responsable Marketing, Super-Admin |

### 7.5 Dashboard Marketing

- Pipeline commercial pondéré (`Sum(valeur_estimee * probabilite_conversion)`
  par lead qualifié).
- Statistiques réseaux sociaux (`PUBLISHED`, groupées par plateforme et
  créneau horaire).
- Vues matérialisées + cache Redis (TTL 1–2h), purge sur signature de devis.

| Méthode | Route | Permission |
|---|---|---|
| GET | `/api/v1/marketing/dashboard/` | Responsable Marketing, Super-Admin (complet) ; Commercial/Chef de Projet (lecture limitée à leur périmètre) |

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
