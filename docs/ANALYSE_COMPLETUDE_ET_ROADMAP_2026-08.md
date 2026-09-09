# Analyse de complétude — état réel, manques, priorités

**Date :** 2026-08-31 | **Méthode :** inventaire par lecture du code, pas par lecture de la documentation existante (celle-ci s'est déjà révélée fausse dans les deux sens lors de l'audit du 17/08).

Ce document répond à trois questions : **qu'est-ce qui est réellement en place**, **qu'est-ce qui manque**, et **qu'est-ce qui devrait exister au nom de la complémentarité** — un module isolé qui ne se raccorde à rien n'a pas de valeur, même s'il fonctionne.

---

## 1. Ce qui est en place et fonctionne

### Modules livrés bout en bout (backend + frontend + RBAC)

| Domaine | App Django | Écrans | État |
|---|---|---|---|
| Authentification / profil | `core` | `/connexion`, `/profil` | Firebase Auth + provisioning contrôlé |
| RH (employés, contrats, paie) | `hr` | `/admin/rh/*` | Complet |
| Administration (clients, rôles, audit) | `core`, `administration` | `/admin/rh/*` | Complet |
| Projets, timesheets, tickets | `projects`, `technique` | `/admin/technique/*` | Complet |
| Marketing (leads, blog, devis, CMS) | `marketing` | `/admin/marketing/*` | Complet |
| Finance (clôture, Grand Livre, facturation, TVA, FEC) | `finance` | `/admin/finance/*` | Complet |
| **Encaissements consolidés** | `finance` | `/admin/finance/encaissements` | **Livré ce passage** |
| Opérations d'achats | `procurement` | `/admin/finance/achats` | Complet |
| Trésorerie (caisse, banque, capital) | `treasury` | `/admin/finance/tresorerie` | Complet |
| **Maintenance applicative** | `technique` | `/admin/technique/maintenance` | **Livré ce passage** |
| Support client (tickets, FAQ, KB) | `support` | `/admin/support/*` | Complet |
| Messagerie temps réel | `messaging` + Firestore | `/admin/messagerie` | Complet |
| **PWA installable** | — | Tous supports | **Livré ce passage** |

### Fondations transverses saines

- **RBAC** : 12 rôles, permissions par module, contrôle serveur systématique (`core.permissions.has_role`).
- **Comptabilité automatique** : chaque événement métier (facture validée, devis fournisseur validé, pièce de caisse rapprochée, apport comptabilisé) poste une écriture équilibrée via `finance/accounting_helpers.py`, avec vérification débit = crédit qui lève plutôt que de poster une écriture fausse.
- **Immutabilité** : 7 modèles financiers refusent modification et suppression une fois l'écriture comptable postée.
- **Chiffrement au repos** : documents clients, dossiers RH, et depuis ce passage les accès de production des apps maintenues.
- **Async résilient** : `safe_dispatch()` — une panne Redis retarde une notification, elle ne fait pas échouer la requête métier.
- **Sécurité** : HSTS, cookies stricts, CSP partielle, sanitization HTML serveur (`nh3`), verrouillage `/admin` (`django-axes`), throttling DRF, auto-provisioning fermé.
- **Tests** : 391, dont 40 écrits ce mois sur `procurement`/`treasury` — écrire ces tests a d'ailleurs révélé que ces deux modules n'avaient jamais fonctionné (`request.user.has_role()`, méthode inexistante, plantait en 500 sur chaque requête).

---

## 2. Manques — classés par ce qu'ils coûtent réellement

### 🔴 Critique — le filet de sécurité n'existe pas

**Aucune CI n'exécute les tests.** `.github/workflows/` ne contient que `mirror.yml` (miroir GitLab/GitHub). Les 391 tests ne tournent que si quelqu'un y pense, en local.

C'est le manque le plus grave du projet, et il est invisible tant qu'il ne coûte rien. La démonstration est déjà faite deux fois ce mois : le bug `has_role()` et l'import `core.utils` inexistant ont vécu dans `main` pendant des jours — `manage.py check` passait, seule l'exécution réelle les révélait. Une CI les aurait arrêtés à la première push.

