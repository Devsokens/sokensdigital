# Audit Logique Métier — Procurement / Treasury / Finance

**Date:** 2026-08-16 | **Scope:** Tout code ajouté depuis merge `97870e0` (commits `3fb6d58`, `c812a88`)
**Méthode:** Lecture croisée modèles réels vs code qui les consomme (tasks, signals, views) dans les 3 apps.

**Verdict global : le code ne compile pas logiquement à l'exécution.** Les tâches d'auto-comptabilisation (le cœur de la valeur ajoutée des 3 derniers passes) ne fonctionneront jamais telles quelles — elles référencent des champs et des chemins d'import qui n'existent pas dans le codebase réel. Ce n'est pas un problème de style, c'est un problème de fait : personne n'a vérifié le schéma `finance.models` avant d'écrire `procurement/tasks.py` et `treasury/tasks.py`.

---

## 🔴 CRITIQUE — Casse le démarrage / crash garanti à l'exécution

### C1. Import `core.utils.safe_dispatch` — module inexistant

**Fichiers:** `backend/procurement/tasks.py:9`, `backend/treasury/tasks.py:9`

```python
from core.utils import safe_dispatch
```

`core/utils.py` **n'existe pas**. La fonction réelle vit dans `core/celery_utils.py` (vérifié: `grep def safe_dispatch` → 1 seul résultat, ce fichier).

**Impact:** `apps.py.ready()` de `procurement` et `treasury` importe `signals.py`, qui importe `tasks.py`, qui plante à l'import avec `ModuleNotFoundError`. **Django ne démarre pas** dès que ces deux apps sont dans `INSTALLED_APPS` — ce qui est déjà le cas (`settings.py` modifié dans le même commit).

**Gravité:** Le serveur ne boot pas en l'état. C'est la faille la plus grave — tout le reste est théorique tant que celle-ci n'est pas corrigée.

**Fix:**
```python
from core.celery_utils import safe_dispatch
```
Et l'utiliser réellement (voir C5 — actuellement importé mais jamais appelé, `.delay()` est appelé en direct dans les signaux).

---

### C2. `TransactionLine.objects.create()` avec des champs qui n'existent pas

**Fichiers:** `backend/procurement/tasks.py` (3 appels), `backend/treasury/tasks.py` (12 appels)

Modèle réel (`finance/models.py:169-190`):
```python
class TransactionLine(LoggedModel):
    entry = FK(JournalEntry)
    account = FK(Account)      # ← FK vers objet Account, pas une string
    label = CharField
    debit = DecimalField
    credit = DecimalField
    lettrage_code = CharField
```

Code écrit dans les tasks (exemple treasury):
```python
TransactionLine.objects.create(
    entry=journal_entry,
    account_code=account_cash,      # ❌ champ n'existe pas
    account_name='Caisse physique', # ❌ champ n'existe pas
    debit=entry.amount,
    credit=Decimal('0'),
    line_description='...'          # ❌ champ n'existe pas (le vrai champ s'appelle `label`)
)
```

**Impact:** `TypeError: TransactionLine() got unexpected keyword arguments`. Chaque appel plante. Aucune écriture comptable auto-générée par procurement/treasury ne peut jamais aboutir.

**Preuve que le pattern correct existe déjà dans le codebase** (`finance/views.py:303-317`, `InvoiceViewSet.validate`) :
```python
client_account, _ = Account.objects.get_or_create(code='411', defaults={'name': 'Clients', 'account_class': Account.AccountClass.ACTIF})
TransactionLine.objects.create(entry=entry, account=client_account, label=invoice.client_name, debit=..., credit=...)
```
Ce code — écrit avant mes passes — utilise `Account.objects.get_or_create(code=...)` puis passe l'objet FK. Les tasks procurement/treasury auraient dû suivre exactement ce pattern.

