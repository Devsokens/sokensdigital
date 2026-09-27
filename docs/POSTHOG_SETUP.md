# PostHog — configuration de bout en bout

Tout le code est en place et poussé. Il ne reste que des clés à créer et à
coller : **aucune modification de code n'est nécessaire**. Tant que les clés
manquent, rien n'est collecté et les écrans affichent « non configuré »
plutôt qu'une erreur.

Compter ~20 minutes. Trois comptes sont concernés : PostHog, Vercel
(frontend), Render (backend).

---

## Étape 1 — Créer le projet PostHog (région UE)

1. Aller sur **https://eu.posthog.com/signup** — bien l'adresse en `eu.`,
   pas `us.` ni `app.`. La région se choisit à l'inscription et **ne peut
   plus être changée ensuite** : l'UE est imposée ici par la politique de
   confidentialité du site (données hébergées en Europe).
2. Créer l'organisation « Soken's Digital », puis un projet nommé
   `sokensdigital-prod`.
3. À la question « Où voulez-vous installer PostHog ? », choisir **Web /
   Next.js**, puis ignorer les instructions d'installation affichées : le
   code est déjà écrit et configuré différemment (proxy premier parti).

> Prévoir un second projet `sokensdigital-dev` plus tard si tu veux tester
> sans polluer les chiffres réels. Pas indispensable pour démarrer.

---

## Étape 2 — Récupérer les deux clés

PostHog a deux clés de nature très différente. Ne pas les confondre.

### 2a. Clé publique de projet (pour le navigateur)

1. Dans PostHog : **Settings** (roue dentée, en bas à gauche) → **Project** →
   **Project ID & API key**.
2. Copier la **Project API key**, qui commence par `phc_`.

Cette clé est faite pour être publique : elle ne permet que d'**envoyer** des
événements, jamais d'en lire. Aucun risque à l'exposer dans le navigateur.

Noter aussi le **Project ID** (un nombre, ex. `12345`) affiché sur la même
page : il servira à l'étape 3b.

### 2b. Clé personnelle (pour le serveur)

1. Dans PostHog : cliquer sur ton avatar (en bas à gauche) → **Personal API
   keys** → **Create personal API key**.
2. Nom : `sokens-backend-lecture`.
3. **Scopes** : ne cocher que **`query:read`**. C'est le minimum pour lire
   les tableaux de bord. Ne pas donner « All access ».
4. **Organization & project access** : limiter au projet `sokensdigital-prod`.
5. Copier la clé, qui commence par `phx_`. **Elle n'est affichée qu'une
   fois** — si elle est perdue, il faut en créer une autre.

> **Attention aux trois préfixes**, faciles à confondre :
>
> | Préfixe | Nom dans PostHog | Rôle | Où la mettre |
> |---|---|---|---|
> | `phc_` | Project API key | Envoyer des événements (publique) | Vercel, `NEXT_PUBLIC_POSTHOG_KEY` |
> | `phx_` | Personal API key | **Lire** les données | Render, `POSTHOG_PERSONAL_API_KEY` |
> | `phs_` | Project secret API key | Feature flags côté serveur | **Ni l'un ni l'autre ici** |
>
> Une clé `phs_` dans `POSTHOG_PERSONAL_API_KEY` donne un 403
> `"Personal API key ... is invalid"`, donc l'écran « Données momentanément
> indisponibles ». Elle est rejetée quelle que soit la région et le scope :
> c'est le type de clé qui est faux, pas sa configuration.

Cette clé lit tout le projet : elle ne doit **jamais** être préfixée
`NEXT_PUBLIC_`, ni collée côté Vercel, ni commitée. Elle va uniquement sur
Render, à l'étape 3b.

---

## Étape 3 — Coller les clés

### 3a. Vercel (frontend, site public)

**Project Settings → Environment Variables**, pour les environnements
Production **et** Preview :

| Nom | Valeur |
|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | la clé `phc_...` de l'étape 2a |
| `NEXT_PUBLIC_POSTHOG_UI_HOST` | `https://eu.posthog.com` |
| `POSTHOG_INGEST_HOST` | `https://eu.i.posthog.com` |
| `POSTHOG_ASSETS_HOST` | `https://eu-assets.i.posthog.com` |

Les deux dernières sont déjà les valeurs par défaut du code : les déclarer
n'est utile que pour changer de région un jour. On peut les omettre.

Puis **redéployer** : les variables `NEXT_PUBLIC_*` sont figées dans le code
au moment du build, les ajouter sans redéployer ne change rien.

### 3b. Render (backend, tableaux de bord)

**Service `sokens-backend` → Environment** :

| Nom | Valeur |
|---|---|
| `POSTHOG_PERSONAL_API_KEY` | la clé `phx_...` de l'étape 2b |
| `POSTHOG_PROJECT_ID` | le Project ID noté à l'étape 2a (ex. `12345`) |
| `POSTHOG_API_HOST` | `https://eu.posthog.com` |

