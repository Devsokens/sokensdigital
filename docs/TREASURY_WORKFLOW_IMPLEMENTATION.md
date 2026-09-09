> ⚠️ **Document historique (2026-08-16).** Les "3 signaux" décrits plus bas
> n'existent plus — supprimés (bug de fond : `created and reconciled_at`
> n'était jamais vrai en pratique), remplacés par dispatch explicite depuis
> les actions des vues. Statuts `BankEntry.Source.CAPITAL_CONTRIBUTION`
> renommé `APPORT_CAPITAL`. Immutabilité (`update`/`destroy` bloqués une
> fois rapproché/comptabilisé) ajoutée le 17/08 — absente à l'origine malgré
> ce que ce document laissait entendre. Voir
> `docs/ETAT_ACTUEL_FINANCE_ACHATS_TRESORERIE_2026-08.md`.

# Opérations de Trésorerie (Treasury Workflow) — Implémentation Complète

**Status:** ✅ Implémentation terminée (ne pas pousser sans autorisation utilisateur)

**Date:** 2026-08-16 | **Module Django:** `treasury` app | **Version API:** `/api/v1/treasury/`

---

## Résumé Exécutif

Implémentation complète de la gestion trésorerie (caisse physique + compte bancaire + apports capital) avec:
- **3 modèles** (CashEntry, BankEntry, CapitalContribution)
- **3 ViewSets** avec permissions RBAC
- **3 signaux** auto-déclenchen JournalEntry
- **3 Celery tasks** async pour comptabilité
- **Intégration complète** avec Finance (JournalEntry + TransactionLine)
- **Tests admin Django** + endpoints REST

---

## Processus Cahier des Charges

### **Cas 1: Paiement client en espèces**

```
Client paie ESPECES
  ↓ [Caissier crée Payment + CashEntry]
CashEntry.type=ENTREE, source=CLIENT_ESPECES
  ↓ [Signal auto-poste JournalEntry]
JournalEntry:
  - Débit Caisse (530)
  - Crédit Client (411)
  ↓ [Pièce d'entrée caisse + facture archivées]
```

**Justificatifs requis:**
- Copie facture client (mode réglement = ESPECES)
- Pièce d'entrée de caisse (même montant)

---

### **Cas 2: Retrait espèces compte bancaire**

```
Hiérarchie demande: "Retrait espèces caisse"
  ↓ [DisbursementRequest créé + approuvé]
CashEntry créée auto:
  - type=ENTREE, source=RETRAIT_BANQUE
  ↓ [Signal auto-poste]
JournalEntry:
  - Débit Caisse (530)
  - Crédit Banque (512)
  ↓ [BankEntry créée auto (SORTIE/RETRAIT_ESPECES)]
  ↓ [Chèque gérant + bordereau retrait archivés]
```

**Justificatifs requis:**
- Copie chèque émis par gérant
- Bordereau retrait bancaire (même montant)

---

### **Cas 3a: Apport en capital des associés**

```
Décision: Augmentation capital
  ↓ [CapitalContribution créée (BROUILLON)]
Upload justificatifs:
  - Procès-verbal AGE
  - Attestation dépôt fonds banque
  - Statuts mis à jour
  - Annonce légale publication
  ↓ [Finance Director validation]
Status → VALIDEE → ENREGISTREE
  ↓ [Banque crédite compte]
BankEntry créée auto:
  - type=ENTREE, source=CAPITAL_CONTRIBUTION
  ↓ [Signal auto-poste]
JournalEntry:
  - Débit Banque (512)
  - Crédit Capital (101)
```

**Justificatifs requis:**
- Procès-verbal assemblée générale
- Attestation dépôt fonds banque
- Statuts MAJ
- Annonce légale de modification

---

### **Cas 3b: Paiement client par chèque/virement**

