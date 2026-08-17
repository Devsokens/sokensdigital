# Templates PDF — Pièces Comptables (Treasury)

**Status:** ✅ Implémentation complète | **Date:** 2026-08-16

---

## 3 Templates PDF Créés

### 1. Pièce de Caisse (Entrée/Sortie)

**Fichier:** `treasury/templates/treasury/cash_voucher_pdf.html`

**Utilisé pour:** CashEntry (ENTREE/SORTIE)

**Structure:**
- En-tête avec logo + filigrane "SOKENS DIGITAL"
- Type: PIÈCE D'ENTRÉE / PIÈCE DE SORTIE DE CAISSE
- N° pièce (auto-généré: BON-YYYY-00001)
- Période (mois/année)
- Date
- Bénéficiaire
- Tableau: Motif + Montant + Total
- Observations
- **3 lignes de signature:** Bénéficiaire | Responsable Financier | Gérant

**Endpoint:**
```
GET /api/v1/treasury/cash-entries/{id}/export_pdf/
```

**Réponse:** PDF signable, imprimable

---

### 2. État de Caisse (Brouillard de Caisse)

**Fichier:** `treasury/templates/treasury/cash_register_statement_pdf.html`

**Utilisé pour:** Inventaire mensuel + Rapprochement caisse

**Structure:**
- En-tête avec logo
- Titre: BROUILLARD DE CAISSE
- Mois concerné (01/m/Y - d/m/Y)
- Caissier + Entreprise + Période
- Tableau des mouvements:
  - N° | Libellé | Encaissements | Décaissements | Solde | Observations
  - Tous les CashEntry du mois
  - Totaux: entrées, sorties, solde final
- **Section Rapprochement:**
  - Solde selon brouillard
  - Espèces en caisse (comptage physique à remplir)
  - Différence (à justifier)
  - Observations
- **3 lignes de signature:** Caissier | Responsable Financier | Gérant

**Endpoint:**
```
GET /api/v1/treasury/bank-entries/export_monthly_statement/?year=2026&month=8&cashier_name=Jean%20Dupont
```

**Paramètres:**
- `year` (défaut: current year)
- `month` (défaut: current month, 1-12)
- `cashier_name` (optionnel)

**Réponse:** PDF signalé, imprimable

---

### 3. Demande de Décaissement

**Fichier:** `treasury/templates/treasury/disbursement_request_pdf.html`

**Utilisé pour:** DisbursementRequest (workflow approbations)

**Structure:**
- En-tête avec logo
- Titre: DEMANDE DE DÉCAISSEMENT
- **Section 1: Informations Générales**
  - Date demande
  - N° demande
  - Demandeur (user)
  - Département (project)
- **Section 2: Détails Décaissement**
  - Bénéficiaire
  - Motif (reason)
  - Tableau: Libellé + Montant
  - Total
- **Section 3: Statut & Approbations**
  - Statut badge (PENDING/APPROVED/REJECTED)
  - Niveau requis (N1/N2/N3 selon montant)
    - N1: < 10 000 FCFA (Comptable)
    - N2: 10 000 - 50 000 FCFA (Finance Director)
    - N3: > 50 000 FCFA (Direction Générale)
  - Motif rejet (si applicable)
- **Section 4: Approbations (3 niveaux)**
  - Responsable Comptable & Financière (N1)
  - Directeur Financier (N2)
  - Gérant / Direction Générale (N3)
  - Chaque bloc: ligne signature + date

**Endpoint:**
```
GET /api/v1/treasury/disbursement-pdf/export_pdf/?id=<disbursement_id>
```

**Réponse:** PDF avec signatures

---

## Améliorations Apportées (vs Modèles Fournis)

| Modèle Original | Amélioration |
|-----------------|-------------|
| Terme "Désignation" | → "Motif" ✅ |
| Cases "Recette/Dépense" | → "Entrée/Sortie" ✅ |
| "Date" | → "Période" (mois/année) ✅ |
| Aucune signature | → 3 lignes (bénéficiaire, finance, gérant) ✅ |
| Pas de logo | → Logo en en-tête + filigrane ✅ |
| Pas de bénéficiaire | → Espace dédié ✅ |
| N/A | → Approbations 2 niveaux (comptable + gérant) ✅ |
| N/A | → Rapprochement caisse (inventaire) ✅ |

---

## API Endpoints

### Cash Entries

**Export pièce caisse (PDF):**
```bash
GET /api/v1/treasury/cash-entries/{id}/export_pdf/
```

