# Corrections appliquées — 31 août 2026

Suite donnée aux huit points priorisés dans
[`ANALYSE_COMPLETUDE_ET_ROADMAP_2026-08.md`](./ANALYSE_COMPLETUDE_ET_ROADMAP_2026-08.md).
Sept sont livrés ; le huitième demande un accès Supabase que je n'ai pas.

Chaque étape a été poussée séparément sur `taiger_technique`.

---

## 1. Intégration continue — livré

`.github/workflows/ci.yml`, déclenché sur chaque push et chaque pull request.

Backend : `manage.py check`, `makemigrations --check` (attrape un modèle
modifié sans sa migration), puis pytest **contre Postgres 16** et non le
SQLite de repli — les écarts de comportement entre les deux moteurs sont
exactement ce qu'une CI doit voir. Frontend : `tsc --noEmit` puis `next build`.

**Découverte pendant le câblage :** l'étage runtime du `Dockerfile`
n'installait que `gcc` et `libpq-dev`. WeasyPrint a besoin de Pango, HarfBuzz
et Cairo ; sans eux `import weasyprint` lève une `OSError` que `finance/pdf.py`
et `treasury/pdf.py` rattrapent en désactivant la génération PDF. Le conteneur
démarrait normalement et **les factures, reçus de versement et pièces de
caisse étaient silencieusement introuvables en production**. Les bibliothèques
sont ajoutées à l'image et au runner CI, pour que les tests exercent le rendu
réel plutôt que le chemin dégradé.

## 2. Sentry — livré

Backend et frontend, initialisés **uniquement si un DSN est présent** : le dev
et la CI n'acquièrent aucune dépendance réseau.

Aucune PII n'est transmise. Un `before_send` masque en plus les variables
locales des frames de traceback dont le nom évoque un secret — c'est
précisément là qu'un accès client déchiffré pourrait affleurer. **Session
Replay est volontairement absent** : il capturerait à l'écran des montants,
des identités et des accès clients.

`app/global-error.tsx` récupère les erreurs qui cassent le layout racine, hors
de portée de tout error boundary de page.

## 3. UI des versements — livré

Chaque ligne de facture se déplie sur ses versements : cumul encaissé, restant
dû, une ligne par échéance avec son numéro de reçu, et le passage en « reçu ».
Le restant dû vient du serveur, jamais recalculé côté composant : c'est la
donnée sur laquelle la comptabilité travaille, une seconde source finirait par
diverger.

**Trois défauts trouvés en écrivant les tests**, aucun n'étant couvert :

- `get_total_paid` agrégeait tous les versements `RECU` **puis rajoutait le
  versement courant**, déjà compris dans l'agrégat. Le restant dû affiché à la
  comptabilité et au client était faux d'exactement un versement.
- Rien ne bornait un versement au restant dû : une facture pouvait être
  encaissée au-delà de son TTC, le trop-perçu n'apparaissant nulle part.
- `Payment.attachments` n'existait pas, alors que le serializer exposait le
  champ et que la vue le préchargeait — **toute lecture d'un versement levait
  une `AttributeError`**, y compris l'action `receive`.

Les routes imbriquées ont aussi été réécrites : la version précédente
construisait un `DefaultRouter` puis piochait `urls[0].callback` en espérant
que ce soit la vue de liste, et le routeur des reçus déclaré à côté n'était
branché nulle part — les reçus étaient inatteignables.

## 4. Upload des pièces justificatives — livré

`core/attachment_views.py`. Le modèle portait déjà ses validateurs, rien ne
l'exposait : chèques, bordereaux et attestations de virement n'avaient aucune
voie d'entrée.

L'enjeu est l'autorisation, pas le CRUD. `DocumentAttachment` porte une
GenericForeignKey : un endpoint naïf laisse rattacher un fichier à n'importe
quelle ligne de n'importe quelle table, puis la relire. D'où
`ATTACHABLE_MODELS`, une **allowlist** de modèles cibles avec les rôles admis
sur chacun — ajouter un modèle au projet ne l'expose donc pas par accident. La
suppression efface une trace comptable : réservée à l'administration, et
journalisée avant l'acte.

**Le stockage demandait une décision.** `STORAGES['default']` est
`FileSystemStorage` et le disque de l'hébergeur est éphémère : un justificatif
écrit en local disparaît au déploiement suivant — perte de données sur des
pièces à valeur probante. Le bucket Supabase existant est *public*, ce qui
convient aux visuels du site vitrine et pas à un relevé bancaire. D'où
`SupabasePrivateStorage`, sur un bucket privé distinct, servi uniquement par
URL signée de courte durée, le chemin brut ne quittant jamais le serializer.