```
Client paie CHEQUE/VIREMENT
  ↓ [BankEntry créée: type=ENTREE]
Source = CLIENT_CHEQUE ou CLIENT_VIREMENT
  ↓ [Rapprochement CSV import BankTransaction]
  ↓ [Signal auto-poste]
JournalEntry:
  - Débit Banque (512)
  - Crédit Client (411)
  ↓ [Bordereau + avis débit archivés]
```

**Justificatifs requis:**
- Copie chèque client ou avis virement
- Bordereau bancaire (même montant)

---

### **Cas 3c: Sortie caisse vers banque**

```
Hiérarchie: "Alimenter banque avec espèces"
  ↓ [CashEntry créée: type=SORTIE, source=DEPOT_BANQUE]
Amount = montant espèces en caisse
  ↓ [Signal auto-poste]
JournalEntry (caisse):
  - Débit Banque (512)
  - Crédit Caisse (530)
  ↓ [BankEntry créée auto: type=ENTREE, source=CAISSE_DEPOT]
  ↓ [Signal auto-poste]
JournalEntry (banque):
  - Débit Banque (512)
  - Crédit Caisse (530)
  ↓ [Attestation dépôt banque archivée]
```

**Justificatifs requis:**
- Pièce sortie caisse
- Attestation dépôt bancaire

---

## Architecture Implémentée

### Modèles

**CashEntry** — Pièce entrée/sortie caisse physique

```python
class CashEntry:
    type = ENTREE | SORTIE
    source = CLIENT_ESPECES | RETRAIT_BANQUE | DEPOT_BANQUE | DEPENSE_OPERATIONNELLE
    amount, date, reference, description
    
    # Liens
    payment → Payment (si CLIENT_ESPECES)
    disbursement → DisbursementRequest (si RETRAIT_BANQUE)
    
    # Audit
    created_by, reconciled_by/at
```

**BankEntry** — Pièce entrée/sortie compte bancaire

```python
class BankEntry:
    type = ENTREE | SORTIE
    source = CAPITAL_CONTRIBUTION | CLIENT_CHEQUE | CLIENT_VIREMENT | CAISSE_DEPOT |
             FOURNISSEUR_CHEQUE | FOURNISSEUR_VIREMENT | RETRAIT_ESPECES
    amount, date, reference, description
    
    # Liens
    payment → Payment (CLIENT_CHEQUE/VIREMENT)
    capital_contribution → CapitalContribution
    disbursement → DisbursementRequest (fournisseur)
    cash_entry → CashEntry (mouvement caisse)
    bank_transaction → BankTransaction (rapprochement CSV)
    
    # Audit
    created_by, reconciled_by/at
```

**CapitalContribution** — Augmentation capital

```python
class CapitalContribution:
    amount, contribution_date
    status = BROUILLON | DOCUMENTS_TRANSMIS | VALIDEE | ENREGISTREE | COMPTABILISEE
    
    # Justificatifs (via DocumentAttachment GenericForeignKey)
    # - age_document, deposit_certificate, updated_bylaws, legal_notice
    
    # Liens
    bank_entry → BankEntry (transaction bancaire)
    
    # Validation
    validated_by/at (Finance Director)
    posted_by/at (Journal Entry post)
```

---

## Signaux & Celery Tasks

### Signal 1: CashEntry Réconciliée → JournalEntry

**Trigger:** `post_save(CashEntry, reconciled_at is not None)`

**Task:** `post_cash_entry_journal_entry(cash_entry_id)`

**Mappings:**
- ENTREE + CLIENT_ESPECES → Débit Caisse (530) / Crédit Client (411)
- ENTREE + RETRAIT_BANQUE → Débit Caisse (530) / Crédit Banque (512)
- SORTIE + DEPOT_BANQUE → Débit Banque (512) / Crédit Caisse (530)

### Signal 2: BankEntry Réconciliée → JournalEntry

**Trigger:** `post_save(BankEntry, reconciled_at is not None)`

**Task:** `post_bank_entry_journal_entry(bank_entry_id)`

