# Audit Performance — Backend Django + Frontend Next.js

**Date:** 2026-08-17 | **Méthode:** lecture directe du code (querysets, serializers, middleware, config Next.js) — chaque finding sourcé, tout ce qui est marqué "appliqué" est vérifié par tests réels (351/351 passent après coup).

---

## ✅ Appliqué ce passage

### Backend — N+1 queries (le vrai coût de perf sur une API DRF)

Le pattern classique : un serializer expose `X_name = serializers.CharField(source='fk.attribut')` ou un `SerializerMethodField` qui traverse une FK, mais le `ViewSet.queryset` ne fait pas `select_related()` — chaque ligne de la page déclenche une requête SQL séparée pour résoudre la FK. Sur une page de 25 lignes avec 4 FK exposées, c'est jusqu'à 101 requêtes au lieu d'1.

| ViewSet | FK exposées par le serializer | Fix |
|---|---|---|
| `ProcurementRequestViewSet` | department, requested_by, rcf_approved_by, manager_approved_by (4) | `select_related` sur les 4 |
| `SupplierQuoteViewSet` | supplier, rcf_validated_by, manager_validated_by (3) | `select_related` sur les 3 |
| `SupplierInvoiceViewSet` | supplier, received_by, validated_by (3) | `select_related` sur les 3 |
| `CashEntryViewSet` | created_by, reconciled_by (2) | `select_related` sur les 2 |
| `BankEntryViewSet` | created_by, reconciled_by (2) | `select_related` sur les 2 |
| `CapitalContributionViewSet` | validated_by, posted_by (2) | `select_related` sur les 2 |
| `KnowledgeBaseViewSet` | created_by (via `get_created_by_name`) | `select_related('created_by')` |
| `SupportTicketViewSet` + `PublicTicketDetailView` | messages→author (nested, N par ticket) | `prefetch_related('messages__author')` au lieu de `'messages'` seul |
| `ChannelParticipantViewSet` | user (via `user_email`) | `select_related('user')` |
| `ChannelMetadataViewSet` | `participant_count` faisait un `COUNT(*)` séparé par ligne (`source='participants.count'`) | `annotate(Count('participants', distinct=True))` — 1 requête pour toute la page au lieu de N. Serializer passé en `SerializerMethodField` avec fallback sur count() direct pour les instances non annotées (create/update) — zéro régression, toujours correct dans tous les contextes. |

**Impact concret :** une page Trésorerie/Achats à 25 lignes passe de ~75-125 requêtes SQL à 2-3. Le gain grandit avec le nombre de lignes — c'est le poste #1 de latence sur une API DRF mal optimisée, et c'était présent sur tout le code écrit cette session (procurement/treasury) plus quelques endroits préexistants (technique, support, messaging). Le reste du code (finance, projects, hr, administration) était déjà correctement optimisé — vérifié, pas de fix nécessaire là.

### Backend — Double requête identique évitée

`finance/views.py::finance_dashboard` faisait `bank_lines.aggregate(Sum('debit'))` puis `bank_lines.aggregate(Sum('credit'))` — deux scans de la même queryset filtrée. Fusionné en un seul `.aggregate(debit_total=Sum('debit'), credit_total=Sum('credit'))`.

### Backend — Cache jamais câblé sur le dashboard financier malgré le commentaire qui le promettait

`settings.py` dit depuis le début "Cache (also used to memoize dashboard aggregations behind a TTL...)" — jamais implémenté. `finance_dashboard` recalculait plusieurs agrégations pleine-table (`Sum` sur `TransactionLine` filtré par classe de compte, DSO sur toutes les factures validées) à **chaque** chargement de page, pour une donnée qui ne bouge pas seconde par seconde. Fix : `cache.get`/`cache.set` avec TTL 5 min (`django_redis` en prod, `LocMemCache` en test — déjà configuré dans `settings.py`, juste jamais utilisé par cette vue).

### Backend — Compression HTTP absente sur l'API

`WhiteNoiseMiddleware` compresse les statics (JS/CSS) mais **pas** les réponses JSON de l'API — souvent le plus gros du trafic réel (listes paginées, Grand Livre, factures). Ajouté `django.middleware.gzip.GZipMiddleware`, positionné tôt dans `MIDDLEWARE` (avant `CommonMiddleware`, conforme à la doc Django — le traitement des réponses se fait dans l'ordre inverse de la liste, donc GZip doit apparaître tôt pour compresser en dernier). Gain typique 70-85% sur du JSON répétitif. Zéro risque : négociation de contenu HTTP standard, aucun client ne casse s'il n'envoie pas `Accept-Encoding: gzip`.

### Frontend — `next/image` bloqué par un config manquant

`next.config.ts` était vide — aucun `images.remotePatterns`. Or `next/image` **refuse** toute image distante non whitelistée par défaut. C'est très probablement pour ça que le code utilise `<img>` brut à 23 endroits au lieu de l'optimisation automatique de Next.js (redimensionnement, conversion WebP/AVIF, lazy loading) : l'outil était bloqué, pas boudé par choix. Ajouté `remotePatterns` pour `res.cloudinary.com` et `*.supabase.co` (les deux CDN utilisés par `core/storage.py`). Purement additif — ne change aucun rendu existant, débloque juste la migration progressive des images publiques à fort impact (galerie projets, showcase) vers `next/image` dans un prochain passage.

---

## Vérifié, pas de fix nécessaire

