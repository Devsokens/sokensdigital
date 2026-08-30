# État Actuel — Finance, Opérations d'Achats, Trésorerie

**Date:** 2026-08-17 | **Ce document remplace** `COMPLETE_FINANCE_IMPLEMENTATION.md`, `docs/IMPLEMENTATION_SUMMARY.md`, `docs/PROCUREMENT_WORKFLOW_IMPLEMENTATION.md`, `TREASURY_WORKFLOW_IMPLEMENTATION.md`, `docs/PAYMENT_WORKFLOW_IMPLEMENTATION.md`, `docs/FINANCE_FIXES_SUMMARY.md`, `docs/PROCUREMENT_TESTING_CHECKLIST.md` comme référence de statut — ces fichiers restent en place comme journal historique de la construction initiale (2026-08-16), mais ne décrivent plus l'état réel du code après les passes d'audit qui ont suivi. Chacun porte désormais un bandeau renvoyant ici.

**Pour comprendre les décisions et corrections successives dans l'ordre**, lire dans cet ordre :
1. `COMPLETE_FINANCE_IMPLEMENTATION.md` — construction initiale (2026-08-16)
2. `docs/AUDIT_LOGIQUE_METIER_TRESORERIE_2026-08.md` — bugs trouvés en exécutant réellement le code (imports cassés, champs modèle inexistants, fusion CashVoucher→CashEntry, rôle Caissier)
3. `docs/AUDIT_SECURITE_EXTREME_2026-08.md` — failles sécurité (auto-provisioning, XSS, uploads)
4. `docs/AUDIT_PERFORMANCE_2026-08.md` — N+1 queries, cache, compression
5. `docs/VERIFICATION_STATUT_IMPLEMENTATION_2026-08.md` — écarts trouvés entre statut prétendu et code réel (immutabilité manquante)
6. **Ce document** — état après application du fix d'immutabilité (2026-08-17)

---

## Modules et modèles — noms actuels (post-fusion)

| Module | App Django | Modèles |
|---|---|---|
| Facturation + versements | `finance` | `Invoice`, `Payment`, `PaymentReceipt`, `FinanceSettings` |
| Opérations d'achats | `procurement` | `Supplier`, `ProcurementRequest`, `SupplierQuote`, `SupplierInvoice` |
| Trésorerie | `treasury` | `CashEntry` *(fusion de l'ancien `CashVoucher`, supprimé)*, `BankEntry`, `CapitalContribution` |

**`procurement.CashVoucher` n'existe plus** — fusionné dans `treasury.CashEntry` (un seul modèle "pièce de caisse" pour tout le projet, `voucher_number` auto-généré `PC-{année}-{seq}`, source `FOURNISSEUR_ESPECES` ajoutée pour couvrir le cas d'usage procurement).

## Statuts — tous en français, plus aucune valeur anglaise affichée

| Modèle | Valeurs actuelles |
|---|---|
| `finance.Payment.Status` | `EN_ATTENTE` → `RECU` → `ENREGISTRE` *(anciennement PENDING/RECEIVED/RECORDED)* |
| `procurement.ProcurementRequest.Status` | `BROUILLON` → `EN_ATTENTE_RCF` → `EN_ATTENTE_MANAGER` → `APPROUVEE`/`REJETEE` → `EN_COURS` → `TERMINEE` *(anciennement DRAFT/PENDING_RCF/.../APPROVED)* |
| `procurement.SupplierQuote.Status` | `BROUILLON` → `EN_ATTENTE` → `VALIDE`/`REJETE` *(anciennement DRAFT/PENDING/VALIDATED)* |
| `procurement.SupplierInvoice.Status` | `RECUE` → `VALIDEE` → `PAYEE` *(anciennement RECEIVED/VALIDATED/PAID)* |
| `treasury.CashEntry`/`BankEntry.Type`, `.Source` | déjà en français depuis la création |
| `treasury.CapitalContribution.Status` | déjà en français depuis la création |

Étendu aussi à `projects.ProjectTask.Status`, `marketing.SocialPost.Status`, `technique.Task/Ticket` (statuts + priorités) — harmonisation complète de l'app, pas seulement finance.

## Architecture de déclenchement — signaux supprimés

