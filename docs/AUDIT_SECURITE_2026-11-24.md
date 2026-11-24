# Audit de sécurité des versions — 24/11/2026

Référence : *Guide pratique audit de sécurité & DevSecOps*, révision du
24/11/2026. Prochain audit planifié : **08/12/2026** (cycle de 14 jours ; le
workflow `.github/workflows/security.yml` tourne aussi tous les 14 jours et à
chaque PR).

## 1. Inventaire et état

| Composant | Avant | Après | Seuil du guide | Statut |
|---|---|---|---|---|
| Next.js | 16.2.10 | **16.4.6** | ≥ 16.0.11 (RSC) ; npm audit : critique ≤ 16.4.4 | Corrigé |
| React / React DOM | 19.2.4 | **19.3.1** | versions corrigées RSC (CVE-2025-55182, -55183, -55184, -67779, CVE-2026-23864) | Corrigé |
| eslint-config-next | 16.2.10 | **16.4.6** | aligné sur Next | Corrigé |
| jspdf | 3.0.1 (critique ≤ 4.2.0) | **retiré** | — | Supprimé (aucune utilisation dans le code) |
| @grpc/grpc-js (via firebase) | 1.9.16 (élevée ≤ 1.13.5) | **1.14.7** (`overrides`) | > 1.13.5 | Corrigé |
| Autres dépendances transitives | 56 alertes (2 critiques, 15 élevées) | **33 moyennes, 0 élevée, 0 critique** | — | Voir §3 |
| Django | `>=5.0,<6.0` (5.2.16 en local) | **`>=5.2.19,<6.0`** | ≥ 5.2.19 (3/11/2026) | Corrigé |
| pip-audit (backend) | — | aucune vulnérabilité connue | — | OK |
| PostgreSQL (docker-compose, CI) | `postgres:16` / `16-alpine` (flottant) | **16.16** | ≥ 16.16 (12/11/2026) | Corrigé (local + CI) |
| PostgreSQL production (Supabase) | géré par Supabase | — | ≥ 16.16 | **À vérifier** dans la console Supabase |
| Node.js | `.nvmrc` = 24 (CI : dernière 24.x) ; poste local 24.6.0 | — | ≥ 24.17.0 | CI OK ; **poste local à mettre à jour** |
| Image Python backend | `python:3.12-slim` (reconstruite à chaque déploiement) | — | — | OK |
| Git (poste) | 2.56.1 | — | ≥ 2.56.1 | OK |
| GitHub CLI (poste) | 2.100.0 | — | ≥ 2.102.0 | **À mettre à jour** (`winget upgrade GitHub.cli`) |

## 2. Vérifications

- Backend : suite de tests complète au vert sur Django 5.2.19 ;
  `manage.py check --deploy` sans avertissement de sécurité bloquant (seul
  `security.W021` : HSTS preload volontairement désactivé).
- Frontend : `tsc --noEmit` sans erreur, compilation de production
  (`next build`) sur Next 16.4.6 / React 19.3.1.
- Les versions de Next, React et eslint-config-next sont épinglées
  exactement dans `package.json` ; `@grpc/grpc-js` est forcé par
  `overrides`.

## 3. Risques restants acceptés (moyens)

33 alertes de sévérité moyenne, toutes transitives (éditeur TipTap,
`glob` / `minimatch` d'outillage, etc.). Leur correction automatique exige
`npm audit fix --force`, donc des montées de version majeures non testées
(TipTap 3, etc.) : à planifier dans un cycle dédié avec tests de l'éditeur
de blog. Échéance cible : 30 jours.

## 4. Mesures complémentaires du guide (hors code)

- Supabase : vérifier la version PostgreSQL du projet, l'accès réseau
  restreint et les sauvegardes / restauration.
- GitHub : activer secret scanning, push protection, Dependabot alerts et
  security updates ; protéger `main` (revue, checks requis, pas de force-push).
- Postes de développement : Node ≥ 24.17, GitHub CLI ≥ 2.102.
- Firebase : déployer les règles Firestore en attente
  (`firebase deploy --only firestore:rules --project sokensdigital-2d82a`).
