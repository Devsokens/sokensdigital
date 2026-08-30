> ⚠️ **Document historique (2026-08-16), pas exécuté.** Référence encore
> `CashVoucher` (supprimé, fusionné dans `treasury.CashEntry`) et les statuts
> anglais (renommés en français depuis). Aucun fichier de test n'existe
> encore pour `procurement`/`treasury` (`ls procurement/tests*` → rien) —
> cette checklist manuelle reste la seule couverture documentée, toujours
> pas exécutée. Voir `docs/ETAT_ACTUEL_FINANCE_ACHATS_TRESORERIE_2026-08.md`.

# Checklist Tests — Workflow Opérations d'Achats (Procurement)

**Module:** `procurement` | **Apps:** Supplier, ProcurementRequest, SupplierQuote, CashVoucher, SupplierInvoice

---

## Phase 1: Migrations & Schema

- [ ] `python manage.py makemigrations procurement` → genère 0001_initial.py
- [ ] `python manage.py migrate procurement` → applique migrations
- [ ] Vérifier tables créées en DB:
  - [ ] procurement_supplier
  - [ ] procurement_procurementrequest
  - [ ] procurement_supplierquote
  - [ ] procurement_cashvoucher
  - [ ] procurement_supplierinvoice
- [ ] Vérifier indices créés: (name), (status)

---

## Phase 2: Models & Calculations

### Supplier

- [ ] Créer supplier avec tous champs
- [ ] Vérifier `is_active=True` par défaut
- [ ] Vérifier SIRET unique (nullable)
- [ ] Vérifier `str()` retourne name

### ProcurementRequest

- [ ] Créer procurment avec status=DRAFT
- [ ] Vérifier `requested_by` auto-set à creator
- [ ] Vérifier `estimated_amount` validation (> 0)
- [ ] Vérifier validation fails si amount ≤ 0

### SupplierQuote

- [ ] Créer quote avec amount_ht + vat_rate
- [ ] Vérifier `quote_number` auto-généré (QUOTE-2026-00001)
- [ ] Vérifier `amount_ttc = amount_ht * (1 + vat_rate)`
  - Exemple: 100 HT + 18% VAT → 118 TTC
- [ ] Vérifier quote_number unique
- [ ] Vérifier save() sans error

### CashVoucher

- [ ] Créer voucher avec type=VOUCHER
- [ ] Vérifier `voucher_number` auto-généré (BON-2026-00001)
- [ ] Vérifier voucher_number unique
- [ ] Vérifier `created_by` set correctly
- [ ] Vérifier `reconciled_by/at` nullable

### SupplierInvoice

- [ ] Créer invoice avec amount_ht + vat_rate
- [ ] Vérifier `amount_ttc = amount_ht * (1 + vat_rate)`
- [ ] Vérifier `invoice_number` unique
- [ ] Vérifier `received_at` auto-set
- [ ] Vérifier `received_by` set correctly

---

## Phase 3: Permissions & ViewSets

### Supplier Endpoints

```bash
# Create (Finance/Admin only)
curl -X POST http://localhost:8000/api/v1/procurement/suppliers/ \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme", "email": "vendor@acme.com", "phone": "555-1234", ...}'

# Expect: 201 Created (Finance/Admin), 403 Forbidden (others)
```

- [ ] Create supplier: 201 if Finance, 403 if Developer
- [ ] List suppliers: 200 for all authenticated
- [ ] Retrieve supplier: 200 for all
- [ ] Update supplier: 200 if Finance, 403 if Developer
- [ ] Delete supplier: 204 if Finance, 403 if Developer

### ProcurementRequest Endpoints

- [ ] Create: 201 (sets `requested_by=current_user`)
- [ ] List: 200 (filter by department, status)
- [ ] Retrieve: 200
- [ ] POST approve_rcf: 200 if Manager RCF, 403 otherwise
  - Sets `status=PENDING_MANAGER`, `rcf_approved_by/at`
- [ ] POST reject_rcf: 200 if Manager RCF
  - Sets `status=REJECTED`, `rejection_reason`, `rcf_approved_by/at`