**`procurement/signals.py` et `treasury/signals.py` n'existent plus.** L'ancienne architecture ("un `post_save` déclenche la tâche Celery") avait un bug de fond : le signal se déclenchait sur `created`, mais `reconciled_at`/le changement de statut est posé par un second `.save()` distinct — la condition `created and reconciled_at is not None` n'était donc jamais vraie en pratique, et **aucune tâche ne se déclenchait jamais** via ce mécanisme.

**Remplacé par un dispatch explicite depuis l'action de la vue qui fait la transition métier**, via `core.celery_utils.safe_dispatch()` (dégrade proprement si Redis est down au lieu de faire planter la requête) :

```python
# procurement/views.py — SupplierQuoteViewSet.validate_manager()
quote.status = SupplierQuote.Status.VALIDE
quote.save()
safe_dispatch(create_disbursement_request_task, (str(quote.id),))

# treasury/views.py — CashEntryViewSet.reconcile()
entry.reconciled_at = timezone.now()
entry.save()
safe_dispatch(post_cash_entry_journal_entry, (str(entry.id),))
```

Plus explicite, plus facile à tester, et ça marche réellement (vérifié par les tests ajoutés lors de l'audit).

## Écritures comptables — helper commun

`finance/accounting_helpers.py` centralise la résolution de compte (`get_or_create_account`), la résolution de période comptable ouverte par date couverte (`resolve_open_period_for_date` — pas juste "la première période ouverte trouvée", pattern aligné sur `InvoiceViewSet.validate`), et la création d'écriture équilibrée avec vérification débit=crédit (`post_balanced_entry`, lève `ValueError` si déséquilibrée plutôt que de poster silencieusement une écriture fausse). Utilisé par les 4 tâches qui postent des `JournalEntry` (procurement + treasury) — plus de duplication du pattern `Account.objects.get_or_create(...)` à la main dans chaque tâche.

`FinanceSettings` porte maintenant aussi les comptes achats/trésorerie (`default_purchases_account_code`, `default_vat_deductible_account_code`, `default_supplier_account_code`, `default_cash_account_code`, `default_bank_account_code`, `default_capital_account_code`) — plus de comptes en dur dans le code des tâches.

## Immutabilité du statut — maintenant réellement enforced partout

**Corrigé le 2026-08-17** (`docs/VERIFICATION_STATUT_IMPLEMENTATION_2026-08.md` finding #1) : `update()`/`destroy()` bloqués une fois qu'un enregistrement a déjà déclenché une écriture comptable ou un décaissement, sur les 7 modèles concernés :

| Modèle | Bloqué quand |
|---|---|
| `finance.Invoice` | `status == VALIDEE` |
| `finance.Payment` | Toujours — pas de route `update`/`destroy` exposée (List/Create/Retrieve seulement) |
| `procurement.ProcurementRequest` | `status == APPROUVEE` |
| `procurement.SupplierQuote` | `status == VALIDE` |
| `procurement.SupplierInvoice` | `status in (VALIDEE, PAYEE)` |
| `treasury.CashEntry` | `reconciled_at is not None` |
| `treasury.BankEntry` | `reconciled_at is not None` |
| `treasury.CapitalContribution` | `status == COMPTABILISEE` |

## Rôle Caissier

Ajouté (`core/constants.py ROLE_CAISSIER`, `AppRole` côté frontend, mapping Django↔Firestore dans `core/serializers.py`). Permission dédiée `IsCaissierFinanceOrAdmin` sur `treasury.CashEntryViewSet` — la caisse physique est accessible au Caissier, la banque/le capital restent réservés Directeur Financier/Super-Admin (cahier des charges §3).

## Ce qui reste vrai depuis la construction initiale (non régressé)

- Numérotation auto (`QUOTE-{année}-{seq}`, `PC-{année}-{seq}`, `FAC-{année}-{seq}`, `REC-{année}-{seq}`) — inchangée, vérifiée.
- Retry logic Celery (`max_retries=3`, backoff exponentiel) — inchangée sur les 3 apps.
- `DocumentAttachment` (GenericForeignKey) — le modèle existe toujours, **toujours aucun endpoint d'upload câblé nulle part** (vérifié à nouveau le 17/08). Validators posés dessus (extension pdf/jpg/png, 10 Mo max) en prévention, mais rien ne peut encore créer d'instance via l'API.

## Frontend — état réel

| Workflow | Backend | Frontend |
|---|---|---|
| Opérations d'achats | ✅ complet | ✅ `/admin/finance/achats` (fiches, devis, factures fournisseur, fournisseurs) |
| Trésorerie | ✅ complet | ✅ `/admin/finance/tresorerie` (caisse, banque, capital) |
| Versements partiels (Payment) | ✅ complet (création, réception, reçu PDF auto) | ❌ **aucune UI** — `components/admin/finance/invoices.tsx` ne mentionne pas Payment. Utilisable uniquement via appel API direct aujourd'hui. |

## Sécurité — corrections appliquées (résumé, détail dans AUDIT_SECURITE_EXTREME)

- Auto-provisioning Firebase fermé (token valide sans compte pré-provisionné → 401, plus de création silencieuse de `User` actif)
- XSS stockée sur le blog corrigée (`nh3` sanitization serveur, `core/sanitize.py`)
- Upload chat restreint par type de fichier (`core/storage.ALLOWED_CHAT_ATTACHMENT_TYPES`)
- `/admin/` verrouillé après 5 échecs (`django-axes`)
- IDOR corrigée sur l'export PDF de demande de décaissement

## Performance — corrections appliquées (résumé, détail dans AUDIT_PERFORMANCE)

- N+1 queries corrigées (`select_related`/`prefetch_related`) sur procurement (3 ViewSets), treasury (3), `technique.KnowledgeBase`, `support.SupportTicket`, `messaging` (participant_count annoté au lieu d'un COUNT par ligne)
- `finance_dashboard` mis en cache 5 min + agrégation fusionnée
- `GZipMiddleware` ajouté sur l'API
- `next.config.ts` : `images.remotePatterns` configuré (débloquait `next/image` pour Cloudinary/Supabase)

## Vérifié réel au moment de l'écriture

- `manage.py check` : 0 issue
- `manage.py migrate` : 100% appliqué
- `pytest` : 391/391 passent (351 + 40 nouveaux tests procurement/treasury, voir section dédiée ci-dessous)
- `tsc --noEmit` : aucune erreur nouvelle
- **Poussé sur `main`** (plus "non poussé sans autorisation" — dépassé depuis plusieurs merges)

## Tests procurement/treasury — ajoutés le 17/08

Écrire les tests (`procurement/tests.py`, `treasury/tests.py`, 40 tests) a immédiatement
révélé un bug critique jamais détecté : **toutes** les permission classes de
ces deux apps (`IsFinanceOrAdmin`, `IsManagerOrAdmin`, `IsCaissierFinanceOrAdmin`)
appelaient `request.user.has_role(...)` — une méthode qui **n'existe pas**
sur `User` (la vraie fonction est `core.permissions.has_role(user, *roles)`,
libre, pas une méthode). Résultat : chaque requête sur ces 2 apps plantait
en 500 au lieu de vérifier un rôle — le module procurement/treasury n'a
jamais fonctionné en pratique depuis sa création, malgré `check`/`migrate`
verts (ces commandes n'exercent jamais le code de permission). Corrigé dans
le même passage (9 sites d'appel sur les deux fichiers `views.py`).

Couverture ajoutée : modèles (numérotation auto, calcul TTC, validation),
permissions par rôle (c'est ce qui a révélé le bug), transitions de statut,
immutabilité (les gardes ajoutés plus haut), tâches Celery exécutées
directement via `.apply()` (`safe_dispatch()` est un no-op pendant les
tests — passer par la vue ne les déclenche jamais réellement en test),
2 tests d'intégration bout-en-bout (fiche besoins → devis → décaissement
auto → facture → écriture comptable ; pièce de caisse → rapprochement →
écriture comptable).

## Gaps confirmés toujours ouverts

- Frontend Payment/versements (voir tableau ci-dessus)
- Validation des feuilles de temps (`technique.TimeEntry` sans champ `is_validated`/`validated_by`) — toujours pas fait
- Rapports/analytics avancés, multi-devises, relances fournisseurs, bons de commande, workflow d'approbation par département — toujours pas commencés, aucun signal contraire trouvé en scannant le code
