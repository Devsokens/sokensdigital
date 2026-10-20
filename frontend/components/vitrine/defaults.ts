import type { Section } from "./cms";

/* Textes par défaut des sections de la vitrine : les mêmes que ceux écrits
 * dans le CMS par la migration backend 0039_seed_vitrine_v2_content. Ils ne
 * servent que de repli (API injoignable, section absente ou champ vidé). */

type Defaults = Partial<Section>;

export const HERO: Defaults = {
  title: "Votre projet digital, *conçu sur mesure.*",
  subtitle: "De l'idée à la mise en ligne, nous concevons des outils simples et fiables, adaptés à votre activité. Et nous restons à vos côtés pour les faire évoluer.",
  ctaLabel: "Démarrer un projet",
  ctaLink: "/contact",
  ctaSecondaryLabel: "Voir notre expertise",
  ctaSecondaryLink: "/expertise",
  items: [
    { value: "10+", label: "projets livrés" },
    { value: "10+", label: "clients accompagnés" },
    { value: "2 ans", label: "d'expérience" },
  ],
  extra: {
    rotating_prefix: "Nous créons votre",
    rotating_words: ["site web", "application mobile", "logiciel sur mesure", "plateforme en ligne"],
  },
};


export const PARTNERS: Defaults = {
  title: "Ils nous font confiance",
  items: [{ name: "CYBERCORE" }, { name: "Workclass" }, { name: "NFL Courtier & Service" }],
};

export const SERVICES: Defaults = {
  kicker: "Nos services",
  title: "Tout ce qu'il faut pour digitaliser votre activité",
  subtitle: "Un seul partenaire, de l'idée à la mise en ligne, puis pour faire évoluer votre outil au fil du temps.",
  items: [
    { title: "Sites & plateformes web", description: "Site vitrine, plateforme de réservation, espace client… Un outil en ligne rapide, clair et accessible sur tous les écrans.", points: ["Pensé pour mobile, tablette et ordinateur", "Simple à mettre à jour", "Hébergé et sécurisé"], visual: "web" },
    { title: "Applications mobiles", description: "Une application iPhone et Android pour vos clients ou pour vos équipes sur le terrain.", points: ["Disponible sur iPhone et Android", "Notifications en temps réel", "Connectée à vos outils"], visual: "mobile" },
    { title: "Logiciels sur mesure", description: "Remplacez le papier et les fichiers Excel par un outil fait pour votre façon de travailler : gestion, suivi, réservations, stocks…", points: ["Adapté à vos méthodes de travail", "Moins de tâches répétitives", "Toutes vos informations au même endroit"], visual: "logiciel" },
    { title: "Audit & modernisation", description: "Votre application est lente, vieillissante ou fragile ? Nous l’analysons, la sécurisons et la modernisons, y compris avec l’intelligence artificielle.", points: ["Un diagnostic clair et compréhensible", "Corrections et sécurité renforcée", "Ajout de fonctions IA"], visual: "audit" },
  ],
};

export const RECENT_PROJECTS: Defaults = {
  kicker: "Réalisations",
  title: "Nos derniers projets",
  ctaLabel: "Tous nos projets",
  ctaLink: "/projects",
};

export const TEAM: Defaults = {
  kicker: "Équipe",
  title: "Les visages derrière vos projets",
  subtitle: "Une équipe complète, basée à Libreville, qui vous accompagne du premier échange jusqu'au lancement.",
  items: [
    { name: "Jackie MOUBEYI", role: "Marketing digital & relation client", bio: "Votre premier contact : elle écoute votre besoin, vous conseille et suit votre projet jusqu’au lancement." },
    { name: "Herbert OTHA", role: "Développeur full stack", bio: "Il conçoit et développe vos sites, applications et logiciels, de l’écran jusqu’au serveur." },
    { name: "Delfrehl MOUDJIEGOU MBOUMBA", role: "Développeur full stack", bio: "Il transforme vos idées en fonctionnalités concrètes, simples à utiliser au quotidien." },
    { name: "Edi SOKENOU", role: "Développeur full stack", bio: "Il veille à la qualité et à la fiabilité de chaque livraison, avant comme après la mise en ligne." },
  ],
};

export const BLOG_INSIGHTS: Defaults = {
  kicker: "Blog",
  title: "Actualités & conseils",
  ctaLabel: "Tous les articles",
  ctaLink: "/blog",
};

export const HOME_CTA: Defaults = {
  title: "Un projet en tête ? *Parlons-en.*",
  subtitle: "Expliquez-nous votre besoin en quelques mots. Nous vous répondons rapidement avec des premières pistes.",
  ctaLabel: "Démarrer un projet",
  ctaLink: "/contact",
};

