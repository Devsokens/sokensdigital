# Plan de développement — Soken's Digital
**Périmètre : sections Techniques & Administration — branches `Herbert_technique` et `Herbert-_administration`**

---

## 1. Contexte général du projet

**Soken's Digital** est une application web destinée à servir de **portail d'entreprise** pour une société de solutions digitales sur mesure. Elle comporte deux grands espaces :

| Espace | Rôle |
|---|---|
| **Portail public** | Vitrine (services, portfolio, blog, formulaire de devis, contact) — sans authentification |
| **Espace administratif** | Outil interne sécurisé qui centralise comptabilité, CRM, projets, RH, communication — accessible aux collaborateurs authentifiés selon leur rôle |

L'espace administratif est structuré en **4 départements métier** : Comptabilité/Fiscalité, Administration, Techniques, Marketing/Communication — chacun avec son tableau de bord, son canal de messagerie et ses fonctionnalités propres.

**Stack technique retenue :**
- Frontend : Next.js 15 (App Router), TypeScript, Tailwind, Shadcn/ui
- Backend : Django 5 + Django REST Framework, Python 3.12+, Celery + Redis
- Données : PostgreSQL (métier, hébergé sur Render) + Firestore (temps réel : messagerie, notifications)
- Authentification : JWT Django, avec **Firebase Authentication privilégié en complément** (MFA, social login)
- Stockage fichiers : Google Drive (abstrait — jamais de binaire en base, seulement un `file_path`/ID)
- Hébergement : Vercel (frontend), Render (backend + PostgreSQL + Redis), Firebase (auth/Firestore/FCM)

> ⚠️ **Point à clarifier avec l'équipe** : le cahier des charges décrit un pipeline CI/CD **GitLab**, alors que le dépôt fourni est hébergé sur **GitHub** (`taigerdev45/sokensdigital`). Il faudra confirmer si le pipeline sera reconstruit en GitHub Actions ou si un miroir GitLab est prévu. Cela n'empêche pas de commencer le développement.

---

## 2. Ce que tu es censé faire, concrètement

Tu es responsable du **développement backend (modèles Django + API DRF + logique métier + permissions)** des modules suivants :

- **Département Techniques** (fiches projets, phases, tâches, temps passés, support technique)
- **Département Administration** (CRM clients, documents, contrats, RH, congés/actifs, registre administratif)

Concrètement, pour chaque fonctionnalité listée plus bas, il faut :
1. Créer le **modèle Django** (champs, relations, contraintes) — il existe déjà un schéma SQL de référence (`schemade_db_SD.sql`) à respecter/adapter en modèles Django.
2. Écrire les **serializers DRF** avec les validations métier.
3. Écrire les **vues/ViewSets** exposant les endpoints REST (`/api/v1/...`).
4. Implémenter la **logique métier** (signaux `post_save`, calculs automatiques, contraintes).
5. Appliquer le **contrôle d'accès (RBAC)** exact défini dans la matrice des rôles.
6. Écrire les **tests** (Pytest, couverture visée > 80 %).
7. Documenter l'API (Swagger/OpenAPI auto-généré à partir des serializers).

---

## 3. Comment récupérer le code sur Git

### 3.1 Cloner le dépôt
```bash
git clone https://github.com/taigerdev45/sokensdigital.git
cd sokensdigital
```

### 3.2 Lister les branches distantes
```bash
git fetch --all
git branch -r
```
Tu dois voir apparaître : `main`, `Edy_compta&fisc`, `Edy_markting&com`, `Herbert_technique`, `Herbert-_administration`.

### 3.3 Basculer sur ta branche technique
```bash
git checkout Herbert_technique
# si la branche n'existe pas encore en local :
git checkout -b Herbert_technique origin/Herbert_technique
git pull origin Herbert_technique
```

### 3.4 Basculer sur ta branche administration
```bash
git checkout Herbert-_administration
git pull origin Herbert-_administration
```
⚠️ Comme tu portes deux périmètres fonctionnels distincts, évite de mélanger le code Technique et Administration dans la même branche/commit : garde chaque module dans sa branche dédiée pour faciliter la revue et la fusion.

