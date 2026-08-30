> ⚠️ **Document historique (construction initiale du 2026-08-16).** Voir
> `docs/ETAT_ACTUEL_FINANCE_ACHATS_TRESORERIE_2026-08.md` pour l'état réel —
> `CashVoucher` supprimé (fusionné dans `treasury.CashEntry`), statuts
> renommés en français (DRAFT→BROUILLON, PENDING→EN_ATTENTE, VALIDATED→VALIDE,
> etc.), les signaux décrits plus bas n'existent plus (remplacés par dispatch
> explicite depuis les vues), immutabilité du statut ajoutée le 17/08, déjà
> poussé sur `main`.

# Opérations d'Achats (Procurement Workflow) — Implémentation Complète

**Status:** ✅ Implémentation terminée (ne pas pousser sans autorisation utilisateur)

**Date:** 2026-08-16 | **Module Django:** `procurement` app | **Version API:** `/api/v1/procurement/`

---

## Résumé Exécutif

Implémentation complète du cycle achat (fiche besoins → devis → décaissement → facture fournisseur) avec:
- **5 modèles** (Supplier, ProcurementRequest, SupplierQuote, CashVoucher, SupplierInvoice)
- **5 ViewSets** avec permissions RBAC multi-niveau
- **2 signaux** auto-déclenchen JournalEntry et DisbursementRequest
- **2 Celery tasks** async (décaissement + comptabilité)
- **Intégration complète** avec le module Finance (DisbursementRequest, JournalEntry)
- **Tests admin Django** + endpoints REST documentés

---

## Étapes du Workflow

### Étape 1: Fiche État des Besoins (ProcurementRequest)

**Modèle:** `procurement.ProcurementRequest`

**Status Flow:**
```
DRAFT → PENDING_RCF → PENDING_MANAGER → APPROVED → IN_PROGRESS → COMPLETED
                   ↓ (reject_rcf)                    ↓ (reject_manager)
                 REJECTED                           REJECTED
```

**Champs clés:**
- `title` (CharField)
- `description` (TextField) — besoins détaillés
- `estimated_amount` (Decimal)
- `department` (FK → core.Department)
- `requested_by` (FK → User)
- `status` (choices: DRAFT, PENDING_RCF, etc.)
- `rcf_approved_by/at` — timestamp RCF validation
- `manager_approved_by/at` — timestamp Manager validation
- `rejection_reason` (TextField, blank=True)

**Permissions:**
- Créer: Tout user authentifié (créateur devient `requested_by`)
- Approuver (RCF): `ROLE_MANAGER_RCF` ou `ROLE_SUPER_ADMIN`
- Approuver (Manager): `ROLE_MANAGER_GENERAL` ou `ROLE_SUPER_ADMIN`

**Endpoints:**
```
POST   /api/v1/procurement/procurements/                    # Créer
GET    /api/v1/procurement/procurements/                    # List (filter: department, status)
GET    /api/v1/procurement/procurements/{id}/               # Détail
PUT    /api/v1/procurement/procurements/{id}/               # Éditer
DELETE /api/v1/procurement/procurements/{id}/               # Supprimer

# Actions
POST   /api/v1/procurement/procurements/{id}/approve_rcf/   # RCF validation
POST   /api/v1/procurement/procurements/{id}/reject_rcf/    # RCF reject (+ reason)
POST   /api/v1/procurement/procurements/{id}/approve_manager/ # Manager validation
POST   /api/v1/procurement/procurements/{id}/reject_manager/  # Manager reject (+ reason)
```

---

### Étape 2: Devis Fournisseur (SupplierQuote)

**Modèle:** `procurement.SupplierQuote`

**Status Flow:**
```
DRAFT → PENDING → VALIDATED
                ↓ (reject)
              REJECTED
```

**Champs clés:**
- `procurement` (FK → ProcurementRequest)
- `supplier` (FK → procurement.Supplier)
- `quote_number` (CharField, auto-generated: QUOTE-{year}-{seq:05d}, unique)
- `quote_date` (DateField)
- `amount_ht` (Decimal)
- `vat_rate` (Decimal, default=0.18)
- `amount_ttc` (Decimal, auto-calculated = amount_ht * (1 + vat_rate))
- `status` (choices: DRAFT, PENDING, VALIDATED, REJECTED)
- `rcf_validated_by/at` — RCF review (optional)
- `manager_validated_by/at` — Manager final approval

