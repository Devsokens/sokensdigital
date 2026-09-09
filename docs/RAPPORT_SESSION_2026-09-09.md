# Rapport de session — 31 août au 9 septembre 2026

25 commits sur `main`, 90 fichiers, ~5 000 lignes ajoutées.
Suite de tests : **391 → 471**, toutes vertes. CI verte.

Ce rapport distingue trois natures de travail, parce qu'elles n'engagent pas
le même niveau de confiance : ce qui a été **vérifié en fonctionnement**, ce
qui a été **vérifié par les tests seulement**, et ce qui **reste à éprouver en
conditions réelles**.

---

## 1. Ce qui ne fonctionnait pas et a été réparé

Ces points partageaient un trait : le code existait, semblait complet, et ne
produisait rien. Aucun ne remontait d'erreur.

### Génération PDF cassée en production

L'étage runtime du `Dockerfile` n'installait ni Pango, ni HarfBuzz, ni Cairo.
`import weasyprint` levait alors une `OSError` que `finance/pdf.py` et
`treasury/pdf.py` rattrapent en désactivant la génération. Le conteneur
démarrait normalement et **factures, reçus de versement et pièces de caisse
étaient introuvables**, sans le moindre message.

### Aucun e-mail ne partait

Deux voies coexistaient. `core.notifications` passait par l'API Gmail ;
`technique.tasks` et `administration.tasks` appelaient `django.core.mail`, dont
le backend retombe sur la console faute de `EMAIL_HOST` — Render bloque le SMTP
sortant sur son offre gratuite. Accusés de ticket résolu et alertes
d'expiration RH s'écrivaient dans les logs.

`django.core.mail` s'appuie désormais sur l'API Gmail, en lui remettant l'objet
MIME que Django construit déjà. `send_mail` et `EmailMessage` fonctionnent tels
quels, **pièces jointes et HTML compris** — ce dont l'ancienne fonction, limitée
au texte brut, était incapable. C'est ce qui rend possible l'envoi de documents
à des interlocuteurs externes.

### Notifications push : rien n'existait

Le service worker n'avait aucun écouteur `push`. Chaîne complète construite :
`PushDevice` par appareil, envoi FCM en data-only (pour que le clic mène au bon
écran), écouteurs côté worker, activation depuis la cloche, jetons morts
supprimés à l'envoi et rafraîchis au chargement.

### Suivi de projet public : une maquette

Référence « SKN-2026-X92 » inventée, projet fictif, étapes figées, bouton NDA
pointant sur `#`. Pire : le formulaire affichait au client, après envoi, une
référence **tirée au hasard dans son navigateur** — absente de la base. Le suivi
n'aurait jamais rien trouvé, même une fois branché.

### 25 écrans sur 32 inaccessibles sur téléphone

La barre mobile ouvrait `items[0]` de chaque département et rien d'autre.
Injoignables : toute la Finance sauf un écran, le sous-groupe RH, Maintenance,
Décaissements. La sidebar bureau les listant tous, l'écart était invisible
depuis un poste de travail.

### Reçus de versement inatteignables

Le routeur des reçus était déclaré et branché nulle part. La route des
paiements tenait sur `urls[0].callback`, juste par accident d'ordre de
génération.

### Deux entrées mortes dans l'allowlist des pièces jointes

`finance.quote` et `procurement.disbursementrequest` ne désignaient aucun
modèle — `Quote` vit dans `marketing`, `DisbursementRequest` dans `finance`.
Les pièces sur devis et décaissements étaient inatteignables pendant que la
table se lisait comme une politique en vigueur.

---

## 2. Défauts trouvés en écrivant les tests

Ceux-là n'étaient pas cherchés. Ils sont apparus parce qu'écrire un test oblige
à énoncer ce que le code devrait faire.

**Restant dû faux d'un versement.** `get_total_paid` agrégeait les versements
reçus puis rajoutait le courant, déjà compris dedans. Le montant affiché à la
comptabilité et au client était faux d'exactement une échéance.

**Aucun plafond de versement.** Une facture pouvait être encaissée au-delà de
son TTC, le trop-perçu n'apparaissant nulle part.

