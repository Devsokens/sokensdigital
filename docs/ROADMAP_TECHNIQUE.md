# Roadmap technique — points reportés délibérément

Ce fichier recense les décisions d'architecture prises consciemment et
reportées, avec la raison du report. Rien ici n'est un oubli : chaque point
a été évalué contre le code existant avant d'être mis de côté.

---

## PostHog — analytique comportementale (14/09/2026)

**Collecte (site public)** — `frontend/lib/analytics/posthog.ts` :
- Chargé **uniquement après consentement « analytique »** du bandeau cookies ;
  le SDK n'est pas téléchargé avant (import dynamique → rien dans le bundle
  initial). Retrait du consentement → `opt_out_capturing()` + arrêt relecture.
- **Premier parti** : envois vers `/ingest`, relayé par Next vers PostHog UE
  (`next.config.ts` rewrites). Aucun domaine tiers côté navigateur, CSP inchangée.
- **Masquage avant envoi** (`before_send`) : `/devis/<jeton>` et `?t=`/`?token=`
  (vrais secrets d'authentification) remplacés, e-mails masqués, événements
  `/admin` écartés (on mesure les visiteurs, pas le personnel). Relecture de
  session avec toutes les saisies masquées ; `person_profiles: identified_only`.
- Capturé : pages vues (navigation App Router), sorties de page, autocapture,
  exceptions JS, Core Web Vitals, + événements métier `lead_submitted` et
  `quote_accepted` (**aucune donnée personnelle** : forme de la demande seulement).

**Lecture (back-office)** — `core/analytics.py` + `core/analytics_views.py` :
- Proxy Django authentifié vers l'API Query (HogQL) : la clé personnelle
  (accès lecture à tout le projet) ne quitte jamais le serveur.
- Cache 10 min par requête + plafond 60 req/min par utilisateur (quota PostHog).
- Cloisonné : `/api/v1/analytics/marketing/` (Resp. Marketing, Commercial,
  Admin, Super-Admin) — audience, sources, campagnes UTM, entonnoir jusqu'au
  devis accepté ; `/api/v1/analytics/technique/` (Chef de Projet, Développeur,
  Admin, Super-Admin) — erreurs JS, pages les plus lentes, LCP/INP/CLS p75,
  appareils/navigateurs.
- Écrans : Marketing → « Analytique web », Technique → « Analytique web »
  (modules `analytique-marketing` / `analytique-technique`, migration
  `core/0015` pour les rôles existants).

**À faire côté comptes (hors code, aucun accès depuis cette session)** :
1. Créer un projet PostHog en **région UE** (eu.posthog.com).
2. Vercel : `NEXT_PUBLIC_POSTHOG_KEY` = clé projet `phc_...` (Project settings).
3. Render : `POSTHOG_PERSONAL_API_KEY` (clé personnelle `phx_...`, scope
   `query:read` seulement) et `POSTHOG_PROJECT_ID`.
4. Optionnel : activer la relecture de session dans PostHog (désactivée côté
   projet = enregistreur jamais téléchargé).
5. Mettre à jour la politique de confidentialité (Paramètres) pour citer
   PostHog (UE) comme sous-traitant de mesure d'audience.

Sans ces clés : aucune collecte, et les écrans affichent « non configuré »
plutôt qu'une erreur.

## Conformité RGPD — textes légaux, case CGU/CGV, bandeau cookies (13/09/2026)

- **Textes légaux édités depuis Paramètres** (`SiteSettings.cgu_text` /
  `cgv_text` / `mentions_legales_text` / `politique_confidentialite_text`,
  texte brut) — publics sur `/cgu`, `/cgv`, `/mentions-legales`,
  `/confidentialite`. Vide tant que Marketing ne les a pas remplis (message
  d'attente affiché, pas une page cassée) — **ces 4 champs sont vides par
  défaut : le contenu juridique réel doit être saisi dans Paramètres avant
  mise en production**, ceci n'est que la plomberie.
- **Case CGU/CGV non pré-cochée, requise avant soumission** : formulaire
  public "Démarrer un projet" (`ProjectFormData.cguAccepted`, bloque le
  bouton final + re-vérifiée dans `goNext` en garde-fou) et portail
  d'acceptation de devis (case déjà existante, reformulée pour citer
  explicitement les CGV avec lien).
- **Bandeau cookies** (`components/cookie-consent-banner.tsx`,
  `lib/cookies/consent.ts`) : « Tout accepter » / « Tout refuser » à poids
  visuel égal (pas de dark pattern), + « Personnaliser » pour un choix par
  finalité (nécessaires toujours actifs, analytique, marketing). Stocké en
  `localStorage`, rien de déposé avant un choix explicite. **Aucun traceur
  analytique/publicitaire n'est câblé dans ce repo aujourd'hui** — le module
  existe pour que l'obligation soit respectée dès maintenant ; un futur
  script (Google Analytics, pixel Meta...) devra appeler `hasConsent()`
  avant de se charger plutôt que redéfinir son propre mécanisme de
  consentement.

---

## Notifications inertes — diagnostic du 13/09/2026 (config, pas du code)

Le code de bout en bout (écriture Firestore côté backend, lecture/abonnement
côté cloche `admin-header.tsx`, enregistrement du service worker + du
token push) est correct et bien branché — ce n'est pas du code mort. Deux
variables d'environnement manquent en production, avalées silencieusement
par design (`core/firestore_client.py` — "un envoi de notification raté ne
doit jamais faire échouer l'action métier qui l'a déclenché") :

- **`NEXT_PUBLIC_FIREBASE_VAPID_KEY`** (Vercel, frontend) — absente de
  `.env.prod` alors que `.env.example` la documente. Sans elle,
  `frontend/lib/push.ts` refuse tout net (`getPushPermission()` renvoie
  `"unsupported"`) : le push navigateur reste désactivé côté client, quel
  que soit l'état du backend. À prendre dans Firebase Console → Project
  Settings → Cloud Messaging → Web Push certificates.
- **`FIREBASE_SERVICE_ACCOUNT_JSON`** (Render, backend) — déclarée dans
  `render.yaml` avec `sync: false` (donc à saisir à la main dans le
  dashboard Render, jamais synchronisée automatiquement) ; si absente ou
  invalide, `core/apps.py` ne peut pas initialiser le SDK Admin et chaque
  `notify()`/`notify_roles()` échoue en silence — la cloche in-app reste
  vide sans jamais afficher d'erreur nulle part.

Les deux lignes ont été ajoutées (vides, à remplir) dans `.env.prod` local
pour qu'elles ne soient plus silencieusement absentes du template — mais
`.env.prod` n'est qu'une référence locale (gitignored, valeurs fictives) :
les vraies valeurs doivent être saisies directement dans Vercel et Render,
aucun accès à ces deux tableaux de bord n'existe depuis cette session.

**Vérification une fois les deux valeurs saisies** : recharger l'admin,
ouvrir la cloche — un `notify()` déclenché (ex: créer un utilisateur) doit
apparaître sans redéploiement supplémentaire.

---

## Devis accepté → projet Technique — décision du 13/09/2026

Accepter un devis (portail public, e-signature) ne faisait jusqu'ici que
changer son statut — Technique n'avait aucun moyen de savoir qu'un projet
venait d'être vendu sans qu'on le lui dise à la main.

`PublicQuoteAcceptView` crée désormais automatiquement le `projects.Project`
correspondant (nom = `{client} — {n° devis}`, budget = total TTC du devis),
l'associe au devis (`Quote.project`, nouveau FK), et prévient
Marketing→Technique (`notify_roles`, push uniquement — pas encore listé
"très critique"). `projects.Project`, pas `technique.Project` (l'autre
modèle du même nom) : c'est celui que lit l'écran "Projets" de Technique
(`/api/v1/projects/`), et son `lead_project_manager` est nullable — le
projet peut donc exister avant qu'un chef de projet lui soit assigné,
contrairement à `technique.Project` qui l'exige à la création. Idempotent :
`PublicQuoteAcceptView` court-circuite déjà tout ré-appel une fois le devis
`ACCEPTE`, donc aucun risque de projet dupliqué sur un double clic.

---

## Suivi public aligné sur le parcours réel — décision du 13/09/2026

Les 5 étapes affichées au public (`Lead.TRACKING_STEPS`) étaient dérivées
de `Lead.Status` (le pipeline commercial interne : Nouveau/Qualifié/
Proposition en cours/Perdu/Converti) alors que Marketing et Technique
suivent au quotidien un champ complètement différent et indépendant,
`Lead.WorkflowStage` (Soumis→Chez Technique→CDC prêt→Soumis au
client→Validé par le client→En développement, voir `marketing/workflow.py`
et l'écran "projets soumis"). Une demande pouvait donc avancer réellement
chez Technique pendant des semaines tout en restant affichée "Nouveau"
côté client — les deux champs ne bougent pas ensemble.

Les 6 étapes publiques sont maintenant dérivées de `WorkflowStage`, avec un
vocabulaire simplifié plutôt que le jargon interne : Demande reçue /
Analyse en cours / Proposition en préparation / Proposition envoyée /
Proposition validée / Projet en réalisation. Le rejet (`RejectLeadView`,
qui clôture via `status=PERDU`) garde la priorité d'affichage ("Demande
clôturée") quelle que soit l'étape du workflow au moment du refus.

---

## Responsive mobile-first des tableaux admin — décision du 11/09/2026

Tous les tableaux de données admin (finance, rh, technique, marketing,
support — 22 tableaux) utilisaient un pattern unique jusqu'ici : scroll
horizontal en dessous du point de rupture, avec un cas qui forçait carrément
`min-width: 720px` (technique/project-list.tsx). Aucun n'avait de layout
carte empilée sur mobile.

**Fix appliqué** : classe CSS `.table-responsive` (`app/globals.css`) — sous
640px, chaque `<tr>` devient une carte empilée et chaque `<td>` affiche
l'en-tête de sa colonne via `data-label`, sans toucher à la structure JSX
des tableaux (juste la classe sur `<table>` + un attribut par `<td>`). Un
seul point de définition CSS pour un rendu cohérent partout, plutôt que 22
layouts de carte bricolés à la main.

**Volontairement non converties** (2 cas — ce ne sont pas des tableaux de
données) :
- `technique/team-timesheet.tsx` — grille hebdomadaire (colonnes = jours).
  Empiler les jours en liste verticale détruirait la structure calendrier
  plutôt que l'améliorer ; le scroll horizontal reste la bonne UX ici.
- `technique/project-task-board.tsx` — tableau kanban (colonnes = statuts),
  horizontal par nature, pas une liste d'enregistrements.

---

## 0. Notifications systématiques création/suppression/rejet — portée retenue

**Décision du 10/09/2026.** Le principe "toute création/suppression/rejet
notifie" a été appliqué de façon ciblée plutôt que sur chaque endpoint
DELETE/POST de l'appli (~40+ endroits) — décision explicite de l'utilisateur.

**Objets couverts** (push systématique, e-mail en plus pour les actions
très critiques listées) : utilisateurs, projets (technique et projects),
factures, devis, demandes (leads). `core.notifications.notify_roles()`
prévient tout titulaire d'un rôle donné (pas de champ "responsable de
département" — Department n'en a pas, voir core.models.Department — le
rôle en tient lieu, même logique que `_notify_receiving_side`).

**Actions très critiques (push + e-mail)** :
- Suppression d'un utilisateur (`DeactivateUserView` — désactivation, pas
  suppression réelle, pour préserver l'historique audit/finance).
- Attribution ou retrait du rôle SUPER_ADMIN.
- Suppression d'une facture ou d'un devis déjà validé/envoyé (un brouillon
  supprimé reste push seul).
- Rejet d'un projet soumis (`RejectLeadView`, ouvert à Marketing ET
  Technique quelle que soit l'étape courante — la demande a pu transiter
  par les deux avant d'être jugée non viable ; clôture via `status=PERDU`,
  motif obligatoire, double confirmation côté frontend).

**Non couvert délibérément** : suppressions mineures (tag, brouillon CMS,
pièce jointe, etc.) — bruit sans valeur si notifié à chaque fois.

---

## 1. Stockage des fichiers — état actuel et bascule V2 prévue

**Décision du 10/09/2026, révisée le même jour (bascule vers des buckets
privés dédiés).**

| Contenu | Backend actuel | Backend prévu V2 |
|---|---|---|
| Avatars | Supabase Storage, bucket **privé** `pieces_jointes`, URL signée 7 jours | Cloudinary |
| Pièces jointes chat | Supabase Storage, bucket **privé** `pieces_jointes`, URL signée 7 jours | Cloudinary |
| Documents joints au formulaire public de démarrage de projet | Supabase Storage, bucket **privé** `demandes-projet`, URL signée 7 jours, PDF uniquement, 15 Mo max | Inchangé |
| Sections CMS, visuels vitrine, projets showcase | Supabase Storage, bucket **public** `site-content`, 5 Mo max | Supabase Storage (inchangé) |
| Messages et métadonnées de chat | Firestore | Firestore (inchangé) |
| Justificatifs comptables (chèques, bordereaux…) | Supabase Storage, bucket **privé** `documents`, URL signée 5 min | Inchangé |

`core/storage.py` : `upload_avatar()` et `upload_file()` (pièces jointes
chat) appellent désormais `_upload_to_private_bucket()` +
`_sign_private_url()` (bucket `pieces_jointes`) au lieu de
`_upload_to_cloudinary()`. La fonction Cloudinary elle-même **n'a pas été
supprimée** — elle n'a plus d'appelant aujourd'hui, mais c'est exactement ce
dont la bascule V2 aura besoin pour ces deux chemins ; inutile de la
réécrire à ce moment-là. Un test dédié (`CloudinaryPublicIdTests`) continue
de l'exercer directement pour qu'elle ne se dégrade pas en silence faute
d'appelant.

Le bucket `demandes-projet` est distinct du bucket `documents` existant :
`documents` sert déjà, en production, aux justificatifs comptables (chèques,
bordereaux) et n'a pas été touché. Un même nom pour deux usages différents
aurait mélangé deux domaines sans rapport (finance interne / demandes
publiques) dans le même espace de noms.

### Type de fichiers acceptés par bucket privé

- **`pieces_jointes`** (avatars + pièces jointes chat, 15 Mo max) :
  `.png`, `.jpg/.jpeg`, `.pdf`, `.doc`, `.md`, `.mp3`, `.wav`.
  **SVG délibérément exclu** — un SVG est un document scriptable (il peut
  embarquer du JavaScript exécuté à l'ouverture). Le rendre privé ne change
  rien à ce risque : une URL signée protège *qui* peut ouvrir le fichier, pas
  *ce que fait* le fichier une fois ouvert. Ce risque avait déjà été fermé
  ailleurs dans ce projet pour cette raison ; l'exception n'a pas été faite
  ici non plus.
- **`demandes-projet`** (pièce jointe du formulaire public, 15 Mo max) :
  `.pdf` uniquement.

### URL signée à durée longue, stockée telle quelle — compromis accepté

Rendre `pieces_jointes` privé casse l'hypothèse implicite que
`User.avatar_url` et les champs de pièce jointe Firestore contiennent une
URL permanente. Deux options existaient : (a) un endpoint backend qui
re-signe à la volée à chaque affichage, ou (b) signer une fois à l'upload
avec une durée longue (7 jours) et stocker cette URL telle quelle.

**Décision : option (b).** Compromis accepté explicitement : un avatar ou
une pièce jointe non rouverte dans les 7 jours suivant son upload cessera de
charger silencieusement (URL expirée), sans mécanisme de renouvellement
automatique. Si ça devient un problème perceptible en usage réel, l'option
(a) — endpoint de re-signature à la demande — est la suite logique.

### Pourquoi Cloudinary avait été choisi initialement pour ces deux cas

### Pourquoi Cloudinary avait été choisi initialement pour ces deux cas

Le commentaire d'origine dans le code l'expliquait : *« le projet Supabase
est déjà au-dessus de son quota d'egress gratuit »*. Ce n'était pas un choix
arbitraire — Cloudinary répartissait la charge entre deux fournisseurs.
Router avatars et pièces jointes vers Supabase **concentre à nouveau tout le
trafic de fichiers sur un seul fournisseur**, dont le quota gratuit était
déjà dépassé avant cette bascule.

**À surveiller concrètement :** le tableau de bord Supabase (Project
Settings → Usage → Storage egress). Si le volume redevient un problème,
deux options sans tout réécrire : avancer la bascule Cloudinary prévue pour
la V2, ou passer sur un plan Supabase payant.

### Écart de confidentialité introduit

Le bucket `site-content` est public — pensé pour des visuels marketing,
sans contrôle d'accès au-delà d'un chemin en UUID non listable. Une pièce
jointe de chat peut porter un contenu plus sensible qu'une photo d'équipe
(capture d'écran d'un client, document interne partagé entre collègues) et
hérite pourtant du même niveau de confiance qu'une image vitrine — aucune
restriction par utilisateur, aucune expiration.

Ce n'est pas une régression : c'est le même compromis qu'avant (Cloudinary
en accès public simple, sans URL signée non plus), donc aucune protection
n'est perdue dans l'absolu. Mais ça vaut la peine d'être tranché
explicitement au moment de la bascule V2 plutôt que reconduit par défaut —
en particulier si les pièces jointes chat doivent un jour porter des
documents dont la sensibilité dépasse celle d'un visuel marketing.

---

## 2. Background Sync API (écritures hors ligne)

**Statut : non implémenté.**

Le service worker (`frontend/public/sw.js`) refuse aujourd'hui toute
interception d'écriture (`if (request.method !== "GET") return;`), et son
commentaire l'explique : rejouer une validation de facture en silence après
une reconnexion serait un incident comptable, pas une commodité.

Construire ceci correctement suppose de choisir, **action par action**,
lesquelles sont sûres à mettre en file d'attente hors ligne :

- Une action est candidate si elle est **idempotente ou sans risque de
  double effet métier** — par exemple, marquer un ticket support comme lu,
  ou une modification de préférence d'affichage.
- Une action ne l'est **pas** si elle touche à un solde, un statut de
  validation à plusieurs paliers (décaissement RCF → Gérant), ou toute
  écriture financière — la rejouer deux fois, ou la rejouer sur un état qui
  a changé entre-temps (quelqu'un d'autre a déjà approuvé/rejeté), produit
  une incohérence comptable silencieuse.

**Estimation à ce stade :** probablement aucune action côté Finance/
Trésorerie/Achats n'est un candidat sûr sans une revue explicite de son
idempotence. Des candidats plausibles côté RH, Support ou Messagerie
existent, mais n'ont pas été inventoriés.

**Prochaine étape, quand ce sera repris :** lister chaque endpoint
d'écriture par département, marquer idempotent/non-idempotent, et ne
construire la file d'attente que pour la première catégorie.

---

## 3. Protocole réseau (HTTP/3, gRPC/Protobuf, MessagePack)

**Statut : non implémenté.**

Trois changements de nature différente, tous plus larges qu'une décision de
code isolée :

- **HTTP/3 (QUIC)** — se configure au niveau de l'hébergeur/CDN (Render), pas
  dans le code de l'application. Aucune action de mon côté n'active ça ;
  c'est un réglage à vérifier/demander côté plateforme.
- **gRPC-Web / Protocol Buffers** — remplacerait REST+JSON comme contrat
  d'API. Cela touche **chaque endpoint**, **chaque appel frontend**, et la
  génération de schémas des deux côtés. Un changement de cette ampleur en
  silence, sans validation progressive, est le genre de décision qui peut
  casser des écrans entiers sans qu'un test l'attrape avant la production.
- **MessagePack** — plus contenu qu'un remplacement complet de REST, mais
  demande quand même un middleware de (dé)sérialisation des deux côtés et
  un accord explicite sur quels endpoints en bénéficient (les listes
  volumineuses — Grand Livre, historique — en tireraient le plus, un
  formulaire de connexion quasiment rien).

**Recommandation si ce chantier est repris :** commencer par MessagePack sur
un ou deux endpoints à fort volume (export Grand Livre, listing paginé le
plus consulté), mesurer le gain réel, avant d'envisager gRPC pour le reste.

---

## 4. AVIF/WebP via `next/image`, BlurHash, CSS critique, Web Workers, budget JS

**Statut : non implémenté.**

Regroupés parce qu'ils partagent la même raison de report : ce sont des
améliorations de rendu qui **doivent être vérifiées visuellement**, pas
seulement au typecheck ou au build.

- **Migration `<img>` → `next/image` (AVIF/WebP)** — 33 balises `<img>`
  brutes au total dans le projet. `next.config.ts` autorise déjà les hosts
  distants nécessaires (Cloudinary, Supabase) pour que `next/image`
  fonctionne dessus, donc le blocage technique est levé — mais chaque
  composant migré change potentiellement le comportement de mise en page
  (`next/image` impose des dimensions ou un `fill` avec conteneur
  positionné) et mérite un rendu comparé avant/après, pas une bascule en
  masse.
- **BlurHash / placeholders micro-SVG** — utile seulement une fois la
  migration `next/image` commencée (c'est son mécanisme de `placeholder`
  qui les consomme nativement).
- **CSS critique inline** — Next.js optimise déjà le CSS par route ; une
  extraction manuelle du critique irait à l'encontre de ce pipeline plutôt
  que l'améliorer, sauf mesure précise montrant un vrai gain.
- **Web Workers** — aucun traitement CPU lourd identifié aujourd'hui côté
  client qui bloque le thread principal de façon mesurable ; à réévaluer si
  un écran précis (filtrage de grandes listes, par exemple) montre un
  ralentissement réel.
- **Budget JS strict (100 Ko gzip initial)** — pas mesuré à ce jour. Première
  étape si repris : lancer `next build` avec l'analyseur de bundle et
  constater l'écart réel avant de fixer une limite arbitraire.

**Recommandation si ce chantier est repris :** traiter la migration
`next/image` écran par écran (vitrine d'abord — trafic public, poids image
le plus fort), avec une capture d'écran avant/après pour chaque composant
touché.