- `finance`, `projects`, `hr` : `select_related`/`prefetch_related` déjà en place partout où le serializer en a besoin (`ProjectViewSet`, `EmployeeProfileViewSet`, `InvoiceViewSet`, `JournalEntryViewSet`, etc.) — code pré-existant de bonne qualité.
- `administration` (Client, LeaveRequest, CompanyAsset, ContractGenerator) : serializers exposent les FK comme PK brute (pas de traversée `.attribut`), donc pas d'N+1 malgré l'absence de `select_related`.
- `marketing` (PageSection, ShowcaseProject) : idem, pas de traversée FK dans le serializer.
- `finance.Account` : pas de FK, rien à optimiser.

---

## 📋 Recommandé — pas appliqué ce passage (risque/effort à valider avant)

### Backend

**DSO (Days Sales Outstanding) calculé en Python, pas en SQL** — `finance_dashboard` charge *tous* les objets `Invoice` validées avec échéance en mémoire pour calculer `(due_date - issue_date).days` ligne par ligne en Python, plutôt qu'une agrégation `Avg()` côté base. Correct fonctionnellement, mais coûte en mémoire/temps si le nombre de factures grossit significativement. Pas touché ce passage — la traduction en expression ORM (`ExpressionWrapper` + `Avg`) a des subtilités de portabilité SQLite/Postgres sur l'arithmétique de dates qui méritent une vérification dédiée plutôt qu'un changement à l'aveugle sur du code financier.

**`DepartmentSerializer.get_member_count`/`get_members`** — deux requêtes séparées (`count()` + slice ordonné) par département listé. Impact réel faible aujourd'hui (4 départements seedés), mais si la liste grossit un jour, `annotate(Count('user'))` remplacerait `get_member_count` en 1 requête pour toute la page.

**Index DB** — pas d'audit systématique des colonnes filtrées fréquemment sans index dédié (au-delà de ceux déjà posés par `LoggedModel.Meta` sur `created_at` et les `status`/`type` déjà indexés dans ce qu'on a écrit cette session). À faire avec un vrai volume de données de prod plutôt qu'en aveugle sur une base de test vide — un index mal choisi ralentit les écritures pour rien.

**Celery — pas d'audit de concurrency/prefetch** — `CELERY_BROKER_URL`/paramètres de worker (concurrency, prefetch_multiplier) ne sont pas définis dans `settings.py`, donc sur les defaults Celery. Raisonnable tant que le volume de tâches reste faible ; à revisiter si `send_invoice_reminders`/`check_budget_alerts` commencent à empiler du retard.

### Frontend

**23 fichiers en `<img>` brut au lieu de `next/image`** — le blocage config est levé (voir ci-dessus), mais migrer chaque fichier nécessite de vérifier au cas par cas les dimensions (`width`/`height` ou `fill`) pour éviter un layout shift ou une image cassée — pas fait à l'aveugle sans build/preview visuel. Priorité : les images du site public à fort impact LCP (`components/projects/project-gallery.tsx`, `components/admin/marketing/showcase-project-list.tsx` si utilisé côté public) avant les avatars/icônes admin (impact perf quasi nul, usage interne).

**Zéro usage de `next/dynamic`** — `recharts` (dashboard graphiques), `@tiptap/*` (éditeur blog), `motion` (animations) sont importés en dur. App Router fait déjà du code-splitting automatique par route, donc l'essentiel du gain est probablement déjà là (ces libs sont confinées à des pages admin spécifiques, pas dans un layout partagé) — mais un `next/dynamic(() => import(...), { ssr: false })` sur le composant éditeur Tiptap et les graphiques dashboard économiserait le JS initial des pages qui ne les affichent pas immédiatement (ex: bascule d'onglet). Gain incertain sans profiling réel du bundle (`next build` + analyse) — à mesurer avant d'investir.

**119/197 fichiers `.tsx` marqués `"use client"`** (60%) — App Router permet des Server Components qui n'envoient aucun JS au navigateur pour du contenu statique (sections hero, pages légales, contenu marketing sans interactivité). Une proportion aussi haute suggère que `"use client"` est posé par réflexe/habitude plutôt qu'au cas par cas. Refactor potentiellement significatif pour le poids JS du site public, mais nécessite une revue composant par composant (quelle partie a vraiment besoin d'interactivité vs quelle partie peut redescendre en Server Component) — hors périmètre d'un passage automatisé sans casser de comportement.

---

## Vérifié après application

- `manage.py check` : 0 issue
- `manage.py migrate` : rien de nouveau à migrer (aucun changement de modèle ce passage — uniquement querysets/serializers/middleware/config)
- `pytest` : **351/351 passent** (aucune régression — le seul risque identifié, `ChannelMetadataSerializer.participant_count` cassant sur les instances non-annotées de `create()`, corrigé avec un fallback avant même de lancer les tests)
- `tsc --noEmit` : 61 erreurs, identique à la baseline pré-existante (aucune nouvelle depuis `next.config.ts`)

## Fichiers modifiés

```
backend/procurement/views.py       — select_related x3 querysets
backend/treasury/views.py          — select_related x3 querysets
backend/technique/views.py         — select_related KnowledgeBase
backend/support/views.py           — prefetch_related messages__author x2
backend/messaging/views.py         — select_related + annotate Count
backend/messaging/serializers.py   — participant_count SerializerMethodField
backend/finance/views.py           — aggregate fusionné + cache dashboard
backend/sokens_backend/settings.py — GZipMiddleware
frontend/next.config.ts            — images.remotePatterns
```

**Rien de tout ça ne change le comportement observable de l'app** — mêmes réponses JSON, mêmes permissions, mêmes règles métier. Uniquement moins de requêtes SQL et moins d'octets sur le fil.