**Fix:** réécrire chaque `TransactionLine.objects.create()` pour résoudre un objet `Account` via `get_or_create(code=...)` puis passer `account=<objet>`, `label=<description>` — pas de champs `_code`/`_name`/`_description`.

---

### C3. `JournalEntry.objects.create()` avec des champs qui n'existent pas

**Fichier:** `backend/procurement/tasks.py:69-77` (`post_supplier_invoice_journal_entry`)

Modèle réel (`finance/models.py:134-152`):
```python
class JournalEntry(LoggedModel):
    period = FK(AccountingPeriod)   # obligatoire, non-null
    journal_code = CharField(choices=...)
    date = DateField
    label = CharField
    created_by = FK(User)
    source_invoice = FK(Invoice, null=True)
```

Code écrit:
```python
journal_entry = JournalEntry.objects.create(
    reference=f'FAC-{invoice.invoice_number}',   # ❌ n'existe pas
    description=f'...',                           # ❌ n'existe pas (le vrai champ = label)
    amount_ht=invoice.amount_ht,                  # ❌ n'existe pas (JournalEntry n'a pas de montant, c'est les lignes qui portent le montant)
    amount_ttc=invoice.amount_ttc,                # ❌ n'existe pas
    vat_rate=invoice.vat_rate,                    # ❌ n'existe pas
    related_content_type=None,                    # ❌ n'existe pas
    related_object_id=str(invoice.id),            # ❌ n'existe pas
)
# `period` (obligatoire) n'est même pas fourni → IntegrityError même si les kwargs invalides étaient tolérés
```

**Impact:** crash immédiat, en plus double bug (champs fantômes + champ obligatoire manquant).

**Fix:** aligner sur le pattern `treasury/tasks.py`'s propres fonctions `post_cash_entry_journal_entry`/`post_bank_entry_journal_entry`, qui elles récupèrent bien `period` via `AccountingPeriod.objects.get(...)` — mais qui ont elles-mêmes le bug C2 sur les lignes. Il faut corriger les deux strates en même temps (JournalEntry ET TransactionLine) dans les 3 tasks concernées.

---

### C4. `DisbursementRequest.objects.create()` — champ inexistant + valeur enum inexistante

**Fichier:** `backend/procurement/tasks.py:27-32` (`create_disbursement_request_task`)

Modèle réel (`finance/models.py:16-77`):
```python
class DisbursementRequest(LoggedModel):
    project = FK(Project, null=True)
    requested_by = FK(User, null=True)
    amount = DecimalField
    beneficiary = CharField        # requis, pas de default
    reason = TextField             # requis, pas de default
    status = CharField(choices=Status)  # défaut EN_ATTENTE_N1
    # Status: EN_ATTENTE_N1 | EN_ATTENTE_N2 | EN_ATTENTE_N3 | APPROUVE | REJETE | EXECUTE
    # Pas de "PENDING" dans les choices.
```

Code écrit:
```python
disbursement = DisbursementRequest.objects.create(
    amount=quote.amount_ttc,
    description=f'...',                              # ❌ champ n'existe pas (le vrai = reason)
    procurement_quote=quote,                          # ❌ champ n'existe pas
    status=DisbursementRequest.Status.PENDING,        # ❌ valeur enum n'existe pas → AttributeError avant même le create()
)
# beneficiary jamais fourni (requis)
# reason jamais fourni (requis, "description" utilisé à la place n'existe pas côté modèle)
```

**Impact:** `AttributeError: type object 'Status' has no attribute 'PENDING'` — plante avant même d'atteindre le `.create()`. Même corrigé, `procurement_quote=` ferait planter avec `TypeError`.

**Conflit de logique plus grave que le crash lui-même (voir H2 ci-dessous)** : même réécrit correctement, ce code contournerait le mécanisme `initial_status_for_amount()` qui route un décaissement vers N1/N2/N3 selon le montant (§4.3 cahier des charges) — un devis fournisseur validé pourrait déclencher un décaissement pré-approuvé sans passer par la moindre validation humaine.