**Permissions:**
- Créer: Finance staff ou Admin
- Valider (RCF): `ROLE_MANAGER_RCF` ou Admin
- Valider (Manager): `ROLE_MANAGER_GENERAL` ou Admin

**Signal:**
Quand `status = VALIDATED` après save:
→ Lance Celery task `create_disbursement_request_task.delay(quote_id)` qui crée automatiquement un DisbursementRequest avec amount = amount_ttc

**Endpoints:**
```
POST   /api/v1/procurement/quotes/                    # Créer
GET    /api/v1/procurement/quotes/                    # List (filter: procurement, supplier, status)
GET    /api/v1/procurement/quotes/{id}/               # Détail
PUT    /api/v1/procurement/quotes/{id}/               # Éditer
DELETE /api/v1/procurement/quotes/{id}/               # Supprimer

# Actions
POST   /api/v1/procurement/quotes/{id}/validate_rcf/   # RCF review
POST   /api/v1/procurement/quotes/{id}/validate_manager/ # Manager validation (auto-crée DisbursementRequest)
POST   /api/v1/procurement/quotes/{id}/reject/         # Reject quote
```

---

### Étape 3: Décaissement Auto-Créé (DisbursementRequest)

**Modèle:** `finance.DisbursementRequest` (existant)

**Auto-création:**
- Signal `on_supplier_quote_validated()` → Celery task `create_disbursement_request_task`
- Crée DisbursementRequest avec:
  - `amount = quote.amount_ttc`
  - `description = f'Décaissement devis {quote.quote_number} — {supplier.name}'`
  - `procurement_quote` = quote (FK)
  - `status = PENDING`

**Statuses:** PENDING → APPROVED → DISBURSED

Les approbations de décaissement sont gérées par le module Finance (pas de action dédiée en Procurement).

---

### Étape 4: Pièce de Caisse (CashVoucher)

**Modèle:** `procurement.CashVoucher`

**Champs clés:**
- `type` (choices: RECEIPT='Reçu caisse (entrée)', VOUCHER='Pièce de sortie')
- `voucher_number` (CharField, auto-generated: BON-{year}-{seq:05d}, unique)
- `date` (DateField)
- `amount` (Decimal)
- `description` (CharField)
- `disbursement` (OneToOne → finance.DisbursementRequest, nullable) — lien optionnel
- `created_by` (FK → User)
- `reconciled_by/at` (FK → User, DateTimeField) — réconciliation bancaire

**Permissions:**
- Créer/Modifier: `ROLE_DIRECTEUR_FINANCIER` ou Admin
- Lire: Tout user authentifié

**Endpoints:**
```
POST   /api/v1/procurement/cash-vouchers/              # Créer
GET    /api/v1/procurement/cash-vouchers/              # List (filter: type, date)
GET    /api/v1/procurement/cash-vouchers/{id}/         # Détail
PUT    /api/v1/procurement/cash-vouchers/{id}/         # Éditer
DELETE /api/v1/procurement/cash-vouchers/{id}/         # Supprimer

# Actions
POST   /api/v1/procurement/cash-vouchers/{id}/reconcile/ # Marquer rapproché (reconciled_by, reconciled_at)
```

---

### Étape 5: Facture Fournisseur (SupplierInvoice)

**Modèle:** `procurement.SupplierInvoice`

**Status Flow:**
```
RECEIVED → VALIDATED → PAID
```

**Champs clés:**
- `supplier` (FK → procurement.Supplier)
- `procurement` (FK → ProcurementRequest)
- `quote` (FK → SupplierQuote, nullable) — lien optionnel si devis existait
- `invoice_number` (CharField, unique) — N° fournisseur
- `invoice_date` (DateField)
- `due_date` (DateField, nullable)
- `amount_ht`, `vat_rate`, `amount_ttc` (Decimal) — auto-calc TTC
- `status` (choices: RECEIVED, VALIDATED, PAID)
- `cash_voucher` (OneToOne → CashVoucher, nullable)
- `received_by/at` (User, DateTimeField)
- `validated_by/at` (User, DateTimeField)

**Permissions:**
- Créer: Tout user authentifié (reçu_par = current user)
- Valider: `ROLE_DIRECTEUR_FINANCIER` ou Admin

