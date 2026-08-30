# Vérification du document de statut — écarts trouvés

**Date:** 2026-08-17 | **Méthode:** chaque affirmation du document checké contre le code réel (grep + lecture directe), pas de confiance sur foi.

**Verdict global :** le document de statut est **daté dans les deux sens** — certaines cases ✅ "Terminé" ne le sont pas vraiment (une, sérieuse), et certaines cases ❌ "À FAIRE" sont en fait déjà faites (deux). Détail ligne par ligne ci-dessous.

---

## 🔴 "✅ Terminé" qui ne l'est PAS — écart réel

### Immutabilité du statut (Décision technique #4) — **FAUX pour 6 modèles sur 7**

**Prétention du doc :** *"Une fois la facture/facture fournisseur validée, son statut ne peut plus être modifié."*

**Vérifié — seul `finance.Invoice` a réellement ce garde :**

```python
# finance/views.py:274-278 — InvoiceViewSet.update()
def update(self, request, *args, **kwargs):
    invoice = self.get_object()
    if invoice.status != Invoice.Status.BROUILLON:
        return Response({'detail': 'Une facture validée ne peut plus être modifiée.'}, status=400)
    return super().update(request, *args, **kwargs)
```

**Tous les autres modèles concernés par le même principe métier n'ont AUCUN garde équivalent** — `grep "def update"` sur `procurement/views.py` et `treasury/views.py` : **zéro résultat**. Ce sont des `ModelViewSet` standard, PUT/PATCH acceptés sans condition de statut :

| Modèle | Statut "final" prétendu immuable | Garde réel |
|---|---|---|
| `finance.Invoice` | VALIDEE | ✅ Bloqué |
| `finance.Payment` | RECU | ✅ Immuable par construction — `PaymentViewSet` n'expose même pas `update`/`destroy` (List/Create/Retrieve seulement) |
| `procurement.SupplierQuote` | VALIDE (déclenche un décaissement auto sur `amount_ttc`) | ❌ **Modifiable après validation** — on peut changer `amount_ht` après que le décaissement ait déjà été créé sur l'ancien montant |
| `procurement.SupplierInvoice` | VALIDEE/PAYEE (écriture comptable déjà postée) | ❌ **Modifiable après paiement** — changer les montants après coup désynchronise le `JournalEntry` déjà créé de l'enregistrement |
| `procurement.ProcurementRequest` | APPROUVEE | ❌ Modifiable après approbation |
| `treasury.CashEntry` | Réconcilié (écriture comptable postée) | ❌ **Modifiable après réconciliation** — même risque de désync compta que SupplierInvoice |
| `treasury.BankEntry` | Réconcilié (écriture comptable postée) | ❌ Idem |
| `treasury.CapitalContribution` | COMPTABILISEE | ❌ Modifiable après comptabilisation |

**Pourquoi c'est un vrai problème, pas juste une case à cocher :** une fois qu'un `SupplierQuote` valide a déclenché un `DisbursementRequest` sur son `amount_ttc`, ou qu'un `CashEntry` réconcilié a fait poster un `JournalEntry`, l'enregistrement source reste éditable — un montant modifié après coup **ne se propage nulle part**, laissant le Grand Livre et la source désynchronisés silencieusement. C'est exactement le type de trou que l'intégrité comptable est censée fermer.

**Fix (même pattern que Invoice, à répliquer 6 fois) :**