- [ ] POST approve_manager: 200 if Manager General
  - Sets `status=APPROVED`, `manager_approved_by/at`
- [ ] POST reject_manager: 200 if Manager General
  - Sets `status=REJECTED`, `rejection_reason`, `manager_approved_by/at`

### SupplierQuote Endpoints

- [ ] Create: 201 (any authenticated)
- [ ] List: 200 (filter by procurement, supplier, status)
- [ ] POST validate_rcf: 200 if Manager RCF
  - Sets `rcf_validated_by/at`
- [ ] POST validate_manager: 200 if Manager General
  - Sets `status=VALIDATED`, `manager_validated_by/at`
  - **SIGNAL TRIGGER:** Creates DisbursementRequest async
- [ ] POST reject: 200
  - Sets `status=REJECTED`

### CashVoucher Endpoints

- [ ] Create: 201 if Finance, 403 otherwise
- [ ] List: 200 (filter by type, date)
- [ ] POST reconcile: 200
  - Sets `reconciled_by=current_user`, `reconciled_at=now()`

### SupplierInvoice Endpoints

- [ ] Create: 201 (sets `received_by=current_user`)
- [ ] List: 200 (filter by supplier, procurement, status)
- [ ] POST validate: 200 if Finance, 403 otherwise
  - Sets `status=VALIDATED`, `validated_by/at`
  - **SIGNAL TRIGGER:** Creates JournalEntry async + sets status=PAID

---

## Phase 4: Signals & Async Tasks

### Signal: SupplierQuote Validated → DisbursementRequest

**Setup:**
1. Create ProcurementRequest (status=APPROVED)
2. Create SupplierQuote (amount_ht=1000, vat_rate=0.18)
3. Validate quote (POST validate_manager)

**Verify:**
- [ ] Signal fires (check logs)
- [ ] Celery task queued: `create_disbursement_request_task`
- [ ] Wait ~2 seconds for task to complete
- [ ] DisbursementRequest created in DB:
  - [ ] amount = 1180 (1000 * 1.18)
  - [ ] description = f'Décaissement devis QUOTE-2026-00001 — Acme'
  - [ ] status = PENDING
  - [ ] procurement_quote = quote.id
- [ ] Logs show: "✓ DisbursementRequest créé: {id}"

**Error Handling:**
- [ ] Kill Celery worker → task queued but not executed
- [ ] Restart worker → task retries and completes
- [ ] Check task retry logic (max_retries=3, countdown=60s)

### Signal: SupplierInvoice Validated → JournalEntry

**Setup:**
1. Create SupplierInvoice (amount_ht=1000, vat_rate=0.18)
2. Validate invoice (POST validate)

**Verify:**
- [ ] Signal fires (check logs)
- [ ] Celery task queued: `post_supplier_invoice_journal_entry`
- [ ] Wait ~2 seconds for task to complete
- [ ] JournalEntry created in DB:
  - [ ] reference = f'FAC-{invoice.invoice_number}'
  - [ ] amount_ttc = 1180
  - [ ] 3 TransactionLines created:
    - [ ] Débit Achats (601): 1000
    - [ ] Débit TVA (4456): 180
    - [ ] Crédit Fournisseur (401): 1180
  - [ ] Sum debits = sum credits = 1180
- [ ] SupplierInvoice.status updated to PAID
- [ ] Logs show: "✓ JournalEntry créé: {id}"

**Error Handling:**
- [ ] FinanceSettings missing → fallback to defaults (601, 4456, 401)
- [ ] Invalid amount → check Decimal precision

---

## Phase 5: Data Integrity

### Status Transitions

**ProcurementRequest:**
- [ ] DRAFT → cannot approve directly (must PENDING_RCF first)
- [ ] PENDING_RCF + approve_rcf → PENDING_MANAGER
- [ ] PENDING_RCF + reject_rcf → REJECTED
- [ ] PENDING_MANAGER + approve_manager → APPROVED
- [ ] PENDING_MANAGER + reject_manager → REJECTED

**SupplierQuote:**
- [ ] DRAFT → PENDING (via update)
- [ ] PENDING + validate_manager → VALIDATED (signal fires)
- [ ] PENDING + reject → REJECTED
- [ ] Cannot transition from VALIDATED/REJECTED

