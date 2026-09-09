# E-mails, suivi public et notifications — configuration

Trois mécanismes qui existaient à l'état d'ébauche et qui sont désormais
branchés. Chacun demande des variables d'environnement pour fonctionner
réellement ; sans elles, l'application marche mais le canal reste muet.

---

## 1. E-mails

### Ce qui n'allait pas

Deux voies d'envoi coexistaient. `core.notifications` passait par l'API Gmail ;
`technique.tasks` et `administration.tasks` appelaient `django.core.mail`, dont
le backend retombe sur la console faute de `EMAIL_HOST` — Render bloque les
ports SMTP sortants sur son offre gratuite. Les accusés de résolution de ticket
et les alertes d'expiration de documents RH s'écrivaient donc dans les logs et
n'atteignaient personne.

### Ce qui a changé

`django.core.mail` s'appuie maintenant sur l'API Gmail
(`core.mail_backend.GmailAPIBackend`). Le backend transmet à Gmail l'objet MIME
que Django a déjà construit, donc `send_mail`, `EmailMessage` et
`EmailMultiAlternatives` fonctionnent tels quels — **pièces jointes et corps
HTML compris**, ce dont `email_gmail.send_email` était incapable, limité au
texte brut. C'est ce qui rend possible l'envoi de documents à des
interlocuteurs externes.

`core.mailer` est le point d'entrée applicatif : gabarit HTML, bouton d'action,
type `Attachment`. Plus rien n'appelle l'API Gmail directement, ce qui laisse
la possibilité de changer de fournisseur en touchant un seul fichier.

### Variables

| Variable | Rôle |
|---|---|
| `GMAIL_CLIENT_ID` | Client OAuth « Desktop app » |
| `GMAIL_CLIENT_SECRET` | idem |
| `GMAIL_REFRESH_TOKEN` | Obtenu une fois via `scripts/generate_gmail_refresh_token.py` |
| `GMAIL_SENDER_EMAIL` | Compte expéditeur |
| `PUBLIC_SITE_URL` | Base des liens envoyés par e-mail |

L'ordre de préférence est : API Gmail dès que `GMAIL_CLIENT_ID` et
`GMAIL_REFRESH_TOKEN` sont présents, puis SMTP si `EMAIL_HOST` est fourni,
puis la console. **Aucune variable : rien ne part, et rien ne plante.**

Gmail envoie toujours depuis le compte propriétaire du jeton ; une adresse
d'expéditeur différente serait réécrite. `DEFAULT_FROM_EMAIL` s'aligne donc sur
`GMAIL_SENDER_EMAIL` par défaut.

---

## 2. Suivi de projet public

### Ce qui n'allait pas

La page affichait une maquette : référence « SKN-2026-X92 » inventée, projet
fictif, étapes figées, bouton NDA pointant sur `#`. Aucun formulaire, aucun
appel API. Et le formulaire de demande affichait au client, après envoi, une
référence **tirée au hasard dans son navigateur** — donc absente de la base.

### Ce qui a changé

`Lead` porte une `tracking_reference` et un `tracking_token`. Deux chemins :

- **Référence + e-mail**, ce que le client saisit. Les deux sont exigés : une
  référence seule se devine (`SKN-2026-0002` suit `SKN-2026-0001`), et une
  suite lisible ne doit pas laisser parcourir le carnet de commandes. Une
  référence inconnue et une adresse qui ne correspond pas donnent la même
  réponse, sans quoi on confirmerait l'existence d'une demande.
- **Jeton**, pour le lien direct de l'e-mail d'accusé de réception.

Rien d'interne ne sort : ni score de qualification, ni valeur estimée, ni
commercial assigné.

### Le compteur de références

Écrire les tests a montré deux défauts d'une numérotation déduite du maximum
existant : une suppression fait **réattribuer une référence déjà envoyée par
e-mail à quelqu'un d'autre**, et deux soumissions simultanées produisent la
même référence, dont l'une échoue sur la contrainte d'unicité — un formulaire
public en erreur pour une raison que le visiteur ne peut pas comprendre. D'où
une séquence persistante par année, avec `select_for_update`.

---

## 3. Notifications

### In-app

Existant, inchangé : Firestore, lu par la cloche de `admin-header.tsx`.

### Push navigateur

N'existait pas du tout — le service worker n'avait aucun écouteur `push`.

Le backend envoie via Firebase Cloud Messaging (`core.push`), en **data-only** :
sans bloc `notification`, c'est le service worker qui affiche la notification,
ce qui permet de router le clic vers le bon écran. Une charge `notification`
s'afficherait d'elle-même et le worker ne verrait jamais l'événement.

`PushDevice` garde un jeton par navigateur et par appareil : la même personne
au bureau, sur son téléphone et sur la PWA installée en a trois, et la
notification doit atteindre celui qu'elle a sous les yeux. Les jetons que
Firebase déclare morts sont supprimés à l'envoi, sans quoi chaque notification
ultérieure les retenterait.

L'autorisation est demandée depuis le panneau de la cloche, sur un geste
explicite : le navigateur ne pose la question qu'une fois et un refus est
définitif.

### Variable requise

| Variable | Rôle |
|---|---|
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Clé publique Web Push du projet Firebase (Console → Paramètres → Cloud Messaging → Certificats push web) |

Sans elle, l'activation se déclare simplement indisponible et rien ne casse.

Le backend utilise le même compte de service Firebase que l'authentification,
déjà configuré (`FIREBASE_SERVICE_ACCOUNT_JSON`).

---

## Ce qui reste à vérifier hors de mon périmètre

Ces trois chaînes traversent des services externes que je ne peux pas
exercer d'ici :

- **L'envoi Gmail réel** n'a pas été testé contre l'API : les tests utilisent
  le backend en mémoire de Django. Ce qui est vérifié, c'est que le message
  est construit et remis au backend, pas que Google l'accepte. Le premier
  envoi en conditions réelles reste à faire.
- **La livraison push réelle** demande un navigateur, une clé VAPID et un
  projet Firebase. Les tests couvrent le stockage et le tri des jetons, pas
  l'aller-retour avec FCM.
- **`PUBLIC_SITE_URL`** doit pointer sur le domaine réel, sinon les liens des
  e-mails de suivi mèneront ailleurs.