**Fix minimal (fait fonctionner sans compromettre la sécurité) :**
```python
disbursement = DisbursementRequest.objects.create(
    amount=quote.amount_ttc,
    beneficiary=quote.supplier.name,
    reason=f'Décaissement devis {quote.quote_number} — {quote.supplier.name}',
    status=DisbursementRequest.initial_status_for_amount(quote.amount_ttc),
    requested_by=quote.manager_validated_by,  # ou l'auteur du devis — à définir avec le métier
)
```
Ainsi le décaissement généré automatiquement rentre dans le même circuit d'approbation N1/N2/N3 que tout décaissement manuel — pas de porte dérobée.

---

### C5. `FinanceSettings` — champs référencés qui n'existent pas, masqués par un `except:` nu

**Fichier:** `backend/procurement/tasks.py:56-66`

```python
try:
    from finance.models import FinanceSettings
    settings = FinanceSettings.load()
    account_purchases = settings.default_account_purchases or '601'        # ❌ n'existe pas
    account_vat_deductible = settings.default_account_vat_deductible or '4456'  # ❌ n'existe pas
    account_supplier = settings.default_account_supplier or '401'          # ❌ n'existe pas
except:
    account_purchases = '601'
    account_vat_deductible = '4456'
    account_supplier = '401'
```

Modèle réel (`finance/models.py:396-419`) n'a que `default_client_account_code`, `default_sales_account_code`, `default_vat_collected_account_code` — rien pour achats/TVA déductible/fournisseur.

**Double problème :**
1. Un `except:` nu (bare except) avale **toute** exception, pas seulement `AttributeError` — masque silencieusement n'importe quel bug futur dans ce bloc, y compris de vraies pannes DB. Anti-pattern de sécurité/observabilité classique.
2. Le fait que ça "marche quand même" (fallback vers les valeurs en dur) cache que **le modèle `FinanceSettings` n'a jamais été étendu** pour couvrir le besoin achats — alors que `default_client_account_code` existe côté ventes. Incohérence de conception: la config comptable est à moitié centralisée (ventes) et à moitié en dur dans le code (achats, caisse, banque, capital — tous les comptes 530/512/101/401/4456 sont hardcodés dans `treasury/tasks.py` et `procurement/tasks.py`).

**Fix:** étendre `FinanceSettings` avec les comptes manquants (`default_purchases_account_code`, `default_vat_deductible_account_code`, `default_supplier_account_code`, `default_cash_account_code`, `default_bank_account_code`, `default_capital_account_code`), migration à l'appui, et remplacer `except:` par `except FinanceSettings.DoesNotExist:` (qui ne peut de toute façon pas se produire vu que `.load()` fait un `get_or_create`).

---

## 🟠 HAUTE — Le code "marche" mais ne fait jamais ce qu'il prétend faire

### H1. Le signal de réconciliation `treasury` ne se déclenche JAMAIS via le flux réel

**Fichier:** `backend/treasury/signals.py:11-31`

```python
@receiver(post_save, sender=CashEntry)
def on_cash_entry_created(sender, instance, created, **kwargs):
    if created and instance.reconciled_at is not None:
        post_cash_entry_journal_entry.delay(str(instance.id))
```

Mais le flux réel (`treasury/views.py`, action `reconcile`) est :
```python
def reconcile(self, request, pk=None):
    entry = self.get_object()          # entrée déjà existante
    entry.reconciled_by = request.user
    entry.reconciled_at = timezone.now()
    entry.save()                       # ← UPDATE, donc created=False
```

`created` est `True` uniquement au tout premier `.save()` (celui fait par `perform_create`, où `reconciled_at` est encore `None` par défaut). Le `.save()` qui pose `reconciled_at` est un `UPDATE` → `created=False` → la condition `created and reconciled_at is not None` **n'est jamais vraie** dans le cycle de vie normal d'un `CashEntry`/`BankEntry`.