### 3.5 Cycle de travail habituel
```bash
git status                     # vérifier l'état
git add <fichiers modifiés>
git commit -m "feat(technique): ajoute le modèle Task avec workflow Kanban"
git push origin Herbert_technique
```
Le cahier des charges recommande la convention **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`...) pour générer automatiquement le changelog.

### 3.6 Avant de fusionner
- Ouvre une **Pull Request** vers `main` (ou vers `develop` si l'équipe en crée une — à confirmer, le cahier des charges prévoit un modèle GitFlow avec branche `develop`).
- Demande une revue à au moins un pair avant fusion.
- Assure-toi que les tests passent localement avant de pousser.

### 3.7 Mise en place de l'environnement local
Une fois le dépôt cloné, cherche à la racine :
- Un `docker-compose.yml` (environnement local prévu : frontend + backend + PostgreSQL + Redis)
- Un fichier `.env.example` à dupliquer en `.env`
- Un `requirements.txt` / `pyproject.toml` côté backend

```bash
docker compose up -d          # si docker-compose.yml présent
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```
Si ces fichiers n'existent pas encore dans le dépôt, c'est probablement à toi/l'équipe de les créer en Phase 1 (Fondations).

---

## 4. Section TECHNIQUES — ce qu'il faut développer

Référence : cahier des charges point 3, matrice des rôles section 3.

### 4.1 Fiche Projet — modèle `Project`
| Élément | Détail |
|---|---|
| Champs clés | `id`, `client_id` (FK obligatoire), `name`, `description`, `budget`, `cost_rate`, `start_date`, `end_date`, `actual_end_date`, `project_manager_id`, `status` |
| Statuts | PROSPECTION → DEVIS_ENVOYE → NEGOCIATION → EN_COURS → EN_RECETTE → LIVRE → CLOS |
| Logique métier | 1) Chaque changement de `status` crée une entrée `AuditLog`. 2) À l'affichage, calculer `Σ(actual_hours des tâches) × cost_rate` et lever une alerte UI si le résultat dépasse `budget`. 3) Passage à CLOS/LIVRE → injecte automatiquement `actual_end_date`. |
| Accès | Lecture : Admin, Directeur Financier, Chef de Projet, Développeurs assignés. Écriture : Super-Admin, Admin, `project_manager_id` du projet. Un développeur **ne peut jamais** modifier `budget` ou `cost_rate`. |

### 4.2 Phases et Jalons — modèles `ProjectPhase`, `ProjectDocument`
| Élément | Détail |
|---|---|
| Champs clés | `ProjectPhase` : `project_id` (CASCADE), `name`, `description`, `order`, `start_date`, `end_date`, `status` (A_FAIRE / EN_COURS / TERMINE). `ProjectDocument` : `id`, `name`, `file_path` (Google Drive), `document_type`, `uploaded_by` |
| Logique métier | 1) Toujours trier par `order`. 2) Une phase ne peut passer à TERMINE que si **au moins un** document `document_type="LIVRABLE"` est attaché. 3) Validation serializer : `end_date` de phase ≤ `end_date` du projet parent. |
| Accès | Lecture : tout utilisateur ayant accès au projet parent. Écriture (création/édition de phase) : Super-Admin, Admin, Chef de Projet responsable. Les développeurs ne peuvent qu'ajouter des documents de recette liés à leur tâche. |

### 4.3 Gestion des tâches — modèle `Task`
| Élément | Détail |
|---|---|
| Champs clés | `project_id`, `phase_id` (optionnel), `name`, `description`, `assigned_to`, `status` (BACKLOG/TODO/IN_PROGRESS/REVIEW/DONE), `priority`, `estimated_hours`, `actual_hours` (calculé), `due_date`, `completed_at` |
| Logique métier | 1) Passage à IN_PROGRESS → bascule la phase parente de A_FAIRE vers EN_COURS si besoin. 2) Passage à DONE → renseigne `completed_at` automatiquement. 3) Changement de `assigned_to` → signal `post_save` qui crée une `Notification` + push in-app. |
| Accès | Lecture : Développeurs, Chef de Projet, Admin. Écriture (création/assignation) : Chef de Projet, Admin. Mise à jour du **champ `status` uniquement** : le développeur assigné (PATCH partiel). |

### 4.4 Suivi des temps passés — modèle `TimeEntry`
| Élément | Détail |
|---|---|
| Champs clés | `task_id`, `user_id`, `hours`, `date`, `description` (obligatoire), `created_at` |
| Logique métier | 1) Interdiction d'une date future. 2) Somme des `hours` d'un même `user_id` sur une même `date` ≤ 24h, sinon HTTP 400. 3) Chaque POST/DELETE réussi recalcule `Task.actual_hours = Σ TimeEntry.hours`. |
| Accès | Création/édition : uniquement le propriétaire (`user_id == request.user`) — jamais les entrées d'un pair. Lecture complète (reporting) : Chef de Projet (ses projets), Directeur Financier, Admin (toute l'entreprise). |

### 4.5 Support technique — modèles `Ticket`, `KnowledgeBase`
| Élément | Détail |
|---|---|
| Champs clés | `Ticket` : `client_id`, `project_id`, `title`, `description`, `status` (NEW/ASSIGNED/RESOLVED/CLOSED), `severity`, `assigned_developer_id`. `KnowledgeBase` : `title`, `content` (HTML), `tags` (array), `created_by` |
| Logique métier | 1) Recherche full-text (index Postgres) sur `title`/`content`. 2) Passage à RESOLVED → email de confirmation client ; sans réponse sous 48h, tâche Celery planifiée bascule le ticket en CLOSED. |
| Accès | Tickets : modification par Support Client, Chef de Projet, Admin, développeur assigné. Autres développeurs : lecture seule si le ticket concerne leur projet. Base de connaissances : lecture large (département technique + clients autorisés) ; écriture réservée à Consultants, Chefs de Projet, Admin. |

### 4.6 Transverse — Chef de Projet & Développeur (matrice des rôles)
- **Chef de Projet** : peut aussi initier des `DisbursementRequest` liées à ses projets (niveau N1), consulter/collaborer sur les `Quote` en cours de rédaction (validation faisabilité technique), et gère l'accès complet aux canaux du projet.
- **Développeur** : aucun accès aux données financières globales, aux marges de projet, ni au CMS — à faire respecter strictement côté permissions DRF.

---

## 5. Section ADMINISTRATION — ce qu'il faut développer

Référence : cahier des charges point 2 (version révisée), matrice des rôles section 1.

### 5.1 CRM Clients — modèle `Client`
| Élément | Détail |
|---|---|
| Champs clés | `id`, `company_name`, `siret` (unique), `sector`, `address/city/postal_code/country`, `email`, `phone`, `website`, `status` (PROSPECT/CLIENT_ACTIF/CLIENT_INACTIF/ARCHIVE), `rating`, `notes`, `assigned_to` |
| Logique métier | Création automatique en statut PROSPECT lors d'une demande de devis publique. Validation stricte email + unicité SIRET (serializer). Log d'audit sur les changements de statut critiques. |
| Accès | Lecture : Admin, Commerciaux/Marketing, Directeur Financier, Chef de Projet (clients liés à ses projets). Écriture : Admin + Commercial `assigned_to`. Suppression interdite (ARCHIVE réservé au Super-Admin). |

### 5.2 Historique des interactions — modèle `ClientInteraction`
| Élément | Détail |
|---|---|
| Champs clés | `client_id`, `contact_id`, `user_id`, `type` (CALL/EMAIL/MEETING), `subject`, `notes`, `follow_up_date` |
| Logique métier | Tri antéchronologique (`-created_at`). Relances Celery automatiques si `follow_up_date` atteinte. **Verrouillage des modifications après 24h.** |
| Accès | Lecture large (Administration, Commerciaux, Chefs de Projet concernés). Création : tout utilisateur ayant interagi avec le client. |

### 5.3 Gestion documentaire clients — modèle `ClientDocument`
| Élément | Détail |
|---|---|
| Champs clés | `client_id`, `name`, `file_path` (Google Drive), `file_type` (CONTRAT/DEVIS/FACTURE/AUTRE_JURIDIQUE), `uploaded_by` |
| Logique métier | Jamais de fichier binaire en base. Liaison automatique lors de la conversion Devis → Facture. Chiffrement AES-256 au repos pour les documents sensibles. |
| Accès | Lecture : Admin, Directeur Financier, Commerciaux (contrats juridiques masqués aux autres rôles). Écriture : Admin + Directeur Financier ; Commerciaux limités aux DEVIS. |

### 5.4 Générateur de contrats & signature électronique — modèle `ContractGenerator`
| Élément | Détail |
|---|---|
| Champs clés | `client_id`/`employee_id` (optionnels), `contract_type` (PRESTATION_SERVICES/NDA/CDI/CDD), `generated_file_path`, `signing_status` (BROUILLON/EN_ATTENTE_DE_SIGNATURE/SIGNE/EXPIRE), `envelope_id`, `signed_at` |
| Logique métier | Publipostage : template HTML → variables → PDF → upload Drive. Webhook sécurisé `/api/v1/public/webhooks/signature/` pour mise à jour du statut. **Verrouillage** après passage à EN_ATTENTE_DE_SIGNATURE (toute modif = nouveau contrat). |
| Accès | Création : Admin (tous types) + Commerciaux (NDA et PRESTATION_SERVICES uniquement). Lecture : Admin, Directeur Financier, Commerciaux (leurs clients). Modification/suppression bloquées après EN_ATTENTE_DE_SIGNATURE. |

### 5.5 Ressources Humaines — extension `User` + `EmployeeDocument`
| Élément | Détail |
|---|---|
| Champs clés | `EmployeeDocument` : `user_id`, `document_name`, `file_path` (Drive), `expiry_date` |
| Logique métier | Chiffrement AES-256 des métadonnées sensibles. Alerte automatique (notif + email) 30 jours avant expiration. Réception/stockage sécurisé des fiches de paie générées par le module externe (voir 5.8). |
| Accès (très strict) | Accès complet : Super-Admin + Admin RH. Accès personnel : lecture seule de son propre dossier (`request.user == user_id`). Toute tentative hors périmètre → **403 Forbidden**. |

### 5.6 Congés & Actifs — modèles `LeaveRequest`, `CompanyAsset`
| Élément | Détail |
|---|---|
| Champs clés | `LeaveRequest` : `user_id`, `leave_type` (CONGE_PAYE/MALADIE/SANS_SOLDE), `start_date`, `end_date`, `status` (BROUILLON/EN_ATTENTE/APPROUVE/REJETE). `CompanyAsset` : `asset_name`, `serial_number` (unique), `current_holder_id`, `condition_status` |
| Logique métier | Bloquer la création si `start_date > end_date` ou chevauchement de dates pour le même utilisateur. Historisation automatique de chaque changement de détenteur de matériel dans une table d'audit. |
| Accès | Congés : soumission par l'employé concerné ; validation/refus exclusif au pôle Administration. Actifs : consultation libre ; création/modification/assignation réservées aux Admin. |

### 5.7 Registre des Procès-Verbaux et Décisions — modèle `AdministrativeRecord`
| Élément | Détail |
|---|---|
| Champs clés | `title`, `record_type` (PV_ASSEMBLEE/NOTE_SERVICE/DECISION_DIRECTION), `event_date`, `file_path`, `is_public_internally` |
| Logique métier | Signal `post_save` : notification globale si `is_public_internally = True`. **Inaltérabilité** : `file_path` bloqué en modification une fois finalisé. |
| Accès | Lecture : tout utilisateur si public, sinon Super-Admin/Admin uniquement. Écriture : Direction + Super-Admin. |

### 5.8 Passerelle externe — validation Paie & Notes de frais
Ce module **n'appartient pas** structurellement à Administration, mais expose deux points d'intégration à développer côté Administration :
- **Notes de frais** : endpoint de validation qui fait basculer une note de SOUMIS → VALIDE, intercepté par Administration ou Direction Financière.
- **Bulletins de paie** : action de validation finale déclenchée par Administration en fin de cycle paie externe ; traitement asynchrone (Celery) qui génère les PDF, chiffre en AES-256, et importe en masse chaque fichier dans `EmployeeDocument` (voir 5.5).

### 5.9 RBAC de référence — département Administration & RH (matrice des rôles)
| Rôle | Peut faire |
|---|---|
| **Super-Administrateur** | CRUD complet sur toutes les tables. Seul rôle habilité à créer des utilisateurs, modifier `department_id`, attribuer/révoquer des rôles. Accès exclusif config chiffrement + `AuditLog` global. |
| **Responsable RH** | CRUD complet `EmployeeProfile`/`Contract`. Saisie/modif des salaires bruts (déclenche calcul `base_hourly_cost`). Upload fiches de paie/contrats. **Ne peut pas** modifier les rôles/habilitations. |
| **Collaborateur standard** | Lecture seule de son propre profil et documents. Aucun accès aux dossiers/salaires des autres. |

---

## 6. Règles transverses à respecter partout (technique **et** administration)

- **Fichiers** : toujours via le service Google Drive abstrait — ne stocker que l'ID/URL dans `file_path`, jamais de binaire en base.
- **Transactions** : `transaction.atomic()` pour toute opération combinant changement de statut + notification.
- **Champs d'audit standard** : `created_at`, `updated_at`, `uploaded_by` sur tous les modèles pertinents.
- **AuditLog** : immuable — aucun endpoint PUT/PATCH/DELETE ; toute action sensible doit y être journalisée.
- **Sécurité API** : endpoints RH (`/api/v1/admin/rh/`) protégés par vérification de rôle dans le JWT + permission `IsAdminUser`.
- **Notifications** : signal `post_save` → table `Notification` + push FCM/in-app selon le type d'événement.
- **Immuabilité du rapprochement bancaire** : dès qu'une ligne est `is_reconciled=True`, plus aucun rôle (y compris Super-Admin) ne peut la modifier via l'API.

---

## 7. Ordre de développement conseillé

En s'appuyant sur le planning global (section 9 du cahier des charges), voici une séquence logique pour tes deux périmètres :

1. **Fondations partagées** : vérifier/mettre en place `docker-compose`, migrations initiales, modèle `User`/`Department`/`Role` déjà posés par l'équipe (Super-Admin).
2. **Techniques — noyau** : `Project` → `ProjectPhase` → `Task` → `TimeEntry` (chaque modèle dépend logiquement du précédent).
3. **Administration — noyau** : `Client` → `ClientInteraction` → `ClientDocument` (le CRM est un prérequis pour `Project.client_id`, donc à coordonner avec Techniques).
4. **Techniques — support** : `Ticket` + `KnowledgeBase`.
5. **Administration — RH & gouvernance** : `EmployeeDocument`, `LeaveRequest`, `CompanyAsset`, `AdministrativeRecord`.
6. **Administration — avancé** : `ContractGenerator` (signature électronique) et passerelle paie/notes de frais.
7. **Tests + documentation Swagger** au fur et à mesure de chaque module, pas en fin de sprint.

---

## 8. Checklist de démarrage rapide

- [ ] Cloner le dépôt et checkout `Herbert_technique`
- [ ] Configurer l'environnement local (`.env`, `docker compose up`)
- [ ] Lancer les migrations et créer un superuser de test
- [ ] Vérifier l'existence des modèles `User`/`Department`/`Role` déjà en place
- [ ] Créer le modèle `Project` + serializer + viewset + permissions + tests
- [ ] Ouvrir une PR de la branche technique vers `main` (ou `develop` si créée)
- [ ] Répéter le cycle pour chaque module listé en section 4, puis basculer sur `Herbert-_administration` pour la section 5

---

## 9. Documents de référence à garder sous la main

- **Cahier des charges** (sections 3, 4, 5, 8) — spécifications fonctionnelles et modèle de données global.
- **Matrice des rôles** — droits exacts par rôle, à faire correspondre 1:1 avec tes permissions DRF.
- **`schemade_db_SD.sql`** — schéma PostgreSQL de référence (tables, enums, triggers, RLS) à transposer en modèles Django/migrations.
- **Modèles JSON Firestore** (`2.1`) et **règles de sécurité Firestore** (`2.2`) — utiles si tu touches à la messagerie ou aux notifications temps réel liées à tes modules (ex. notification d'assignation de tâche).

N'hésite pas à demander confirmation à l'équipe sur : l'existence d'une branche `develop`, la mise en place effective du CI/CD (GitLab vs GitHub Actions), et la présence d'un `docker-compose.yml` déjà versionné.
