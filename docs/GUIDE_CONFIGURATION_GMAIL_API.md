# Guide — Configurer l'envoi d'e-mails via Gmail (pour tout le monde)

Ce guide explique, étape par étape et sans jargon technique, comment brancher
un compte Gmail pour que l'application puisse envoyer des e-mails
automatiques (accusés de réception, relances de devis/factures, alertes RH,
etc.).

**Vous n'avez besoin d'aucune compétence en programmation** pour suivre ce
guide. Il vous faut juste :
- Un accès au compte Google/Gmail qui enverra les e-mails (ex. `contact@sokensdigital.com`).
- Un ordinateur pour faire les manipulations une seule fois (avec Python installé — demandez à un développeur si ce n'est pas déjà le cas sur votre machine).
- Un accès au tableau de bord Render (ou au fichier `.env` du projet) pour coller le résultat final.

⏱️ **Temps nécessaire : environ 10-15 minutes**, à faire **une seule fois**.

---

## Pourquoi cette manipulation est nécessaire

L'application n'utilise **pas** un simple mot de passe Gmail pour envoyer des
e-mails (Google interdit cette méthode pour des raisons de sécurité). Elle
utilise une méthode plus sûre appelée **OAuth** : vous autorisez, une seule
fois, l'application à envoyer des e-mails en votre nom, et Google vous donne
en échange une sorte de "badge d'accès permanent" (appelé *refresh token*)
que l'application réutilise ensuite sans jamais revoir votre mot de passe.

Vous allez donc :
1. Créer une autorisation dans Google Cloud (gratuit, 5 minutes).
2. Lancer un petit script une fois sur votre ordinateur, qui va ouvrir une
   fenêtre de connexion Google.
3. Copier 4 lignes de texte que le script affiche, et les coller dans la
   configuration de l'application.

---

## Étape 1 — Activer l'API Gmail sur Google Cloud

1. Allez sur [console.cloud.google.com](https://console.cloud.google.com/) et
   connectez-vous avec **le compte Google qui enverra les e-mails**
   (ex. `contact@sokensdigital.com`), pas votre compte personnel.
2. En haut de la page, cliquez sur le sélecteur de projet, puis **"Nouveau
   projet"**. Donnez-lui un nom, par exemple `sokens-digital-mail`, et
   validez.
3. Une fois le projet créé et sélectionné, allez dans le menu ☰ (en haut à
   gauche) → **"API et services"** → **"Bibliothèque"**.
4. Dans la barre de recherche, tapez `Gmail API` et cliquez sur le résultat.
5. Cliquez sur le bouton bleu **"Activer"**.

✅ À ce stade, l'API Gmail est activée pour votre projet.

---

## Étape 2 — Créer les identifiants d'accès (OAuth)

1. Toujours dans **"API et services"**, allez dans **"Écran de consentement
   OAuth"** (dans le menu de gauche).
2. Choisissez le type **"Externe"** puis **"Créer"**.
3. Remplissez les champs obligatoires (nom de l'application, e-mail de
   contact) — le reste peut être laissé par défaut. Validez jusqu'à la fin
   de l'assistant ("Enregistrer et continuer" plusieurs fois).
4. Une fois revenu sur l'écran de consentement, cherchez la section
   **"Utilisateurs test"** (ou "Test users") et cliquez sur **"+ Ajouter des
   utilisateurs"**. Ajoutez l'adresse Gmail qui enverra les e-mails (celle
   avec laquelle vous êtes connecté).
   > Cette étape est nécessaire tant que l'application Google n'est pas
   > "publiée" officiellement — ce qui n'est pas utile pour un usage interne.
5. Retournez dans le menu de gauche → **"Identifiants"**.
6. Cliquez sur **"+ Créer des identifiants"** en haut → **"ID client OAuth"**.
7. Dans **"Type d'application"**, choisissez impérativement **"Application de
   bureau"** (*Desktop app*) — pas "Application Web".
8. Donnez-lui un nom (ex. `sokens-mail-sender`) et cliquez sur **"Créer"**.
9. Une fenêtre apparaît avec vos identifiants. Cliquez sur **"Télécharger le
   fichier JSON"** (icône de téléchargement). Un fichier est enregistré sur
   votre ordinateur.

✅ Vous avez maintenant un fichier téléchargé, quelque chose comme
`client_secret_XXXXXXXX.json`.

---

## Étape 3 — Lancer le script qui génère la clé finale

Cette étape se fait avec l'aide d'un terminal (invite de commandes). Si vous
n'êtes pas à l'aise, demandez à un développeur de l'équipe de faire cette
partie avec vous — elle prend 2 minutes.

1. Renommez le fichier téléchargé en `client_secret.json` (exactement ce
   nom) et placez-le dans le dossier `backend/scripts/` du projet.
2. Ouvrez un terminal dans le dossier `backend/` du projet et installez un
   petit outil nécessaire (une seule fois) :
   ```
   pip install google-auth-oauthlib
   ```
3. Lancez le script :
   ```
   python scripts/generate_gmail_refresh_token.py
   ```
4. Une page de connexion Google s'ouvre automatiquement dans votre
   navigateur. Connectez-vous avec le compte Gmail qui enverra les e-mails
   et cliquez sur **"Autoriser"** (Google peut afficher un avertissement
   "application non vérifiée" — c'est normal pour un usage interne, cliquez
   sur "Continuer"/"Avancé" pour poursuivre).
5. Revenez au terminal : 4 lignes s'affichent, ressemblant à ceci :
   ```
   GMAIL_CLIENT_ID=123456789-abcdefgh.apps.googleusercontent.com
   GMAIL_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxx
   GMAIL_REFRESH_TOKEN=1//0gxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   GMAIL_SENDER_EMAIL=<le compte Gmail utilisé>
   ```

✅ Gardez cette fenêtre ouverte (ou copiez ces 4 lignes dans un fichier
temporaire) — vous en avez besoin à l'étape suivante.

⚠️ **Ces 4 valeurs sont aussi sensibles qu'un mot de passe.** Ne les
partagez jamais par e-mail, chat, ou dans un endroit public. Elles seront
collées uniquement dans la configuration sécurisée de l'application
(voir étape 4).

---

## Étape 4 — Coller les valeurs dans l'application

### Si l'application tourne sur Render (production)

1. Allez sur [dashboard.render.com](https://dashboard.render.com/) et
   ouvrez le service du backend (l'API).
2. Allez dans l'onglet **"Environment"**.
3. Ajoutez (ou mettez à jour) ces 4 variables, une par une, avec les valeurs
   obtenues à l'étape 3 :
   - `GMAIL_CLIENT_ID`
   - `GMAIL_CLIENT_SECRET`
   - `GMAIL_REFRESH_TOKEN`
   - `GMAIL_SENDER_EMAIL`
4. Enregistrez. Render redémarre automatiquement le service avec les
   nouvelles valeurs — pas besoin de republier le code.

### Si vous testez en local (sur votre ordinateur)

Ouvrez le fichier `backend/.env` (créez-le en copiant `.env.example` si
besoin) et ajoutez les 4 lignes obtenues à l'étape 3, telles quelles.

---

## Étape 5 — Vérifier que ça fonctionne

Le moyen le plus simple : remplissez le formulaire public **"Démarrer un
projet"** sur le site avec une adresse e-mail que vous pouvez consulter, et
validez. Vous devez recevoir un e-mail d'accusé de réception dans les
minutes qui suivent.

Si rien n'arrive après quelques minutes, voir la section dépannage
ci-dessous, ou demandez à un développeur de vérifier les journaux
("logs") du service Render pour voir le message d'erreur exact.

---

## Dépannage — problèmes fréquents

| Symptôme | Cause probable | Solution |
|---|---|---|
| "Cette application n'est pas vérifiée" lors de la connexion Google | Normal pour un usage interne | Cliquer sur "Avancé" puis "Accéder à [nom de l'app] (dangereux)" |
| Erreur "invalid_grant" ou "access_denied" au moment de se connecter | Le compte Gmail n'a pas été ajouté comme "Utilisateur test" (étape 2.4) | Retourner dans l'écran de consentement OAuth et ajouter le compte |
| Aucun e-mail ne part, et aucune erreur visible | Une des 4 variables est absente ou mal copiée (espace en trop, ligne coupée) | Revérifier chaque variable collée dans Render, sans espace avant/après |
| "Cette application a été bloquée" | Un mauvais type d'application a été choisi à l'étape 2.7 | Recommencer l'étape 2 en choisissant bien "Application de bureau" |

---

## Bon à savoir

- **Le token ne expire pas** tant qu'il n'est pas révoqué manuellement. Vous
  n'aurez donc, normalement, jamais besoin de refaire cette procédure — sauf
  si vous changez de compte Gmail expéditeur, ou si l'accès est révoqué côté
  Google (voir ci-dessous).
- **Pour révoquer l'accès** (si besoin, ex. changement d'équipe) : allez sur
  [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
  avec le compte Gmail concerné, cherchez le nom de l'application créée à
  l'étape 2, et cliquez sur "Supprimer l'accès". Il faudra alors refaire ce
  guide pour réactiver l'envoi.
- **Sans ces variables configurées**, l'application ne plante pas : les
  e-mails sont simplement écrits dans les journaux techniques au lieu
  d'être réellement envoyés (utile en développement, insuffisant en
  production réelle).

---

*Pour la documentation technique complète (fonctionnement interne, code
concerné), voir [docs/NOTIFICATIONS_ET_EMAILS.md](NOTIFICATIONS_ET_EMAILS.md).*