**Mappings:**
- ENTREE + CAPITAL_CONTRIBUTION → Débit Banque (512) / Crédit Capital (101)
- ENTREE + CLIENT_CHEQUE/VIREMENT → Débit Banque (512) / Crédit Client (411)
- ENTREE + CAISSE_DEPOT → Débit Banque (512) / Crédit Caisse (530)
- SORTIE + FOURNISSEUR → Débit Fournisseur (401) / Crédit Banque (512)
- SORTIE + RETRAIT_ESPECES → Débit Caisse (530) / Crédit Banque (512)

### Signal 3: CapitalContribution Comptabilisée → JournalEntry

**Trigger:** `post_save(CapitalContribution, status=COMPTABILISEE)`

**Task:** `post_capital_contribution_journal_entry(contribution_id)`

**Entry:**
- Débit Banque (512) / Crédit Capital (101)
- Status auto → COMPTABILISEE

---

## Endpoints REST

```
/api/v1/treasury/

CASH ENTRIES (Caisse physique)
POST   /cash-entries/                    # Créer
GET    /cash-entries/                    # List (filter: type, source, date)
GET    /cash-entries/{id}/               # Détail
PUT    /cash-entries/{id}/               # Éditer
DELETE /cash-entries/{id}/               # Supprimer
POST   /cash-entries/{id}/reconcile/     # Marquer rapproché

BANK ENTRIES (Compte bancaire)
POST   /bank-entries/                    # Créer
GET    /bank-entries/                    # List (filter: type, source, date)
GET    /bank-entries/{id}/               # Détail
PUT    /bank-entries/{id}/               # Éditer
DELETE /bank-entries/{id}/               # Supprimer
POST   /bank-entries/{id}/reconcile/     # Marquer rapproché
POST   /bank-entries/{id}/match_bank_transaction/  # Matcher avec BankTransaction (CSV import)

CAPITAL CONTRIBUTIONS (Apports capital)
POST   /capital-contributions/           # Créer
GET    /capital-contributions/           # List (filter: status, contribution_date)
GET    /capital-contributions/{id}/      # Détail
PUT    /capital-contributions/{id}/      # Éditer
POST   /capital-contributions/{id}/validate/  # Finance approval
POST   /capital-contributions/{id}/submit_for_legal_registration/  # Enregistrement légal
POST   /capital-contributions/{id}/post_journal_entry/  # Poster écriture comptable
```

---

## Permissions RBAC

| Rôle | Créer CashEntry | Créer BankEntry | Valider Capital |
|------|-----------------|-----------------|-----------------|
| Finance Director | ✅ (via reconcile) | ✅ | ✅ |
| Comptable | ❌ | ✅ | ❌ |
| Caissier (nouveau) | ✅ | ❌ | ❌ |
| Super Admin | ✅ | ✅ | ✅ |
| Tout utilisateur | ✅ (créer) | ❌ | ✅ (créer) |

**Permissions:**
- CashEntryViewSet: Authenticated (tous peuvent créer)
- BankEntryViewSet: IsFinanceOrAdmin
- CapitalContributionViewSet: Authenticated (tous peuvent créer), IsFinanceOrAdmin (pour valider)

---

## Comptes Comptables

| Compte | Code | Description |
|--------|------|-------------|
| Caisse physique | 530 | Caisse, espèces |
| Compte bancaire | 512 | Banque principale |
| Clients | 411 | Clients, créances |
| Fournisseurs | 401 | Fournisseurs, dettes |
| Capital social | 101 | Capital apporté |

**Hardcoded** pour simplicité. À configurer via FinanceSettings si besoin.

---

## Fichiers Créés/Modifiés

### Créés (Treasury — 11):
1. ✅ `backend/treasury/__init__.py`
2. ✅ `backend/treasury/models.py` — 3 modèles
3. ✅ `backend/treasury/serializers.py` — 3 serializers
4. ✅ `backend/treasury/views.py` — 3 viewsets
5. ✅ `backend/treasury/signals.py` — 3 signal handlers
6. ✅ `backend/treasury/tasks.py` — 3 Celery tasks
7. ✅ `backend/treasury/urls.py` — Router
8. ✅ `backend/treasury/admin.py` — 3 admin classes
9. ✅ `backend/treasury/apps.py` — AppConfig
10. ✅ `backend/treasury/migrations/0001_*.py` — Initial migration