Enregistrer déclenche un redéploiement automatique.

---

## Étape 4 — Vérifier que ça marche

### Côté collecte (site public)

1. Ouvrir **https://sokensdigital.com** dans une fenêtre de navigation privée.
2. Le bandeau cookies s'affiche → cliquer **« Tout accepter »**.
   *C'est indispensable : sans consentement analytique, PostHog n'est même
   pas téléchargé. C'est le comportement voulu, pas une panne.*
3. Naviguer sur deux ou trois pages.
4. Dans PostHog : **Activity** (ou **Live events**). Les événements
   `$pageview` doivent apparaître en quelques secondes.

Si rien n'arrive, vérifier dans l'onglet Réseau du navigateur qu'il y a bien
des requêtes vers `sokensdigital.com/ingest/...` (et non vers
`eu.i.posthog.com` directement — le proxy premier parti est voulu).

### Côté tableaux de bord (back-office)

1. Se connecter à l'admin.
2. **Marketing → Analytique web** et **Technique → Analytique web**.
3. Les chiffres apparaissent. Compter jusqu'à **10 minutes** avant de voir
   une nouvelle donnée : les résultats sont mis en cache pour ménager le
   quota de l'API PostHog. Le bouton ↻ ne contourne pas ce cache.

---

## Étape 5 — Réglages recommandés dans PostHog

Une fois les données qui arrivent :

- **Session replay** (Settings → Session replay) : désactivé par défaut. Si
  tu l'actives, l'enregistreur se télécharge chez les visiteurs — le code
  masque déjà toutes les saisies de formulaire. Penser à régler un
  échantillonnage (10 % suffit) pour ne pas consommer le quota.
- **Data retention** (Settings → Project) : réduire à 6 ou 12 mois. Moins de
  données conservées, c'est moins de risque et moins de coût.
- **Autocapture** : laissé actif par le code. Le désactiver dans PostHog
  couperait les clics automatiques mais garderait les événements métier.
- **Alertes** : PostHog peut prévenir par e-mail si les erreurs JS
  augmentent (Insights → créer une alerte sur `$exception`).

---

## Étape 6 — Obligation légale (à ne pas sauter)

La politique de confidentialité doit citer PostHog. Dans l'admin :
**Paramètres → Textes légaux → Politique de confidentialité**, ajouter un
paragraphe du type :

> Mesure d'audience : nous utilisons PostHog (PostHog Inc., données
> hébergées dans l'Union européenne) pour comprendre l'usage de ce site.
> Cette mesure n'est active qu'avec votre consentement, révocable à tout
> moment via le bandeau de gestion des cookies. Aucune donnée personnelle
> (nom, e-mail, téléphone) ne lui est transmise.

---

## Ce que le code garantit déjà (pour information)

- Rien n'est chargé ni envoyé sans consentement analytique explicite.
- Retrait du consentement → collecte coupée et enregistrement arrêté.
- Les jetons d'authentification présents dans les URLs (`/devis/<jeton>`,
  `?t=`) et les adresses e-mail sont masqués **avant** l'envoi.
- Aucun événement de l'espace `/admin` n'est collecté.
- La clé de lecture reste sur le serveur ; le navigateur ne peut jamais lire
  les données du projet.
- Chaque département ne voit que ses propres indicateurs.

## En cas de problème

| Symptôme | Cause la plus probable |
|---|---|
| Écran « PostHog n'est pas encore configuré » | `POSTHOG_PERSONAL_API_KEY` ou `POSTHOG_PROJECT_ID` absent sur Render |
| Aucun événement dans PostHog | Cookies analytiques refusés, ou `NEXT_PUBLIC_POSTHOG_KEY` absente / build non refait. **Vérifier le préfixe `NEXT_PUBLIC_`** : une variable nommée `POSTHOG_KEY` tout court n'est pas lue par le navigateur |
| « Données momentanément indisponibles » | Le plus souvent : mauvais **type** de clé (`phs_` ou `phc_` au lieu de `phx_`, voir le tableau des préfixes). Sinon : scope sans `query:read`, mauvais Project ID, ou clé créée dans l'autre région |

Pour vérifier une clé sans passer par un redéploiement, depuis n'importe quel
terminal (remplacer `<CLE>` et `<PROJECT_ID>`) :

```bash
curl -s -o /dev/null -w "%{http_code}\n" \
  -X POST "https://eu.posthog.com/api/projects/<PROJECT_ID>/query/" \
  -H "Authorization: Bearer <CLE>" -H "Content-Type: application/json" \
  -d '{"query":{"kind":"HogQLQuery","query":"SELECT 1"}}'
```

`200` = la clé fonctionne. `403` = mauvais type de clé ou mauvaise région.
`404` = mauvais Project ID.
| Chiffres figés | Cache de 10 minutes — normal |