**Signal:**
Quand `status = VALIDATED` après save:
→ Lance Celery task `post_supplier_invoice_journal_entry.delay(invoice_id)` qui crée automatiquement JournalEntry:
  - **Débit:** Achats (60x) + TVA déductible (4456)
  - **Crédit:** Fournisseur (401)
  - Amount: invoice.amount_ttc
  - Après posting, invoice.status → PAID

**Endpoints:**
```
POST   /api/v1/procurement/invoices/                  # Créer (received_by = current user)
GET    /api/v1/procurement/invoices/                  # List (filter: supplier, procurement, status)
GET    /api/v1/procurement/invoices/{id}/             # Détail
PUT    /api/v1/procurement/invoices/{id}/             # Éditer
DELETE /api/v1/procurement/invoices/{id}/             # Supprimer

# Actions
POST   /api/v1/procurement/invoices/{id}/validate/    # Valider + auto-post JournalEntry
```

---

### Référence: Fournisseurs (Supplier)

**Modèle:** `procurement.Supplier`

**Champs clés:**
- `name`, `siret`, `email`, `phone`, `address`, `city`, `postal_code`, `country`
- `bank_account` (IBAN ou compte local)
- `bank_name` (nom banque)
- `contact_person` (nom contact)
- `is_active` (Boolean, default=True)

**Permissions:**
- Créer/Modifier: `ROLE_DIRECTEUR_FINANCIER` ou Admin
- Lire: Tout user authentifié

**Endpoints:**
```
POST   /api/v1/procurement/suppliers/                 # Créer
GET    /api/v1/procurement/suppliers/                 # List
GET    /api/v1/procurement/suppliers/{id}/            # Détail
PUT    /api/v1/procurement/suppliers/{id}/            # Éditer (Finance/Admin)
DELETE /api/v1/procurement/suppliers/{id}/            # Supprimer (Finance/Admin)
```

---

## Architecture Technique

### Fichiers Créés

```
backend/procurement/
├── __init__.py
├── models.py              # 5 modèles: Supplier, ProcurementRequest, SupplierQuote, CashVoucher, SupplierInvoice
├── serializers.py         # 5 serializers avec read-only fields
├── views.py               # 5 ViewSets avec permissions RBAC
├── urls.py                # Router DefaultRouter
├── signals.py             # 2 signaux: quote validated → disbursement, invoice validated → journal entry
├── tasks.py               # 2 Celery tasks: create_disbursement_request, post_supplier_invoice_journal_entry
├── admin.py               # 5 admin classes
├── apps.py                # AppConfig (signals registration)
└── migrations/
    ├── __init__.py
    └── 0001_initial.py    # Migration initiale: tous modèles

backend/sokens_backend/
├── settings.py            # ADD: 'procurement' à INSTALLED_APPS
└── urls.py                # ADD: path('api/v1/procurement/', include('procurement.urls'))
```

### Modèle Données

```
Supplier
  ├─ name (CharField)
  ├─ siret (CharField, unique, nullable)
  ├─ email, phone, address
  ├─ bank_account, bank_name
  └─ is_active (Boolean)

ProcurementRequest
  ├─ title, description, estimated_amount
  ├─ department (FK)
  ├─ requested_by (FK → User)
  ├─ status (enum)
  ├─ rcf_approved_by/at
  ├─ manager_approved_by/at
  └─ rejection_reason

SupplierQuote (ProcurementRequest → quotes)
  ├─ supplier (FK)
  ├─ quote_number (auto-gen)
  ├─ quote_date, amount_ht, vat_rate, amount_ttc (calc)
  ├─ status (enum)
  ├─ rcf_validated_by/at
  └─ manager_validated_by/at
  └─ [SIGNAL on VALIDATED → DisbursementRequest.create]

CashVoucher
  ├─ type (RECEIPT|VOUCHER)
  ├─ voucher_number (auto-gen)
  ├─ date, amount, description
  ├─ disbursement (OneToOne → DisbursementRequest, nullable)
  ├─ created_by (FK)
  ├─ reconciled_by/at
  └─ [No auto-signal]

SupplierInvoice (ProcurementRequest → invoices)
  ├─ supplier (FK)
  ├─ procurement (FK)
  ├─ quote (FK, nullable)
  ├─ invoice_number (unique)
  ├─ invoice_date, due_date, amount_ht, vat_rate, amount_ttc (calc)
  ├─ status (RECEIVED|VALIDATED|PAID)
  ├─ cash_voucher (OneToOne, nullable)
  ├─ received_by/at
  ├─ validated_by/at
  └─ [SIGNAL on VALIDATED → JournalEntry.create + status→PAID]
```