export const EXPERTISE_HERO: Defaults = {
  title: "Du besoin à la solution, *étape par étape.*",
  subtitle: "Une méthode claire, des technologies fiables et une équipe qui vous accompagne du premier échange jusqu'après la mise en ligne.",
  ctaLabel: "Démarrer un projet",
  ctaLink: "/contact",
  ctaSecondaryLabel: "Voir nos réalisations",
  ctaSecondaryLink: "/projects",
};

export const PROMISES: Defaults = {
  kicker: "Nos engagements",
  title: "Trois promesses, sur chaque projet",
  items: [
    { icon: "shield-check", short: "Sécurité", title: "Sécurisé dès le départ", description: "Vos données et celles de vos clients sont protégées. Chaque application est testée contre les attaques avant sa mise en ligne." },
    { icon: "zap", short: "Rapidité", title: "Rapide et fluide", description: "Des pages qui s’affichent vite et un outil qui reste fluide, même quand vos utilisateurs sont nombreux." },
    { icon: "layers", short: "Évolution", title: "Prêt à grandir avec vous", description: "Votre outil évolue avec votre activité : plus d’utilisateurs, plus de fonctions, sans tout reconstruire." },
  ],
};

export const METHOD: Defaults = {
  kicker: "Notre méthode",
  title: "Une méthode simple en 4 étapes",
  subtitle: "Vous validez chaque étape avant de passer à la suivante. Pas de mauvaise surprise.",
  items: [
    { title: "On vous écoute", description: "Nous prenons le temps de comprendre votre activité, vos besoins et vos objectifs." },
    { title: "On imagine la solution", description: "Nous vous présentons les maquettes de votre futur outil, à valider avant tout développement." },
    { title: "On construit", description: "Nous développons par étapes et vous montrons l’avancement toutes les deux semaines." },
    { title: "On lance et on vous suit", description: "Mise en ligne sécurisée, puis surveillance 24h/24 et maintenance pour que tout fonctionne." },
  ],
};

export const STACK: Defaults = {
  kicker: "Technologies",
  title: "Des technologies fiables et reconnues",
  subtitle: "Des outils modernes, utilisés dans le monde entier, choisis pour leur solidité.",
  items: [
    { name: "Next.js", label: "Sites et interfaces", logo_url: "/assets/tech/nextjs.svg" },
    { name: "Python", label: "Serveur", logo_url: "/assets/tech/python.svg" },
    { name: "Django", label: "Serveur", logo_url: "/assets/tech/django.svg" },
    { name: "PostgreSQL", label: "Base de données", logo_url: "/assets/tech/postgresql.svg" },
    { name: "AWS", label: "Hébergement", logo_url: "/assets/tech/aws.svg" },
    { name: "Docker", label: "Mise en ligne", logo_url: "/assets/tech/docker.svg" },
    { name: "Redis", label: "Performance", logo_url: "/assets/tech/redis.svg" },
  ],
};

export const EXPERTISE_CTA: Defaults = {
  title: "Un projet en tête ? *Parlons-en.*",
  subtitle: "Nous étudions votre besoin et vous proposons la solution la plus adaptée.",
  ctaLabel: "Démarrer un projet",
  ctaLink: "/contact",
};

export const PROJECTS_HERO: Defaults = {
  title: "Nos *réalisations*",
  subtitle: "Des projets concrets, menés main dans la main avec nos clients au Gabon. Découvrez ce que nous avons construit pour eux.",
};

export const PROJECTS_CTA: Defaults = {
  title: "Votre projet sera le prochain",
  subtitle: "Parlez-nous de votre idée, nous la transformons en outil concret.",
  ctaLabel: "Démarrer un projet",
  ctaLink: "/contact",
};

export const BLOG_HERO: Defaults = {
  title: "Actualités *& conseils*",
  subtitle: "Des articles clairs pour comprendre le numérique et en tirer le meilleur pour votre activité.",
};

export const BLOG_CTA: Defaults = {
  title: "Envie de passer *à l'action* ?",
  subtitle: "Parlez-nous de votre projet, nous vous aidons à le concrétiser.",
  ctaLabel: "Démarrer un projet",
  ctaLink: "/contact",
};

export const CONTACT_HERO: Defaults = {
  title: "Parlons de *votre projet*",
  subtitle: "Une idée, une question, un besoin d'accompagnement ? Décrivez-le en quelques lignes, nous vous répondons rapidement.",
  extra: {
    team_title: "Une équipe à Libreville vous répond",
    team_subtitle: "Marketing, commercial et développement",
  },
};

export const CONTACT_FORM: Defaults = {
  title: "Démarrer un projet",
  subtitle: "Deux minutes suffisent pour nous présenter votre besoin.",
  ctaLabel: "Envoyer le message",
  items: [
    { label: "Site ou plateforme web" },
    { label: "Application mobile" },
    { label: "Logiciel sur mesure" },
    { label: "Audit & modernisation" },
    { label: "Autre" },
  ],
};