```yaml
# .github/workflows/ci.yml — à créer
name: CI
on: [push, pull_request]
jobs:
  backend:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: { POSTGRES_PASSWORD: ci }, ports: ['5432:5432'],
                  options: --health-cmd pg_isready --health-interval 10s }
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: '3.12', cache: pip }
      - run: pip install -r backend/requirements.txt
      - run: python manage.py check
        working-directory: backend
        env: { DEBUG: 'True' }
      # --check échoue si un modèle a changé sans migration : c'est
      # exactement le genre d'oubli qui casse un déploiement en prod.
      - run: python manage.py makemigrations --check --dry-run
        working-directory: backend
        env: { DEBUG: 'True' }
      - run: pytest -q
        working-directory: backend
        env: { DEBUG: 'True', DATABASE_URL: 'postgres://postgres:ci@localhost:5432/postgres' }
  frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: npm, cache-dependency-path: frontend/package-lock.json }
      - run: npm ci
        working-directory: frontend
      - run: npx tsc --noEmit
        working-directory: frontend
      - run: npm run build
        working-directory: frontend
```

**Effort : 1 h. Bénéfice : tout le reste de cette liste devient sûr à corriger.** À faire avant toute autre chose.

**Aucun monitoring d'erreurs en production.** Pas de Sentry ni équivalent. Les 500 partent dans les logs Render, que personne ne lit en continu ; on apprend les incidents par les utilisateurs. Sentry SDK, ~30 min, plan gratuit suffisant à ce volume.

### 🟠 Haute — cohérence fonctionnelle incomplète

**Le workflow des versements n'a pas d'interface.** `Payment`/`PaymentReceipt` sont complets côté serveur — création, réception, reçu PDF auto-généré, écriture comptable — mais `components/admin/finance/invoices.tsx` ne mentionne pas Payment. Aujourd'hui, seul un appel API direct permet d'encaisser un versement partiel.

C'est le trou de complémentarité le plus visible : l'écran Encaissements livré ce passage *affiche* les versements, la facturation les *ignore*. Un comptable voit qu'un versement existe sans pouvoir en enregistrer un.

**Aucun endpoint d'upload pour `DocumentAttachment`.** Le modèle existe depuis le début, avec ses validators, et rien ne peut créer une instance. Or les pièces justificatives sont une obligation comptable : chèques, bordereaux, attestations de virement. Les workflows caisse/banque supposent leur existence sans les fournir.

**Validation des feuilles de temps.** `technique.TimeEntry` n'a ni `is_validated`, ni `validated_by`, ni `validated_at`. Le Chef de Projet ne peut pas valider les heures de son équipe — pourtant les heures alimentent `Project.total_cost`, donc la marge projet. Des heures non validées faussent silencieusement l'indicateur budgétaire.

### 🟡 Moyenne — robustesse et exploitation

**Sauvegardes non vérifiées.** Supabase gère des backups automatiques sur son offre, mais aucune restauration n'a jamais été testée. Un backup jamais restauré est une hypothèse, pas une sauvegarde. Un exercice de restauration sur une base jetable, une fois, tranche la question.

**Pas de rotation des secrets.** `GMAIL_REFRESH_TOKEN`, `FACEBOOK_PAGE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_SECRET` sont des jetons longue durée sans échéance ni procédure de rotation documentée.

**CSP incomplète.** Le backend a les en-têtes de sécurité usuels, mais aucune Content-Security-Policy côté Next.js — la défense en profondeur contre le XSS repose entièrement sur la sanitization `nh3`. À calibrer en `Report-Only` quelques jours avant de basculer en application.

**Cold start Render (plan gratuit).** Le service s'endort après inactivité ; le premier appel paie 30 à 50 s de réveil. C'est probablement la cause principale de la lenteur ressentie, et **aucune optimisation de code ne la corrigera** — c'est une limite de plan, pas un défaut d'implémentation. Deux issues : passer au plan payant, ou accepter et afficher un état de chargement honnête au premier appel.

### 🟢 Basse — confort

23 fichiers utilisent encore `<img>` au lieu de `next/image` (le blocage config a été levé, la migration reste à faire, priorité aux images publiques à fort impact LCP). 60 % des composants sont marqués `"use client"`, dont une partie n'a aucune interactivité. Multi-devises, relances fournisseurs, bons de commande : non commencés, non urgents.

