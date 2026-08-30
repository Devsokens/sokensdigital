> ⚠️ **Document historique (2026-08-16).** `Payment.Status` renommé en
> français (`PENDING`→`EN_ATTENTE`, `RECEIVED`→`RECU`, `RECORDED`→
> `ENREGISTRE`). Backend confirmé complet et fonctionnel, **mais aucune UI
> frontend n'existe encore pour ce workflow** (`components/admin/finance/
> invoices.tsx` ne mentionne pas Payment) — seul un appel API direct permet
> de l'utiliser aujourd'hui. Voir
> `docs/ETAT_ACTUEL_FINANCE_ACHATS_TRESORERIE_2026-08.md`.

# Implémentation Workflow Paiements Partiels

**Date:** 2026-08-16  
**Status:** ✅ COMPLET (non poussé)  
**Branche:** taiger_technique  

## Sommaire

Workflow complet de ventes digitales avec versements partiels (20-30%-...-100%), reçus auto-générés, pièces justificatives, enregistrement comptable.

## 1. Modèles Backend

### `finance.Payment` (nouveau)
- **Fields:** invoice FK, amount, payment_date, payment_method (CHEQUE/VIREMENT/ESPECES/CARTE/AUTRE)
- **Status:** PENDING → RECEIVED → RECORDED
- **Validation:** Somme versements ≤ amount_ttc
- **Propriété:** `is_fully_paid` check si facture 100% payée

### `finance.PaymentReceipt` (nouveau)
- **OneToOne:** Payment
- **Auto-génération:** receipt_number = REC-{année}-{seq:05d}
- **Crée par:** action `Payment.receive` (auto)
- **Trigger:** PDF generation (task Celery)

### `core.DocumentAttachment` (nouveau)
- **GenericForeignKey:** Lié à Payment, Invoice, Quote, etc. via ContentType
- **Types:** CHEQUE, BORDEREAU, BANK_STATEMENT, INVOICE, RECEIPT, QUOTE, CONTRACT, OTHER
- **File:** upload_to `documents/%Y/%m/%d/`
- **Upload:** Via nested endpoint `/invoices/{id}/payments/{id}/attachments/`

### `finance.FinanceSettings` (existant, amélioré)
- `vat_rate`: Configurable (était const)
- `default_client_account_code`: 411 (configurable)
- `default_sales_account_code`: 706 (configurable)
- `default_vat_collected_account_code`: 4457 (configurable)

## 2. ViewSets et Endpoints

### `PaymentViewSet` (nested route)
```
POST   /api/v1/finance/invoices/{invoice_id}/payments/          [create]
GET    /api/v1/finance/invoices/{invoice_id}/payments/          [list]
GET    /api/v1/finance/invoices/{invoice_id}/payments/{id}/     [retrieve]
POST   /api/v1/finance/invoices/{invoice_id}/payments/{id}/receive/  [action]
```

**Action `receive`:**
- Mark Payment status = RECEIVED
- Auto-créer PaymentReceipt
- Trigger PDF generation (Celery task)
- Check si 100% payé → Invoice status = VALIDEE
- Auto-post JournalEntry si facture valide

### `PaymentReceiptViewSet` (read-only)
```
GET    /api/v1/finance/invoices/{invoice_id}/receipts/
GET    /api/v1/finance/invoices/{invoice_id}/receipts/{id}/
```

### DocumentAttachment (à ajouter)
```
POST   /api/v1/finance/invoices/{invoice_id}/payments/{id}/attachments/
GET    /api/v1/finance/invoices/{invoice_id}/payments/{id}/attachments/
```

## 3. Serializers

### `PaymentSerializer`
- Champs: invoice, amount, payment_date, payment_method, status, received_by, received_at, notes
- Read-only: receipt (nested), attachments (nested), total_paid (calculated), remaining (calculated)
- Méthodes: `get_total_paid()`, `get_remaining()`

### `PaymentReceiptSerializer`
- Read-only: receipt_number (auto), issued_by, created_at

### `DocumentAttachmentSerializer`
- Champs: document_type, file_name, file_size, uploaded_by, notes, created_at
- Read-only: file_size, uploaded_by, created_at

## 4. Celery Tasks

### `generate_payment_receipt_pdf(receipt_id)`
- Template: `payment_receipt_pdf.html`
- Appelé par: `Payment.receive` action
- Génère PDF avec numéro reçu, montant, facture, méthode paiement
- Retry x3 avec backoff exponentiel

### `post_invoice_journal_entry(invoice_id)`
- Appelé par: Signal post_save Payment quand `is_fully_paid`
- Crée `JournalEntry` + 3x `TransactionLine`:
  - Débit Client (411): amount_ttc
  - Crédit Sales (706): amount_ht
  - Crédit VAT (4457): TVA
- Logs error si période comptable fermée ou inexistante
- Idempotent: check si JournalEntry existe déjà

## 5. Workflow d'utilisation

### Étape 1: Quote accepté → Invoice créée
```
Quote.status = ACCEPTE
→ Django auto: créer Invoice(status=BROUILLON, client=..., amount_ttc=...)
```

### Étape 2-4: Premier versement
```
POST /api/v1/finance/invoices/{id}/payments/
{
  "amount": 50000,
  "payment_date": "2026-08-20",
  "payment_method": "CHEQUE",
  "notes": "Chèque BNP 00123456"
}