**Impact:** même une fois C1-C2-C3 corrigés, **aucune écriture comptable ne sera jamais auto-postée** pour la caisse/banque via l'API REST normale. Le signal est du code mort déguisé en fonctionnalité.

**Fix:** retirer la condition sur `created`, déclencher sur tout `post_save` où `reconciled_at` vient d'être renseigné (comparer à l'état précédent, ou plus simplement déclencher directement l'appel de la task **depuis l'action `reconcile()` elle-même** dans `views.py`, pas via signal — plus explicite, plus facile à tester, évite tout ce genre de piège `created`/`updated`):
```python
@action(detail=True, methods=['post'], permission_classes=[IsFinanceOrAdmin])
def reconcile(self, request, pk=None):
    entry = self.get_object()
    entry.reconciled_by = request.user
    entry.reconciled_at = timezone.now()
    entry.save()
    safe_dispatch(post_cash_entry_journal_entry, str(entry.id))
    return Response(self.get_serializer(entry).data)
```
Supprimer le signal correspondant (source de confusion — deux mécanismes qui se ressemblent, un seul qui marche).

---

### H2. Auto-décaissement procurement contourne le circuit d'approbation N1/N2/N3

Déjà signalé en C4 mais c'est un problème de **logique métier**, pas juste de syntaxe : le cahier des charges (§4.3, déjà implémenté et respecté ailleurs dans `finance/models.py`/`finance/views.py`) impose que tout décaissement passe par un palier d'approbation dépendant du montant — sauf que `create_disbursement_request_task` (déclenché automatiquement dès qu'un Manager valide un devis fournisseur) ne fait **aucun appel** à `initial_status_for_amount()`. Même corrigé pour ne plus crasher, si on lui donne un statut fixe au lieu de calculer le palier, un devis de 200 000 FCFA génère un décaissement qui saute la validation N3 (Direction Générale).

**Ce n'est pas juste un bug — c'est une brèche de contrôle financier** si elle passe inaperçue en prod: n'importe quel Manager RCF (rôle qui peut valider un devis, cf `procurement/views.py IsManagerOrAdmin`) pourrait indirectement faire approuver un paiement fournisseur de n'importe quel montant sans que le Directeur Financier ou le Super-Admin ne soit jamais sollicité.

**Fix:** voir C4 — utiliser `initial_status_for_amount(quote.amount_ttc)`, et documenter dans le docstring de `SupplierQuote.validate_manager` (procurement/views.py) que la validation du devis ne vaut *pas* autorisation de paiement, seulement ouverture d'une demande qui repart dans le circuit normal.

---

### H3. Deux modèles distincts pour le même document "pièce de caisse"

**Fichiers:** `backend/procurement/models.py` (`CashVoucher`) vs `backend/treasury/models.py` (`CashEntry`)

Le cahier des charges décrit **une seule** notion de "pièce de caisse" (§3, images fournies par l'utilisateur : "Pièce de caisse" avec Recette/Dépense). Deux modèles Django indépendants la représentent maintenant :

| | `procurement.CashVoucher` | `treasury.CashEntry` |
|---|---|---|
| Type | RECEIPT / VOUCHER | ENTREE / SORTIE |
| Source | (aucun champ dédié) | 4 valeurs enum (CLIENT_ESPECES, RETRAIT_BANQUE, DEPOT_BANQUE, DEPENSE_OPERATIONNELLE) |
| Numérotation | `BON-YYYY-00001` | (aucune — pas de numéro auto!) |
| Lien décaissement | OneToOne `DisbursementRequest` | FK `DisbursementRequest` |
| PDF export | non | oui (`treasury/pdf.py` + template `cash_voucher_pdf.html`) |

**Conséquence pratique:** selon que la caisse est mouvementée depuis le workflow achats (procurement crée un `CashVoucher` lors d'un paiement fournisseur en espèces, en théorie) ou depuis le workflow trésorerie pur (treasury crée un `CashEntry` pour un encaissement client), **deux tables SQL différentes, sans lien entre elles**, prétendent tenir le solde de caisse. Un état de caisse mensuel (`export_monthly_statement`, `treasury/views.py`) n'interroge que `CashEntry` — il **ignore silencieusement** tout mouvement passé par `CashVoucher`. Le brouillard de caisse sera faux dès qu'un paiement fournisseur cash existe.

**Fix recommandé:** fusionner en un seul modèle. Le plus simple: supprimer `procurement.CashVoucher`, faire pointer les besoins procurement (paiement fournisseur en espèces) vers `treasury.CashEntry` avec une nouvelle valeur `Source.FOURNISSEUR_ESPECES`, et donner à `treasury.CashEntry` un numéro de pièce auto-généré unifié (`PC-YYYY-00001`) qui serve pour caisse ET pour l'export PDF déjà écrit dans `treasury/pdf.py`. Un seul modèle = un seul solde = un seul état de caisse fiable.

---

### H4. Triple enregistrement non-synchronisé du même événement de décaissement

Sur `finance.DisbursementRequest`, trois relations inverses distinctes peuvent chacune prétendre représenter "l'exécution" du même décaissement :
- `procurement.CashVoucher.disbursement` (OneToOne, `related_name='cash_voucher'`)
- `treasury.CashEntry.disbursement` (FK, `related_name='cash_entries'`)
- `treasury.BankEntry.disbursement` (FK, `related_name='bank_entries'`)

Aucun code n'empêche qu'un même `DisbursementRequest` finisse avec un `CashVoucher` **et** un `CashEntry` **et** un `BankEntry` créés indépendamment (ou aucun des trois). `DisbursementRequest.execute()` (`finance/views.py:151-162`, le seul point qui marque un décaissement `EXECUTE`) ne crée **aucun** de ces trois enregistrements — il se contente de poser `executed_by`/`executed_at`. La création de la pièce justificative (caisse ou banque) est entièrement manuelle et déconnectée du passage à `EXECUTE`.

**Fix:** faire de `execute()` (finance/views.py) le point d'entrée unique qui crée la pièce trésorerie correspondante (via un service partagé, pas un signal implicite), au lieu de laisser 3 chemins parallèles non coordonnés.

---

### H5. Résolution de la période comptable incohérente entre code ancien et nouveau

`finance/views.py InvoiceViewSet.validate` (code pré-existant, correct) :
```python
period = AccountingPeriod.objects.filter(
    start_date__lte=invoice.issue_date, end_date__gte=invoice.issue_date,
    status=AccountingPeriod.Status.OUVERTE,
).first()
```
→ trouve la période **qui couvre la date du document**, tolère 0 ou plusieurs résultats proprement (`.first()`).

`treasury/tasks.py` (nouveau code, x3 occurrences) :
```python
period = AccountingPeriod.objects.get(status=AccountingPeriod.Status.OUVERTE)
```
→ ignore complètement la date du mouvement, prend "la" période ouverte — et **plante avec `MultipleObjectsReturned`** si plus d'une période est ouverte simultanément (rien dans `AccountingPeriod` ne l'empêche), ou `DoesNotExist` sinon (déjà catché, mais le `MultipleObjectsReturned` lui ne l'est pas).

**Fix:** aligner `treasury/tasks.py` sur le pattern `finance/views.py` — filtrer par date du mouvement + `.first()`, pas `.get()` global.

---

### H6. Rôle "Caissier" documenté mais jamais implémenté — CashEntryViewSet inaccessible à qui devrait l'utiliser

`TREASURY_WORKFLOW_IMPLEMENTATION.md` (que j'ai écrit moi-même dans le pass précédent) décrit : *"Caissier: peut créer CashEntry"*. Or `core/constants.py` n'a pas de rôle Caissier, et suite au fix sécurité du tour précédent, `CashEntryViewSet.permission_classes = [IsAuthenticated, IsFinanceOrAdmin]` — **seuls Directeur Financier / Super-Admin peuvent créer une pièce de caisse**, personne d'autre. La doc décrit un rôle qui n'existe pas et un accès qui contredit le code réellement en place.

**Ce n'est pas un problème de sécurité (le fix RBAC était correct — mieux vaut trop restrictif que trop permissif)**, c'est un problème de **cohérence produit** : soit on crée le rôle Caissier et on l'ajoute aux permissions, soit on assume que c'est le Directeur Financier qui tient la caisse et on corrige la doc + les 3 lignes de signature des PDF ("Bénéficiaire | Responsable Financier | Gérant" — pas de ligne "Caissier" cohérente avec ce choix).

**Fix:** décision produit à trancher avec l'utilisateur — soit ajouter `ROLE_CAISSIER` à `core/constants.py` + migration RBAC + accès `CashEntryViewSet`, soit documenter que c'est un sous-rôle de Comptable/Finance sans compte dédié.

---

## 🟡 MOYENNE — Dette / fragilité, pas de crash immédiat

### M1. `.delay()` appelé en direct, pas via `safe_dispatch`

Import de `safe_dispatch` présent (bien que sur le mauvais chemin, cf C1) mais **jamais utilisé** dans `procurement/signals.py` ni `treasury/signals.py` — les deux appellent `task.delay()` en direct. Le pass précédent de cette session (rappelé dans le contexte système) avait justement corrigé ce pattern ailleurs dans le projet ("Fix critique: dispatch Celery sécurisé"). Ici la régression est réintroduite : si Redis est down, `post_save` (signal synchrone, dans le thread de la requête HTTP) lève une exception de connexion et fait échouer la requête utilisateur (ex: valider un devis fournisseur casserait en 500 si Celery est down), au lieu de dégrader proprement.

**Fix:** remplacer chaque `xxx_task.delay(...)` par `safe_dispatch(xxx_task, ...)` une fois l'import C1 corrigé.

### M2. `requested_by` jamais peuplé sur les `DisbursementRequest` créés par procurement

Le décaissement issu de `CanInitiateDisbursement` (Chef de Projet, flux manuel) a toujours un `requested_by`. Celui généré par `create_disbursement_request_task` (une fois C4 corrigé) n'a pas de propriétaire clair — qui "demande" ce décaissement ? Impact direct sur `DisbursementRequestPDFViewSet.export_pdf` (`treasury/views.py`) dont le contrôle d'accès repose sur `disbursement.requested_by == request.user` : un décaissement d'origine procurement ne sera jamais consultable par son "auteur métier" (le Manager qui a validé le devis), seulement par Finance/Admin.

**Fix:** dans le C4 fix, peupler `requested_by` avec l'utilisateur qui a fait `validate_manager` sur le devis (`quote.manager_validated_by`).

### M3. Comptes comptables en dur dans le code, dispersés sur 3 fichiers

`530`, `512`, `401`, `101`, `601`, `4456` réapparaissent en dur dans `treasury/tasks.py` et `procurement/tasks.py`, sans passer par `Account.objects.get_or_create()` (contrairement à `finance/views.py` qui le fait systématiquement). Conséquence directe de C2/C5 mais reste un problème de conception même une fois les crashes réglés: rien ne garantit que ces codes comptes existent réellement en base au moment du premier post — `Account` a `code` `unique=True` sans valeur par défaut créée au démarrage.

**Fix:** dans le même mouvement que C2, généraliser `Account.objects.get_or_create(code=..., defaults={...})` partout, jamais de string brute passée à `TransactionLine`.

---

## Récapitulatif priorisé

| # | Sévérité | Fichier | Résumé | Bloque quoi |
|---|---|---|---|---|
| C1 | 🔴 Critique | procurement/tasks.py, treasury/tasks.py | Import `core.utils.safe_dispatch` inexistant | **Django ne démarre pas** |
| C2 | 🔴 Critique | procurement/tasks.py, treasury/tasks.py | `TransactionLine.create()` champs fantômes | Toute écriture compta auto plante |
| C3 | 🔴 Critique | procurement/tasks.py | `JournalEntry.create()` champs fantômes + `period` manquant | Post facture fournisseur plante |
| C4 | 🔴 Critique | procurement/tasks.py | `DisbursementRequest.create()` champ+enum fantômes | Auto-décaissement plante |
| C5 | 🔴 Critique | procurement/tasks.py | `FinanceSettings` champs fantômes, masqués par `except:` nu | Bug caché, config achats jamais centralisée |
| H1 | 🟠 Haute | treasury/signals.py | Condition `created` jamais vraie au moment utile | Réconciliation caisse/banque ne poste jamais rien |
| H2 | 🟠 Haute | procurement/tasks.py | Contourne le circuit N1/N2/N3 | **Brèche de contrôle financier** |
| H3 | 🟠 Haute | procurement vs treasury models | Deux modèles "pièce de caisse" non liés | État de caisse mensuel faux |
| H4 | 🟠 Haute | finance/procurement/treasury | 3 chemins non coordonnés pour "décaissement exécuté" | Traçabilité comptable incohérente |
| H5 | 🟠 Haute | treasury/tasks.py | Résolution période comptable incohérente vs finance/views.py | `MultipleObjectsReturned` possible |
| H6 | 🟠 Haute | treasury docs vs RBAC | Rôle Caissier documenté, jamais implémenté | Doc trompeuse, accès à trancher |
| M1 | 🟡 Moyenne | procurement/treasury signals | `.delay()` direct au lieu de `safe_dispatch` | Régression résilience Celery |
| M2 | 🟡 Moyenne | procurement/tasks.py | `requested_by` jamais peuplé | PDF export inaccessible à l'auteur métier |
| M3 | 🟡 Moyenne | procurement/treasury tasks | Comptes en dur, pas de `get_or_create` | Fragilité si compte absent en base |

---

## Plan de correction recommandé (ordre)

1. **C1** — fix l'import, sinon rien d'autre n'est testable (5 min)
2. **C4** — fix + brancher `initial_status_for_amount()` (règle H2 en même temps — c'est le même bloc de code)
3. **C2 + C3 + M3** — réécrire les 3 tasks (`post_cash_entry_journal_entry`, `post_bank_entry_journal_entry`, `post_capital_contribution_journal_entry`, `post_supplier_invoice_journal_entry`) avec le pattern `Account.objects.get_or_create()` + `TransactionLine(account=..., label=...)` correct — extraire un helper commun `finance/accounting_helpers.py` pour éviter la duplication x4 du même pattern
4. **C5** — étendre `FinanceSettings`, migration, remplacer `except:` nu
5. **H1** — supprimer les signaux morts, déclencher les tasks explicitement depuis les actions `reconcile()`/`validate()` des views (plus lisible, plus testable)
6. **H5** — aligner résolution période sur le pattern `finance/views.py`
7. **M1** — remplacer `.delay()` par `safe_dispatch()` partout
8. **M2** — peupler `requested_by`
9. **H3 + H4** — décision d'architecture à valider avec toi avant refactor (fusion CashVoucher/CashEntry, point d'entrée unique pour "décaissement exécuté") — plus gros chantier, pas un simple fix
10. **H6** — décision produit (créer rôle Caissier ou pas)

**Effort estimé:** 1-3 en ~1h30 (mécanique). 5, 7, 8 ~1h. 9 et 10 nécessitent ta décision avant d'être codés — c'est un choix de modèle de données, pas un bug à corriger silencieusement.

Rien de tout ça n'a été poussé sur `origin`. Correction à faire avant tout déploiement — en l'état, activer Celery beat ou déclencher un seul de ces workflows en prod plante immédiatement.