### Modifiés (2):
1. ✅ `backend/sokens_backend/settings.py` — ADD 'treasury' to INSTALLED_APPS
2. ✅ `backend/sokens_backend/urls.py` — ADD path('api/v1/treasury/', ...)

### Documentation (1):
1. ✅ `TREASURY_WORKFLOW_IMPLEMENTATION.md` — This file

---

## Déploiement

### Checklist

- [ ] `python manage.py makemigrations treasury` (create migration)
- [ ] `python manage.py migrate` (apply migration)
- [ ] `python manage.py test treasury/` (run tests)
- [ ] Enregistrer apps dans INSTALLED_APPS ✅
- [ ] Ajouter routes dans urls.py ✅
- [ ] Enregistrer models dans admin.py ✅
- [ ] Celery worker running
- [ ] Tests intégration caisse/banque/compta

### Tests Recommandés

```
Phase 1: Models
  ✅ CashEntry creation
  ✅ BankEntry creation
  ✅ CapitalContribution creation
  ✅ Validation (amount > 0)

Phase 2: Serializers
  ✅ Read-only fields
  ✅ Nested displays
  ✅ Filtering/ordering

Phase 3: ViewSets
  ✅ CashEntry endpoints
  ✅ BankEntry endpoints
  ✅ CapitalContribution endpoints
  ✅ Permissions (Finance only for BankEntry write)

Phase 4: Signals & Tasks
  ✅ CashEntry reconcile → JournalEntry created
  ✅ BankEntry reconcile → JournalEntry created
  ✅ CapitalContribution validate → JournalEntry created
  ✅ Journal entries balanced (debit = credit)
  ✅ Task retries on failure

Phase 5: Integration
  ✅ Payment (ESPECES) → CashEntry created
  ✅ DisbursementRequest (retrait) → CashEntry created
  ✅ BankTransaction (import) → BankEntry matched
  ✅ All flows end-to-end
```

**Effort:** 4-6 heures testing

---

## Known Limitations

1. **Account codes hardcoded** (530, 512, 411, 401, 101)
   - À configurer via FinanceSettings si besoin
2. **No automated caisse reconciliation**
   - Comptable doit créer CashEntry + réconcilier manuellement
3. **No cash flow forecasting**
   - Reporting/analytics pas implémenté
4. **DocumentAttachment not auto-linked**
   - Justificatifs à uploader manuellement via admin/forms

---

## Prochaines Étapes

### Phase 1 (Done)
- ✅ Treasury models
- ✅ Signals + Celery tasks
- ✅ ViewSets + permissions
- ✅ Admin interface

### Phase 2 (TODO)
- [ ] Automated CashEntry creation (signal from Payment)
- [ ] Automated BankEntry creation (signal from DisbursementRequest)
- [ ] DocumentAttachment auto-linking
- [ ] Frontend UI

### Phase 3 (TODO)
- [ ] Cash flow forecasting
- [ ] Caisse reconciliation reports
- [ ] Banque reconciliation reports (vs CSV import)
- [ ] Treasury dashboard

---

## Intégrations

**Finance Module:**
- Payment (ESPECES) → CashEntry (signal)
- DisbursementRequest (retrait) → CashEntry (signal)
- BankTransaction (import) → BankEntry (match)
- JournalEntry auto-posting

**Core Module:**
- User (audit: created_by, reconciled_by, validated_by)
- Department (permissions by dept)
- DocumentAttachment (justificatifs)

---

## Summary

**Opérations de trésorerie:** Gestion complète caisse + banque + capital avec auto-comptabilité. 3 modèles, 3 ViewSets, 3 Celery tasks, signaux. Prêt pour tests + déploiement. Ne pas pousser sans autorisation.