---

## 3. Complémentarité — ce qui devrait exister au vu de ce qui existe déjà

Chaque module pris isolément fonctionne. Ce sont les jonctions qui manquent :

| Ce qui existe | Ce qui manque en face | Conséquence concrète |
|---|---|---|
| Encaissements affiche les versements | Facturation ne permet pas d'en créer | On observe sans pouvoir agir |
| Caisse/banque référencent des justificatifs | Aucun upload de pièce | Obligation comptable non tenue |
| Timesheets alimentent la marge projet | Pas de validation des heures | Marge faussée silencieusement |
| Maintenance planifie 3 passages/semaine | Pas de rappel automatique | Repose sur la mémoire de l'assigné |
| 391 tests écrits | Rien ne les exécute | Filet de sécurité inopérant |
| Écritures comptables auto-postées | Pas d'alerte sur échec de tâche | Un Grand Livre incomplet passe inaperçu |

Les deux dernières lignes sont les plus coûteuses : ce sont des **mécanismes de sécurité déjà construits mais non branchés**. Le travail de les avoir écrits est déjà payé ; il ne manque que le raccordement.

Pour la maintenance, la tâche périodique se raccorde au Celery Beat déjà en service :

```python
# technique/tasks.py — rappel de passage
@shared_task
def maintenance_reminders():
    """Prévient l'assigné quand le rythme convenu n'est pas tenu.
    L'app compte déjà ses rapports sur 7 jours (annotation du ViewSet) —
    il ne manquait que quelqu'un pour regarder ce compteur sans qu'on le
    lui demande."""
    since = timezone.now() - timedelta(days=7)
    for app in MaintainedApp.objects.filter(is_active=True, assigned_to__isnull=False):
        done = app.reports.filter(performed_at__gte=since).count()
        if done < app.expected_reports_per_week:
            Notification.objects.create(
                user=app.assigned_to,
                title=f'Maintenance en retard — {app.name}',
                message=f'{done}/{app.expected_reports_per_week} passages cette semaine.',
                notification_type='GENERAL',
                link='/admin/technique/maintenance',
            )
```

---

## 4. Ordre recommandé

1. **CI GitHub Actions** (1 h) — rend tout le reste sûr à faire. Rien d'autre avant.
2. **Sentry** (30 min) — cesser d'apprendre les incidents par les utilisateurs.
3. **UI versements** (3-4 h) — ferme le trou fonctionnel le plus visible.
4. **Upload `DocumentAttachment`** (2-3 h) — obligation comptable.
5. **Validation timesheets** (2-3 h, migration) — fiabilise la marge projet.
6. **Rappels maintenance** (30 min) — branche un mécanisme déjà écrit.
7. **CSP Report-Only** (1 h + observation) — défense en profondeur XSS.
8. **Exercice de restauration** (1 h) — vérifier l'hypothèse de sauvegarde.

Les huit tiennent en une semaine. Les points 1 et 2 changent la nature du projet : on passe d'un système où les régressions se découvrent en production à un système qui les signale.

---

## 5. Livré dans ce passage

- Décaissements visibles dans le tableau des fiches de besoins — en lecture, leur circuit N1/N2/N3 restant dans son écran dédié plutôt que dupliqué
- Motif bancaire « Autre », volontairement sans mapping comptable automatique (le comptable saisit à la main plutôt que le système devine un compte faux)
- Écran Encaissements — agrégation serveur des trois sources, périmètre Caissier filtré côté serveur
- Module Maintenance — accès de production chiffrés, exposés uniquement via une action dédiée contrôlée et journalisée
- PWA installable sur iOS, Android, macOS, Windows, tablette — service worker à trois stratégies, jamais de cache-first sur les données financières
- Index DB sur les colonnes filtrées de `Project`/`Task`/`Ticket`, déduplication des GET simultanés, Tiptap chargé à la demande

**Vérifié à chaque étape :** `manage.py check` 0 issue, `migrate` complet, **pytest 391/391**, `tsc --noEmit` sans erreur nouvelle, `next build` réussi. Six commits poussés sur `main` et `taiger_technique`.