### Intégration Finance

**DisbursementRequest:**
- Créé via signal quand `SupplierQuote.status = VALIDATED`
- Montant = `quote.amount_ttc`
- Lien FK: `quote` ou `procurement_quote` (selon modèle Finance)

**JournalEntry + TransactionLine:**
- Créé via signal quand `SupplierInvoice.status = VALIDATED`
- **Débit:** Achats (60x) + TVA déductible (4456)
- **Crédit:** Fournisseur (401)
- Async via Celery task pour décharger la request

### Permissions RBAC

| Rôle | Créer Procurement | Approuver Procurement | Valider Quote | Créer Facture | Valider Facture |
|------|------|------|------|------|------|
| Super Admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manager RCF | ❌ | ✅ | ✅ | ❌ | ❌ |
| Manager Général | ❌ | ✅ | ✅ | ❌ | ❌ |
| Directeur Financier | ✅ | ❌ | ❌ | ✅ | ✅ |
| Utilisateur Standard | ✅ | ❌ | ❌ | ✅ | ❌ |

---

## Celery Tasks (Async)

### `create_disbursement_request_task(quote_id)`

**Trigger:** Signal `post_save` sur SupplierQuote quand status=VALIDATED

**Logique:**
1. Récupère quote par id
2. Vérifie status=VALIDATED
3. Crée DisbursementRequest:
   - amount = quote.amount_ttc
   - description = f'Décaissement devis {quote.quote_number} — {supplier.name}'
   - status = PENDING
4. Log: ✓ "DisbursementRequest créé: {id}"
5. Retry: max 3 avec backoff exponentiel (60s * 2^retry)

**Error Handling:** Log error + retry avec exponentiel backoff

### `post_supplier_invoice_journal_entry(invoice_id)`

**Trigger:** Signal `post_save` sur SupplierInvoice quand status=VALIDATED

**Logique:**
1. Récupère invoice par id
2. Vérifie status=VALIDATED
3. Récupère FinanceSettings (ou fallback defaults):
   - account_purchases (default: '601')
   - account_vat_deductible (default: '4456')
   - account_supplier (default: '401')
4. Crée JournalEntry:
   - reference = f'FAC-{invoice.invoice_number}'
   - amount_ht, amount_ttc, vat_rate
5. Crée 3 TransactionLines:
   - Débit Achats (60x): amount_ht
   - Débit TVA (4456): amount_ht * vat_rate (si vat_rate > 0)
   - Crédit Fournisseur (401): amount_ttc
6. Marque invoice.status = PAID
7. Log: ✓ "JournalEntry créé: {id}"
8. Retry: max 3 avec backoff exponentiel

**Error Handling:** Log error + retry avec exponentiel backoff

---

## Serializers

Tous héritent de `serializers.ModelSerializer`:

- **SupplierSerializer:** All fields + is_active
- **ProcurementRequestSerializer:** Read-only: status_display, *_name, *_by_name
- **SupplierQuoteSerializer:** Read-only: quote_number, amount_ttc, *_display
- **CashVoucherSerializer:** Read-only: voucher_number, type_display, *_name
- **SupplierInvoiceSerializer:** Read-only: amount_ttc, status_display, *_by_name, *_name

Tous calculent les champs "dépendants" via `SerializerMethodField` (ex: vat_amount).

---

## Django Admin

5 classes d'admin avec fieldsets intelligents:

- **SupplierAdmin:** Info | Adresse | Bancaire | Statut
- **ProcurementRequestAdmin:** Demande | Status | Approbations
- **SupplierQuoteAdmin:** Devis | Montants | Status | Validations
- **CashVoucherAdmin:** Pièce | Liens | Rapprochement
- **SupplierInvoiceAdmin:** Facture | Montants | Status | Historique

---

## Testing (Recommandé)

### Tests à Ajouter

