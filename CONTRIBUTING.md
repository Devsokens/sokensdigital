# Règles et Conventions de Contribution (GitFlow & Commits)

## GitFlow et Branches

Ce projet utilise une stratégie de branching basée sur un GitFlow simplifié, adaptée au CI/CD.

*   **`main`** : Branche de production. **Protégée**. Le code poussé sur cette branche déclenche le pipeline de déploiement manuel en production. Une **Merge Request est obligatoire** avec l'approbation d'au moins 1 reviewer.
*   **`develop`** : Branche d'intégration continue. Sert de base pour créer de nouvelles fonctionnalités. Le déploiement est automatique sur l'environnement de Staging.
*   **`feature/<nom-fonctionnalite>`** : Une branche par fonctionnalité (basée sur le CDC). Créée depuis `develop` et mergée vers `develop`. Déploiement automatique en Staging pour les tests.
*   **`fix/<nom-bug>`** : Branches dédiées aux correctifs (hotfix ou bugfix).

---

## Conventional Commits

Nous utilisons les Conventional Commits de manière stricte pour garantir un historique propre et permettre la génération automatique du Changelog (via des outils sémantiques).

**Formats autorisés :**
*   `feat:` : Ajout d'une nouvelle fonctionnalité (correspond à une MINOR release).
*   `fix:` : Correction d'un bug (correspond à une PATCH release).
*   `docs:` : Modifications liées à la documentation uniquement.
*   `refactor:` : Modification du code qui n'ajoute ni fonctionnalité ni correction de bug.
*   `security:` : Correction d'une faille ou amélioration de la sécurité.
*   `test:` : Ajout ou modification de tests manquants.

**Exemples :**
```text
feat: add authentication workflow via Firebase
fix: resolve database connection timeout issue
docs: update API swagger documentation
refactor: extract JWT validation into a separate middleware
```

**Génération du Changelog :**
L'historique des commits formatés permet de générer automatiquement les notes de mise à jour lors de la création d'un tag ou d'une release.
