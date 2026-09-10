# Roadmap technique — points reportés délibérément

Ce fichier recense les décisions d'architecture prises consciemment et
reportées, avec la raison du report. Rien ici n'est un oubli : chaque point
a été évalué contre le code existant avant d'être mis de côté.

---

## 1. Stockage des fichiers — état actuel et bascule V2 prévue

**Décision du 10/09/2026.**

| Contenu | Backend actuel | Backend prévu V2 |
|---|---|---|
| Avatars | Supabase Storage (bucket public `site-content`) | Cloudinary |
| Pièces jointes chat | Supabase Storage (bucket public `site-content`) | Cloudinary |
| Sections CMS, visuels vitrine, projets showcase | Supabase Storage | Supabase Storage (inchangé) |
| Messages et métadonnées de chat | Firestore | Firestore (inchangé) |
| Justificatifs comptables (chèques, bordereaux…) | Supabase Storage, **bucket privé**, URL signée | Inchangé |

`core/storage.py` : `upload_avatar()` et `upload_file()` (pièces jointes
chat) appellent désormais `_upload_bytes()` (Supabase) au lieu de
`_upload_to_cloudinary()`. La fonction Cloudinary elle-même **n'a pas été
supprimée** — elle n'a plus d'appelant aujourd'hui, mais c'est exactement ce
dont la bascule V2 aura besoin pour ces deux chemins ; inutile de la
réécrire à ce moment-là. Un test dédié (`CloudinaryPublicIdTests`) continue
de l'exercer directement pour qu'elle ne se dégrade pas en silence faute
d'appelant.

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