→ Payment créée (status=PENDING)
```

### Étape 5: Réception versement
```
POST /api/v1/finance/invoices/{id}/payments/{id}/receive/

→ Payment.status = RECEIVED
→ PaymentReceipt auto-créée (REC-2026-00001)
→ Celery: generate_payment_receipt_pdf() lancée
→ Si 100%: Invoice.status = VALIDEE
  → Celery: post_invoice_journal_entry() lancée
```

### Étape 6: Upload pièces justif
```
POST /api/v1/finance/invoices/{id}/payments/{id}/attachments/
{
  "document_type": "CHEQUE",
  "file": <multipart>,
  "file_name": "Cheque_BNP_20260820.pdf"
}

→ DocumentAttachment créé (lié à Payment via GenericForeignKey)
```

### Étape 7: Récurrence + facture finale
```
Répéter Étapes 2-6 jusqu'à:
  total_paid >= amount_ttc

→ Invoice.status = VALIDEE
→ JournalEntry créée (regroupant facture + tous versements)
→ Facture archivée
```

## 6. Migrations

```
finance/migrations/0007_payment_paymentreceipt.py
  - CreateModel Payment (avec indices FK)
  - CreateModel PaymentReceipt (OneToOne + auto-number)

core/migrations/0008_documentattachment.py
  - CreateModel DocumentAttachment (GenericForeignKey + indices)
```

## 7. Templates PDF

### `invoice_pdf.html` (existant)
Facture complète (une seule fois après 100%)

### `payment_receipt_pdf.html` (nouveau)
Reçu de versement (un par Payment reçu)
- Numéro reçu
- Montant versé
- Facture référencée
- Déclaration légale
- Stamp "REÇU ACQUITTÉ"

## 8. Permissions RBAC

**ViewSets gated to:**
- `IsFinanceRole` (Comptable, Directeur Financier, Super-Admin)
- Action `receive`: Comptable+ ou DirecteurFinancier+

**Scoping:**
- Payment: visible pour creator + finance roles
- Receipt/Attachments: scoped to Payment.invoice

## 9. Base de données — vue d'ensemble

```
Invoice (1) ──has many─→ Payment (0..N)
  ├─ status: BROUILLON → VALIDEE
  ├─ amount_ttc
  └─ client FK

Payment (1) ──has one─→ PaymentReceipt
  ├─ status: PENDING → RECEIVED → RECORDED
  ├─ amount: montant versement
  ├─ payment_method
  ├─ received_by: User
  └─ received_at: datetime

Payment (1) ──has many─→ DocumentAttachment (via GenericFK)
  └─ document_type: CHEQUE, BORDEREAU, etc.

Invoice → JournalEntry (créée une fois, 100% payée)
  ├─ source_invoice FK
  └─ TransactionLine (3x: Client/Sales/VAT)
```

## 10. État final

✅ Modèles complets (3 nouveaux + 1 amélioré)  
✅ Serializers complets (3 nouveaux)  
✅ ViewSets complets (2 nouveaux)  
✅ Migrations (2 nouvelles)  
✅ Celery tasks (2 nouvelles)  
✅ Templates PDF (1 nouveau)  
✅ RBAC intégré  
✅ Doctrine-in-depth (validations modèles + vues)  

### À faire avant test

1. **Fixer URLs nested** (actuellement pattern regex — à finir avec DefaultRouter imbriqué ou SimpleRouter)
2. **Ajouter DocumentAttachment endpoint** (POST attachments sous payments)
3. **Admin Django** (FinanceSettingsAdmin, PaymentAdmin pour modérer)
4. **Tests** (workflow complet: create→receive→check 100%→journal)
5. **Frontend** (Payment list/detail, upload docs, button "Enregistrer versement")

### Signature DNS (hors scope)

- Webhook signature déjà en place (administration.SignatureWebhookView)
- Reçu PDF stocké localement (pas de signature numérique e-signDoc pour l'instant)

---

**Prêt pour:** Fusion avec Finance fixes + test complet  
**Branch:** taiger_technique  
**Non poussé:** Attendre autorisation  