**Toute lecture d'un versement plantait.** `Payment.attachments` n'existait pas
alors que le serializer l'exposait et que la vue le préchargeait.

**Références de suivi réattribuées.** Déduire le compteur du maximum existant
le fait reculer après une suppression : un second client recevait un numéro
déjà envoyé à quelqu'un d'autre. Et deux soumissions simultanées collisionnaient
sur la contrainte d'unicité, mettant le formulaire public en erreur pour une
raison incompréhensible au visiteur. Une séquence persistante avec
`select_for_update` règle les deux.

**Un fichier de tests jamais collecté.** `tests_attachments.py` ne
correspondait à aucun motif de `pytest.ini` — il passait quand on le nommait en
ligne de commande et était ignoré par la suite complète.

---

## 3. Sécurité

### XSS stocké par type MIME contrôlé par le client

`UploadedFile.content_type` est l'en-tête que l'émetteur choisit ; Django ne le
valide pas. Il était retransmis à Supabase comme type de stockage : un fichier
nommé `facture.pdf`, déclaré `text/html` et contenant du script, était servi en
`text/html` par le lien signé et s'exécutait sur l'origine Supabase du projet.

Corrigé d'abord sur le bucket privé, **puis sur les chemins publics** après
qu'une revue a montré que le même défaut y restait ouvert — et que ceux-là sont
plus exposés : bucket public, sans URL signée. Le SVG y était le cas direct, à
la fois type accepté et format traversant sans recompression ; il n'est plus
accepté, faute de moyen sûr de servir du SVG déposé par un utilisateur.

### Bucket privé supposé, jamais vérifié

La création était postée, la réponse ignorée. Un bucket `documents` préexistant
en public aurait reçu tous les justificatifs comptables — et Supabase autorise
l'énumération d'un bucket public sans authentification, ce qui annule la
protection des chemins en UUID. Rien dans l'application ne l'aurait signalé.

### Périmètre du Caissier

L'allowlist lui donnait les pièces des versements clients, que l'endpoint
`encaissements` lui refuse. Corrigé après vérification de ce qu'est réellement
le cloisonnement dans cette application : par type de source, pas par instance —
il n'existe aucune relation caissier↔caisse dans le schéma.

### Super-administrateur

`has_role` le fait désormais passer toute vérification sans qu'il soit listé.
Le privilège devient structurel plutôt que de dépendre de la vigilance de
chaque appelant — certains l'avaient déjà oublié. Vérifié avant application :
les contrôles qui *retirent* des droits selon le rôle interrogent
`user.roles.filter` directement, un super-admin n'est donc jamais traité comme
développeur par effet de bord.

### Autres

CSP en Report-Only, `nosniff`, politique de referrer, `Permissions-Policy`
refusant caméra/micro/géolocalisation. Sentry sans PII, avec masquage des
variables de traceback évoquant un secret ; Session Replay volontairement
absent, il capturerait montants et accès clients à l'écran.

---

## 4. Fonctionnalités livrées

- **UI des versements** — cumul, restant dû, reçus, passage en « reçu ».
- **Upload des pièces justificatives** — allowlist de modèles cibles, stockage
  privé Supabase par URL signée, suppression réservée à l'administration.
- **Validation des timesheets** par le chef de projet, entrée figée après
  validation.
- **Rappels de maintenance** — fenêtre déduite de la fréquence convenue,
  alerte aux responsables quand l'app n'est pas attribuée.
- **Suivi de projet public** — référence + e-mail, ou lien direct par jeton.
- **Champ téléphone** dans le formulaire de demande.
- **Parcours des projets soumis** entre Marketing et Technique, transitions
  déclarées en un seul endroit, notification du département qui reçoit.
- **Menu mobile en arc**, lisible de 320 à 820 px.
- **CI GitHub Actions** — Postgres 16 et non le SQLite de repli.

---

## 5. Ce que la vérification couvre, et ce qu'elle ne couvre pas

### Vérifié en fonctionnement

- **Responsive** : chaque route publique chargée à 320, 375, 390 et 768 px,
  `scrollWidth` mesuré contre `clientWidth`. Zéro débordement.