```python
# procurement/views.py — SupplierQuoteViewSet
def update(self, request, *args, **kwargs):
    quote = self.get_object()
    if quote.status == SupplierQuote.Status.VALIDE:
        return Response({'detail': 'Un devis validé ne peut plus être modifié.'}, status=400)
    return super().update(request, *args, **kwargs)

# procurement/views.py — SupplierInvoiceViewSet
def update(self, request, *args, **kwargs):
    invoice = self.get_object()
    if invoice.status in (SupplierInvoice.Status.VALIDEE, SupplierInvoice.Status.PAYEE):
        return Response({'detail': 'Une facture validée/payée ne peut plus être modifiée.'}, status=400)
    return super().update(request, *args, **kwargs)

# treasury/views.py — CashEntryViewSet / BankEntryViewSet
def update(self, request, *args, **kwargs):
    entry = self.get_object()
    if entry.reconciled_at is not None:
        return Response({'detail': 'Une pièce rapprochée ne peut plus être modifiée.'}, status=400)
    return super().update(request, *args, **kwargs)

# treasury/views.py — CapitalContributionViewSet
def update(self, request, *args, **kwargs):
    contribution = self.get_object()
    if contribution.status == CapitalContribution.Status.COMPTABILISEE:
        return Response({'detail': 'Un apport comptabilisé ne peut plus être modifié.'}, status=400)
    return super().update(request, *args, **kwargs)

# procurement/views.py — ProcurementRequestViewSet
def update(self, request, *args, **kwargs):
    procurement = self.get_object()
    if procurement.status == ProcurementRequest.Status.APPROUVEE:
        return Response({'detail': 'Une fiche approuvée ne peut plus être modifiée.'}, status=400)
    return super().update(request, *args, **kwargs)
```