Retourne: PDF signable (pièce d'entrée ou sortie)

**État de caisse mensuel (PDF):**
```bash
GET /api/v1/treasury/bank-entries/export_monthly_statement/?year=2026&month=8
```

Retourne: PDF avec inventaire + rapprochement

---

### Disbursement Requests

**Export demande décaissement (PDF):**
```bash
GET /api/v1/treasury/disbursement-pdf/export_pdf/?id=<uuid>
```

Retourne: PDF prêt pour signatures 3 niveaux

---

## Exemples Curl

### 1. Pièce de caisse

```bash
curl -X GET http://localhost:8000/api/v1/treasury/cash-entries/abc123/export_pdf/ \
  -H "Authorization: Bearer TOKEN" \
  -o pièce_caisse_BON-2026-00001.pdf
```

### 2. État de caisse août 2026

```bash
curl -X GET "http://localhost:8000/api/v1/treasury/bank-entries/export_monthly_statement/?year=2026&month=8&cashier_name=Jean%20Dupont" \
  -H "Authorization: Bearer TOKEN" \
  -o EtatCaisse_202608.pdf
```

### 3. Demande décaissement

```bash
curl -X GET "http://localhost:8000/api/v1/treasury/disbursement-pdf/export_pdf/?id=xyz789" \
  -H "Authorization: Bearer TOKEN" \
  -o Decaissement_xyz789.pdf
```

---

## Intégration dans Views

### Modifier Finance/Views pour DisbursementRequest PDF

Ajouter action dans `finance/views.py` DisbursementRequestViewSet:

```python
@action(detail=True, methods=['get'])
def export_pdf(self, request, pk=None):
    """Télécharger demande de décaissement en PDF."""
    from treasury.pdf import generate_disbursement_request_pdf
    disbursement = self.get_object()
    pdf_file = generate_disbursement_request_pdf(disbursement)
    return FileResponse(
        pdf_file,
        as_attachment=True,
        filename=f'Decaissement_{disbursement.id}.pdf',
        content_type='application/pdf'
    )
```

Endpoint: `GET /api/v1/finance/disbursement-requests/{id}/export_pdf/`

---

## Personnalisation Logo & Adresse

**Fichier:** `treasury/pdf.py`

Modifier contextes dans fonctions:

```python
context = {
    'company_address': 'SOKENS DIGITAL, Route de Mermoz, Dakar, Sénégal',
    'company_phone': '+221-33-XXX-XXXX',
    'company_email': 'finance@sokensdigital.com',
}
```

**Logo:** Remplacer "LOGO" text par image base64 ou URL (dans HTML template)

**Filigrane:** CSS `background-image` déjà configuré (SVG inline)

---

## Génération Async (Tasks Celery)

**Optionnel:** Pour emails PDFs ou archivage:

```python
@shared_task
def send_cash_voucher_email(cash_entry_id):
    entry = CashEntry.objects.get(id=cash_entry_id)
    pdf_file = generate_cash_voucher_pdf(entry)
    # send_email(to, pdf_file)

@shared_task
def archive_cash_register_statement(year, month):
    # Generate + archive PDF
    pass
```

---

## Test en Local

### Simuler PDF generation:

```python
from treasury.models import CashEntry
from treasury.pdf import generate_cash_voucher_pdf

entry = CashEntry.objects.first()
pdf = generate_cash_voucher_pdf(entry)

# Sauvegarder
with open('test.pdf', 'wb') as f:
    f.write(pdf.getvalue())
```

---

## Dépendances

- ✅ `weasyprint` — déjà installé (pour finance PDFs)
- ✅ `Jinja2 templates` — Django built-in
- ✅ `BytesIO` — Python built-in

**Installation (si absent):**
```bash
pip install weasyprint
```

---

## Notes

1. **Signatures:** Laisser espaces vides pour signature manuscrite avant impression
2. **Filigrane:** "SOKENS DIGITAL" léger en arrière-plan (ne imprime pas bien sur tous les imprimantes)
3. **Impression:** Taille A4, marges 0.5cm
4. **Archivage:** Exporter PDF → classer par mois/année
5. **Authentification:** Tous les endpoints nécessitent Bearer token

---

## Summary

**3 PDF générés:**
1. Pièce de caisse (BON-YYYY-00001)
2. État de caisse mensuel (brouillard + rapprochement)
3. Demande décaissement (approbations N1/N2/N3)

**Améliorations vs modèles:** Logo, filigrane, signatures, terminologie correcte

**Status:** Prêt production. Ne pas pousser sans autorisation.