Écrit comme un `Storage` Django plutôt qu'en appelant l'upload depuis la vue,
pour que le `FileField` continue de fonctionner normalement.

## 5. Validation des timesheets — livré

Champs `is_validated` / `validated_by` / `validated_at` sur
`technique.TimeEntry`, avec actions dédiées `valider` / `devalider` plutôt
qu'un champ inscriptible : sans `read_only_fields`, **un développeur validerait
ses propres heures par un simple PATCH**. L'action vérifie que l'appelant
dirige ce projet précis ; `IsOwner`, qui protège les autres actions, serait ici
l'exact inverse du besoin.

Une entrée validée se fige — modification et suppression refusées, contrôle
placé dans `save()` autant que dans la vue pour couvrir l'admin Django, le
shell et les scripts. `devalider` est le seul chemin de correction ; les deux
actes sont journalisés.

**À trancher séparément :** deux systèmes de saisie de temps coexistent.
`projects.Timesheet` porte les statuts SOUMIS/VALIDE/REJETE et toute l'UI
timesheets ; `technique.TimeEntry` est imbriqué sous les tâches et **n'a aucun
consommateur frontend**. Cette correction aligne le second sur la règle du
premier, mais la duplication elle-même est une question de conception.

## 6. Rappels de maintenance — livré

`check_maintenance_due`, planifiée à 07:00 UTC — avant la journée de travail,
pour qu'un retard soit encore rattrapable le jour même.

La fenêtre se déduit de `expected_reports_per_week` plutôt que d'être codée en
dur : une app en maintenance mensuelle ne doit pas être signalée au bout de
deux jours. Les alertes vont à l'assigné, **ou aux responsables techniques
quand il n'y en a pas** — une app non attribuée est justement celle qu'on
oublie. La déduplication est bornée à la journée et non à l'app : un retard
doit continuer de remonter tant qu'il dure.

## 7. CSP — livré en Report-Only

En `Content-Security-Policy-Report-Only` et non bloquant : une directive trop
serrée casse une page en silence côté navigateur, sans erreur serveur pour le
signaler. On observe, on resserre, puis on bascule le nom de l'en-tête.

**Limite assumée :** `script-src` conserve `unsafe-inline`, l'App Router
injectant ses propres scripts inline pour l'hydratation et le streaming, sans
middleware à nonce pour l'instant. C'est le premier point à reprendre après la
phase d'observation. `frame-ancestors`, `object-src` et `base-uri` ferment déjà
le clickjacking, les plugins et la réécriture de `<base>`.

Livré avec `nosniff`, une politique de referrer, et un `Permissions-Policy`
qui refuse caméra, micro et géolocalisation — aucun écran ne s'en sert.

## 8. Exercice de restauration — non fait

Demande un accès aux sauvegardes Supabase que je n'ai pas. **Reste entièrement
à faire**, et c'est le point le plus coûteux à découvrir tard : une sauvegarde
jamais restaurée est une hypothèse, pas une garantie.

---

## Effets de bord corrigés

Les tests de pièces jointes exercent un vrai `FileField` ; sans `SUPABASE_URL`
le stockage retombe sur le disque local, et chaque exécution écrivait de vrais
PDF dans `backend/documents/` — committés par mégarde une fois. Une fixture
`autouse` pointe désormais `MEDIA_ROOT` sur un répertoire temporaire.

`core/tests_attachments.py` a été renommé `test_attachments.py` : `pytest.ini`
collecte `tests.py`, `test_*.py` et `*_tests.py`, et le nom d'origine ne
correspondait à aucun — le fichier passait quand on le nommait en ligne de
commande et **était ignoré par la suite complète**.

Les montants de l'écran Facturation portaient un `€` ; le reste de
l'application est passé au FCFA. Ils passent par `formatFcfa`.

---

## Vérifications

À chaque étape : `manage.py check` 0 issue, `makemigrations --check` sans
changement en attente, `tsc --noEmit` propre, `next build` réussi.

Suite backend : **421 tests, tous verts** (391 au rapport précédent ; +30 sur
les rappels de maintenance, la validation des timesheets, l'endpoint de pièces
jointes et les règles de montant des versements).

Ces tests ne sont plus une réserve dormante : la CI les exécute désormais à
chaque push.