**Effort :** 6 méthodes quasi-identiques, ~30 min, zéro risque de régression (n'affecte que le cas déjà "final" — les workflows de création/brouillon restent inchangés). Pas encore appliqué, à ta demande de faire un rapport d'abord.

---

## 🟡 Décisions techniques du document — une n'est plus exacte

### #3. "Les signaux utilisent des tâches Celery"

**Ce n'est plus vrai depuis l'audit du 2026-08-17** (`AUDIT_LOGIQUE_METIER_TRESORERIE_2026-08.md` §H1) : les fichiers `procurement/signals.py` et `treasury/signals.py` ont été **supprimés**. Le déclenchement des tâches Celery se fait maintenant **explicitement depuis les actions des ViewSets** (`validate_manager()`, `reconcile()`, etc.) via `safe_dispatch()`, pas via `post_save` signals.

**Raison du changement (déjà documentée à l'époque) :** un signal `post_save` sur `created` ne pouvait jamais voir `reconciled_at` (posé par un second `.save()` distinct) — les tâches ne se déclenchaient jamais en pratique. Le remplacement par un appel direct depuis la vue est plus fiable et plus lisible, mais **la doc doit être corrigée** — elle décrit une architecture qui n'existe plus.

**Vérifié présent, correct :** `safe_dispatch()` (dégrade proprement si Redis down au lieu de planter la requête) utilisé de façon cohérente dans `procurement/views.py`, `treasury/views.py`, `finance/tasks.py`.

---

## 🟢 "❌ Pas encore fait" qui est en fait DÉJÀ fait

### Phase 2 — "Notifications par e-mail" : **déjà implémenté**

`finance/tasks.py` a `send_invoice_reminders()` avec un vrai `EmailMessage` (pas juste un stub) — relances J+7/J+14/J+30 sur facture impayées, câblé au Celery Beat (`CELERY_BEAT_SCHEDULE`, 09:00 UTC quotidien). Backend `EMAIL_BACKEND` bascule proprement console/SMTP selon config (`EMAIL_HOST` présent ou non).

### Phase 2 — "Pièces jointes PDF aux courriels" : **déjà implémenté**

Même fichier : `email.attach(get_invoice_filename(invoice), pdf_bytes.getvalue(), 'application/pdf')` — le PDF facture est réellement joint à l'email de relance, pas juste un placeholder.

### Phase 2 — "Interface utilisateur frontale pour tous les flux de travail" : **partiellement fait, pas "0%"**

- `frontend/app/admin/finance/achats/page.tsx` + `components/admin/finance/achats.tsx` : fiches besoins, devis, factures fournisseur, fournisseurs — **fait**.
- `frontend/app/admin/finance/tresorerie/page.tsx` + `components/admin/finance/tresorerie.tsx` : caisse, banque, apports capital — **fait**.
- **Manquant confirmé :** `components/admin/finance/invoices.tsx` (frontend Facturation) n'a **aucune** UI pour le workflow `Payment`/versements partiels — zéro mention de "Payment" ou "versement" dans le fichier. Le backend (`PaymentViewSet`, réception, reçu auto) est complet, mais reste inaccessible depuis l'interface — seule l'API brute peut l'utiliser aujourd'hui. C'est le vrai trou de la Phase 2 sur ce point, pas "tout à faire".

### "Exportation de données (intégration comptable)" — **partiellement fait**

`finance/views.py::fec_export` existe déjà (export FEC simplifié, non certifié DGFiP — documenté comme tel dans son propre docstring). Ce n'est pas une intégration comptable complète, mais ce n'est pas "0% fait" non plus.

---

## ✅ Confirmé exact — pas d'écart

- **Modèle Payment vs lignes de commande** (décision #1) : `Payment.invoice` est bien un FK simple, pas de ligne de commande. Exact.
- **DocumentAttachment / GenericForeignKey** (décision #2) : le modèle existe bien avec `content_type`/`object_id`/`GenericForeignKey`. **Mais** — nuance non mentionnée par le doc : **aucun endpoint d'upload n'existe encore nulle part** (confirmé par grep — seul un serializer `read_only=True` l'expose en lecture nichée dans `PaymentSerializer.attachments`). La "flexibilité" du modèle est réelle sur le papier, mais **rien ne peut créer d'instance via l'API aujourd'hui** — c'est un modèle prêt, pas un flux opérationnel. Déjà signalé dans l'audit sécurité (finding H5) comme "mine posée pour le futur endpoint", toujours vrai.
- **Numérotation auto** (décision #5) : `QUOTE-{year}-{seq}`, `PC-{year}-{seq}` (pièce caisse), `FAC-{year}-{seq}`, `REC-{year}-{seq}` — tous vérifiés présents et cohérents avec le format annoncé.
- **Fiabilité tâches async** (retry logic) : `max_retries=3` présent dans `procurement/tasks.py` (x2), `treasury/tasks.py` (x3), `finance/tasks.py` (x2) — cohérent avec le "✅ Terminé".
- **Validation feuilles de temps** — confirmé toujours **non fait** : `technique.TimeEntry` n'a aucun champ `is_validated`/`validated_by`/`validated_at`. Le doc a raison de le lister en TODO.
- Le reste de la Phase 2/3/4 (rapports/analytics, multi-devises, relances fournisseurs, bons de commande, workflow par département, blockchain) : rien trouvé dans le code qui contredirait le statut "à faire" — pas vérifié exhaustivement ligne par ligne (périmètre trop large pour ce passage), mais aucun signal contraire trouvé en scannant les apps existantes.

---

## Récapitulatif actionnable

| # | Sévérité | Écart | Action |
|---|---|---|---|
| 1 | 🔴 Réel, prioritaire | Immutabilité statut manquante sur 6/7 modèles (risque désync comptable silencieuse) | Répliquer le pattern `Invoice.update()` — code fourni ci-dessus, ~30 min |
| 2 | 🟡 Doc à corriger | "Signaux → Celery" décrit une architecture supprimée depuis le 17/08 | Mettre à jour la doc de décisions techniques (pas de code à changer) |
| 3 | 🟢 Doc trop pessimiste | Email + PDF attachment déjà faits, frontend achats/trésorerie déjà fait | Corriger le statut Phase 2 dans le doc |
| 4 | 🟡 Vrai trou non documenté | Frontend Payment/versements totalement absent (backend complet, zéro UI) | À planifier — pas fait ce passage, juste identifié |
| 5 | 🟡 Nuance manquante | DocumentAttachment : modèle prêt, aucun endpoint d'upload | Cohérent avec audit sécurité H5 déjà connu |

**Je n'ai encore rien corrigé dans le code** — uniquement vérifié et rapporté, comme demandé. Dis-moi si tu veux que j'applique le fix #1 (immutabilité, le plus important) et/ou que je construise le frontend Payment (#4) manquant.