**SupplierInvoice:**
- [ ] RECEIVED (default)
- [ ] RECEIVED + validate → VALIDATED (signal fires)
- [ ] VALIDATED → PAID (auto via signal)
- [ ] Cannot go backwards

### Foreign Key Integrity

- [ ] SupplierQuote.procurement points to valid ProcurementRequest
- [ ] SupplierInvoice.procurement points to valid ProcurementRequest
- [ ] SupplierQuote.supplier points to valid Supplier
- [ ] SupplierInvoice.supplier cannot be deleted (PROTECT)
- [ ] CashVoucher.disbursement nullable (can be null)

### Uniqueness

- [ ] quote_number unique across all years
- [ ] voucher_number unique across all years
- [ ] invoice_number unique (supplier's invoice number)
- [ ] supplier.siret unique (nullable)

---

## Phase 6: Serializers & API

### Serializer Read-Only Fields

- [ ] SupplierQuoteSerializer:
  - Read-only: quote_number, amount_ttc, status_display, *_name, *_by_name
  - Writable: procurement, supplier, quote_date, amount_ht, vat_rate, status
- [ ] SupplierInvoiceSerializer:
  - Read-only: amount_ttc, status_display, received_at, *_by_name, *_name
  - Writable: supplier, procurement, quote, invoice_number, invoice_date, due_date, amount_ht, vat_rate

### Nested Fields

- [ ] Response includes `supplier_name` (nested read-only)
- [ ] Response includes `status_display` (human-readable status)
- [ ] Response includes `vat_amount` (calculated from amount_ht * vat_rate)

### Filtering & Ordering

- [ ] ProcurementRequest list filterable by department, status
- [ ] SupplierQuote list filterable by procurement, supplier, status
- [ ] CashVoucher list filterable by type, date (ordering by date, amount)
- [ ] SupplierInvoice list filterable by supplier, procurement, status

---

## Phase 7: Django Admin

- [ ] Supplier admin loads, can create/edit/delete
- [ ] ProcurementRequest admin loads, fieldsets visible
- [ ] SupplierQuote admin loads, read-only fields not editable
- [ ] CashVoucher admin loads
- [ ] SupplierInvoice admin loads

### Admin Actions

- [ ] Can create supplier in admin
- [ ] Can list procurements with search/filter
- [ ] Can approve procurements via admin (form fields for rcf_approved_by/at)
- [ ] Auto-generated fields (quote_number, voucher_number) not editable in admin

---

## Phase 8: RBAC & Security

### Role-Based Access

**Finance Director (ROLE_DIRECTEUR_FINANCIER):**
- [ ] Can create/edit Supplier ✅
- [ ] Can create/edit CashVoucher ✅
- [ ] Can validate SupplierInvoice ✅
- [ ] Cannot approve ProcurementRequest (manager only)

**Manager RCF (ROLE_MANAGER_RCF):**
- [ ] Can approve_rcf on ProcurementRequest ✅
- [ ] Can validate_rcf on SupplierQuote ✅
- [ ] Cannot validate SupplierInvoice (finance only)

**Manager General (ROLE_MANAGER_GENERAL):**
- [ ] Can approve_manager on ProcurementRequest ✅
- [ ] Can validate_manager on SupplierQuote (→ DisbursementRequest signal) ✅
- [ ] Cannot create/validate invoices

**Super Admin:**
- [ ] Can do everything ✅

**Authenticated User (no special role):**
- [ ] Can create ProcurementRequest ✅
- [ ] Can create SupplierInvoice ✅
- [ ] Cannot approve/validate workflows

### Test Cases

```python
# User: Developer (no special role)
GET  /api/v1/procurement/suppliers/ → 200 (read-only)
POST /api/v1/procurement/suppliers/ → 403 (write forbidden)
POST /api/v1/procurement/procurements/ → 201 (can create)
POST /api/v1/procurement/procurements/{id}/approve_rcf/ → 403 (not manager)

# User: Finance Director
POST /api/v1/procurement/suppliers/ → 201 (can create)
POST /api/v1/procurement/invoices/{id}/validate/ → 200 (can validate)
POST /api/v1/procurement/procurements/{id}/approve_rcf/ → 403 (not manager)

# User: Manager RCF
POST /api/v1/procurement/procurements/{id}/approve_rcf/ → 200 (can approve)
POST /api/v1/procurement/quotes/{id}/validate_rcf/ → 200 (can validate)
POST /api/v1/procurement/invoices/{id}/validate/ → 403 (not finance)

# User: Super Admin
* → 200/201 (can do everything)
```

---

## Phase 9: Error Handling

### Invalid Status Transitions

- [ ] Try approve_rcf on non-PENDING_RCF → 400 {'error': 'Invalid status'}
- [ ] Try approve_manager on non-PENDING_MANAGER → 400
- [ ] Try validate_manager on non-PENDING → 400

### Missing Required Fields

- [ ] POST supplier without name → 400 validation error
- [ ] POST procurement without department → 400
- [ ] POST quote without supplier → 400

### Decimal Precision

- [ ] Amount 1000.12 + 18% VAT = 1180.1416 → check rounding
- [ ] Very large amounts (9999999.99) calculate correctly

---

## Phase 10: Integration Tests

### Full Workflow: Fiche Besoins → Facture

```
1. Create ProcurementRequest (budget 10000) → DRAFT
2. Approve RCF → PENDING_MANAGER
3. Approve Manager → APPROVED
4. Create SupplierQuote (5000 HT) → DRAFT
5. Validate Quote Manager → VALIDATED
   → Signal creates DisbursementRequest (5900 TTC)
6. Create SupplierInvoice (5000 HT)
7. Validate Invoice Finance → VALIDATED
   → Signal creates JournalEntry (5900 TTC)
   → SupplierInvoice.status → PAID
8. Verify journal entries:
   - Débit Achats (601): 5000
   - Débit TVA (4456): 900
   - Crédit Fournisseur (401): 5900
```

- [ ] All steps complete without errors
- [ ] Signals fire at steps 5 & 7
- [ ] Tasks complete and create records
- [ ] Final status: ProcurementRequest=APPROVED, SupplierQuote=VALIDATED, SupplierInvoice=PAID
- [ ] Journal entry balanced (debits = credits)

---

## Phase 11: Documentation

- [ ] API endpoints match spec in PROCUREMENT_WORKFLOW_IMPLEMENTATION.md
- [ ] Serializer fields match spec
- [ ] Signals documented & tested
- [ ] Tasks documented & tested
- [ ] RBAC matrix matches implementation

---

## Test Automation (Optional)

Create `backend/procurement/tests/` with:

```python
# test_models.py
class SupplierModelTests(TestCase):
    def test_supplier_creation()
    def test_supplier_siret_unique()

class ProcurementRequestTests(TestCase):
    def test_procurement_created_as_draft()
    def test_estimated_amount_validation()

class SupplierQuoteTests(TestCase):
    def test_quote_number_autogenerated()
    def test_amount_ttc_calculated()

class SupplierInvoiceTests(TestCase):
    def test_invoice_created_as_received()

# test_views.py
class SupplierViewSetTests(APITestCase):
    def test_supplier_list()
    def test_supplier_create_requires_finance()

class ProcurementViewSetTests(APITestCase):
    def test_approve_rcf_requires_manager()
    def test_approve_manager_requires_manager()

# test_signals.py
class SignalTests(TransactionTestCase):
    def test_quote_validated_creates_disbursement()
    def test_invoice_validated_creates_journal_entry()

# test_tasks.py
class CeleryTasksTests(TestCase):
    def test_create_disbursement_request_task()
    def test_post_supplier_invoice_journal_entry_task()
```

---

## Summary

**Total Test Cases:** ~60+
**Time Estimate:** 2-3 hours manual testing + 1 hour automation

**Pass Criteria:**
- All migrations apply without errors
- All endpoints respond correctly
- Permissions enforced
- Signals create records asynchronously
- Journal entries balanced
- No database integrity issues
- All RBAC tests pass

---

**Status:** Ready for testing. Do not push without authorization.