- **Menu en arc** : captures réelles aux quatre tailles, contrôle automatique
  qu'aucune bulle ni étiquette ne sort du cadre.
- **Migration PostgreSQL** : après l'échec de déploiement, PostgreSQL 16 lancé
  en conteneur. L'ancienne migration reproduit l'erreur à l'identique, la
  corrigée s'applique, et sur une base peuplée le remplissage numérote dans
  l'ordre et la séquence reprend au bon point.

### Vérifié par les tests seulement

L'endpoint de pièces jointes, les règles de versement, la validation des
timesheets, les rappels de maintenance, le suivi public et le parcours
inter-départements. **471 tests**, dont les refus autant que les cas nominaux.

### Non éprouvé en conditions réelles

- **L'envoi Gmail** est testé contre le backend en mémoire de Django. Ce qui
  est prouvé, c'est que le message est construit et remis — pas que Google
  l'accepte.
- **La livraison push** est testée jusqu'au stockage des jetons, pas jusqu'à
  l'aller-retour FCM.
- **Les écrans d'administration** exigent une session Firebase que je ne peux
  pas ouvrir hors ligne : leur responsive a été audité en lisant le code, pas
  en les affichant.
- **L'exercice de restauration de sauvegarde** n'a pas été fait — il demande un
  accès Supabase. Une sauvegarde jamais restaurée est une hypothèse.

---

## 6. Points ouverts

**Le mirroir GitHub n'a jamais fonctionné** : 100 exécutions, 0 succès. Le
mirroir GitLab, retiré, n'en avait aucun non plus. Il n'existe donc aujourd'hui
**aucune copie de sauvegarde du dépôt**. J'avais écrit en retirant GitLab que
le mirroir GitHub couvrait ce besoin ; c'était faux.

**SMTP et Render.** Le mot de passe d'application créé pour
`supportsokensdigital@gmail.com` se place dans `EMAIL_HOST_PASSWORD`. Mais
Render bloque les ports SMTP sortants sur l'offre gratuite, et `render.yaml`
déclare `plan: free` : la configuration marchera en local et restera muette en
production. Voies possibles : passer à un plan payant, ou utiliser l'API Gmail
(HTTPS, déjà prise en charge et prioritaire).

**Deux systèmes de saisie du temps.** `projects.Timesheet` porte les statuts et
toute l'interface ; `technique.TimeEntry` est imbriqué sous les tâches et n'a
aucun consommateur frontend. La validation a été alignée sur le premier, mais la
duplication est une question de conception.

**Deux modèles Project.** `technique.Project` et `projects.Project` coexistent.
Le passage en développement change l'étape de la demande sans créer de projet :
brancher la création automatique demande de savoir lequel fait foi.

**Les SVG déjà déposés** dans le bucket public restent servis et exécutables.
La correction bloque les nouveaux dépôts, elle ne nettoie pas l'existant.

**Variables à renseigner** : `NEXT_PUBLIC_FIREBASE_VAPID_KEY` et
`PUBLIC_SITE_URL`. Sans la seconde, les liens des e-mails de suivi mèneront
ailleurs.

---

## 7. Ce que cette session apprend sur le projet

Les défauts les plus coûteux ne se signalaient pas. PDF désactivés par un
`except OSError`, e-mails absorbés par le backend console, écrans sans chemin
d'accès, référence de suivi inventée côté navigateur : dans chaque cas le code
paraissait complet et l'absence de résultat ne remontait nulle part.

Trois pratiques les ont fait apparaître, et méritent d'être gardées :

1. **Écrire les tests d'abord révèle plus que relire.** Le double comptage des
   versements, la réattribution des références et l'`AttributeError` sur
   `Payment.attachments` sont sortis de là, pas d'une lecture.
2. **Tester sur le moteur de production.** SQLite n'a pas d'index `_like` : la
   migration cassée est passée verte 471 fois avant d'échouer au déploiement.
   La CI sur Postgres existe pour ça — encore faut-il regarder son résultat, ce
   que je n'avais pas fait.
3. **Regarder l'écran plutôt que le code.** Le stepper qui débordait à 320 px
   n'apparaissait dans aucune analyse statique.