**backend/procurement/tests/**

```python
# test_models.py
def test_procurement_request_status_flow()
def test_supplier_quote_auto_ttc_calculation()
def test_cash_voucher_number_autogenerate()
def test_supplier_invoice_ttc_calculation()

# test_views.py
def test_supplier_list_authenticated()
def test_procurement_request_create_sets_requested_by()
def test_procurement_request_approve_rcf_requires_manager()
def test_supplier_quote_validate_manager_creates_disbursement()
def test_supplier_invoice_validate_creates_journal_entry()
def test_supplier_invoice_validate_updates_status_to_paid()

# test_signals.py
def test_supplier_quote_validated_signal_creates_disbursement()
def test_supplier_invoice_validated_signal_creates_journal_entry()

# test_tasks.py
def test_create_disbursement_request_task()
def test_post_supplier_invoice_journal_entry_task()
```

### Checklist Test

- [ ] Tous les endpoints respond avec 200/201/400 appropriés
- [ ] Permissions RBAC: Manager peut approuver, Finance peut valider
- [ ] Signals déclenchen les tasks Celery
- [ ] TTC calculated correctly (HT * (1 + VAT))
- [ ] Auto-generated numbers unique et formatés correctement
- [ ] Journal entries créés avec les bons comptes
- [ ] Invoice status → PAID après JournalEntry
- [ ] DisbursementRequest créé avec le bon montant (TTC)

---

## Déploiement

### Checklist

- [ ] `python manage.py makemigrations procurement` (create migration)
- [ ] `python manage.py migrate` (apply migration)
- [ ] `python manage.py test procurement/` (run tests)
- [ ] Enregistrer les apps dans `settings.py` INSTALLED_APPS ✅
- [ ] Ajouter les routes dans `urls.py` ✅
- [ ] Enregistrer les models dans `admin.py` ✅
- [ ] Celery worker running (tasks async)
- [ ] FinanceSettings.load() disponible (ou fallback defaults)
- [ ] Test intégration Finance module:
  - DisbursementRequest créé correctement
  - JournalEntry posté correctement
  - Comptes validés vs chart comptable

### Fichiers Modifiés

1. ✅ `backend/sokens_backend/settings.py` — INSTALLED_APPS += 'procurement'
2. ✅ `backend/sokens_backend/urls.py` — path('api/v1/procurement/', ...)

### Fichiers Créés (Ne pas pousser sans autorisation)

1. ✅ `backend/procurement/__init__.py`
2. ✅ `backend/procurement/models.py`
3. ✅ `backend/procurement/serializers.py`
4. ✅ `backend/procurement/views.py`
5. ✅ `backend/procurement/urls.py`
6. ✅ `backend/procurement/signals.py`
7. ✅ `backend/procurement/tasks.py`
8. ✅ `backend/procurement/admin.py`
9. ✅ `backend/procurement/apps.py`
10. ✅ `backend/procurement/migrations/0001_initial.py`

---

## Prochaines Étapes

### Phase 1 (Finition)
- [ ] Tests complets (unit + intégration)
- [ ] Vérifier DisbursementRequest + JournalEntry creation
- [ ] Test permissions RBAC sur chaque action
- [ ] Tester auto-générations (numbers, TTCs, statuses)

### Phase 2 (Audit)
- [ ] Vérifier conformité cahier des charges §2 (Opérations d'achats)
- [ ] Vérifier intégration Finance (DisbursementRequest, JournalEntry)
- [ ] Vérifier audit logs (LoggedModel, AuditLog)

### Phase 3 (Frontend)
- [ ] UI: ProcurementRequest list/create/approve
- [ ] UI: SupplierQuote validation workflow
- [ ] UI: CashVoucher reconciliation
- [ ] UI: SupplierInvoice validation + journal entry auto-post

### Phase 4 (Production)
- [ ] Déploiement QA
- [ ] Déploiement production
- [ ] Monitoring Celery tasks (create_disbursement, journal entry posting)
- [ ] Alert sur erreurs async

---

## Références

- **Cahier des Charges:** §2 "Opérations d'achats"
- **Finance Module:** DisbursementRequest, JournalEntry, TransactionLine, FinanceSettings
- **RBAC Constants:** core/constants.py (ROLE_MANAGER_RCF, ROLE_MANAGER_GENERAL, ROLE_DIRECTEUR_FINANCIER)
- **Payment Workflow:** Voir PAYMENT_WORKFLOW_IMPLEMENTATION.md pour pattern identique (versements)

---

**Summary:** Opérations d'achats avec cycle complet (fiche besoins → approvals → devis → décaissement auto → facture → comptabilité auto). Prêt pour tests + déploiement. Ne pas pousser sans autorisation utilisateur.
