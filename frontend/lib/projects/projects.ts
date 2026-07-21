import type { Project } from "@/lib/projects/types";

export const PROJECTS: Project[] = [
  {
    slug: "quantumguard-architecture-transaction",
    category: "FINTECH",
    sector: "Fintech",
    type: "Sécurité",
    featured: true,
    sceneVariants: ["security", "chart"],
    statusTag: "2024 · Déploiement",
    tag: "FINTECH · SÉCURITÉ",
    title: "QuantumGuard: Architecture de Transaction Sécurisée",
    description:
      "Une couche de sécurité révolutionnaire haute performance conçue pour les réseaux financiers décentralisés, réduisant la latence de 40%.",
    visualIcon: "shield-check",
    client: "Nexus Wealth Management",
    technologies: ["Rust", "Kubernetes", "gRPC", "Wasm"],
    timeline: "6 Mois (de la découverte au lancement)",
    leadName: "Taiger Dev",
    leadRole: "Développeur Full Stack",
    challenge:
      "Notre client, un consortium de fintech de premier plan, était confronté à des goulots d'étranglement critiques dans le traitement de ses transactions en temps réel. Les protocoles de sécurité existants entraînaient une latence excessive, se traduisant par une baisse de 12% de l'engagement des utilisateurs aux heures de pointe.",
    stats: [
      { value: "+40%", label: "Efficiency Gain" },
      { value: "0.4ms", label: "Avg Latency" },
      { value: "99.9%", label: "Threat Blocking" },
    ],
    solution:
      "Soken's Digital a conçu une architecture propriétaire «Quantum Guard». En tirant parti de l'edge computing et d'un moteur cryptographique personnalisé optimisé pour le traitement parallèle, nous avons découplé la couche de validation du flux de données principal.",
    solutionPoints: [
      "Déchargement du chiffrement asymétrique sur des accélérateurs matériels dédiés.",
      "Détection d'anomalies en temps réel pilotée par un LLM pour une réponse rapide aux menaces.",
      "Synchronisation des nœuds mondiaux avec vérification de preuve à divulgation nulle de connaissance.",
    ],
  },
  {
    slug: "nova-finance-dashboard",
    category: "FINTECH",
    sector: "Fintech",
    type: "Web App",
    sceneVariants: ["chart", "network"],
    statusTag: "2024 · SaaS",
    tag: "FINTECH · SAAS",
    title: "Nova Finance Dashboard",
    description:
      "Refonte complète de l'interface de trading haute fréquence avec latence réduite de 40%.",
    visualIcon: "trending-up",
    client: "Nova Capital Partners",
    technologies: ["React", "WebSocket", "Go", "TimescaleDB"],
    timeline: "4 Mois (de la découverte au lancement)",
    leadName: "Sofia Ramirez",
    leadRole: "Lead Frontend Engineer",
    challenge:
      "L'ancienne interface de trading de Nova Capital souffrait d'un rendu lent des flux de marché en temps réel, provoquant des décisions tardives lors des pics de volatilité et une perte de confiance des traders internes.",
    stats: [
      { value: "-40%", label: "Latence UI" },
      { value: "12k", label: "Ordres / sec" },
      { value: "99.95%", label: "Disponibilité" },
    ],
    solution:
      "Nous avons reconstruit le pipeline de rendu autour d'un moteur WebSocket binaire et d'une couche de state management optimisée pour les mises à jour à haute fréquence, sans jamais bloquer le thread principal.",
    solutionPoints: [
      "Rendu virtualisé des carnets d'ordres pour des mises à jour à 60fps constantes.",
      "Compression binaire des flux de marché pour réduire la bande passante de 70%.",
      "Reconnexion automatique avec rejeu d'état pour une continuité sans perte de données.",
    ],
  },
  {
    slug: "aerologistics-platform",
    category: "LOGISTIQUE",
    sector: "Logistique",
    type: "Plateforme Cloud",
    sceneVariants: ["map", "network"],
    statusTag: "2023 · Cloud",
    tag: "LOGISTIQUE · CLOUD",
    title: "AeroLogistics Platform",
    description:
      "Plateforme robuste de gestion de flotte gérant plus d'un million de transactions quotidiennes.",
    visualIcon: "plane-takeoff",
    client: "AeroLogistics Group",
    technologies: ["Node.js", "Kafka", "PostgreSQL", "AWS"],
    timeline: "8 Mois (de la découverte au lancement)",
    leadName: "Marc Dubois",
    leadRole: "Architecte Cloud",
    challenge:
      "La croissance rapide d'AeroLogistics avait dépassé les capacités de son ERP historique, provoquant des retards de synchronisation entre entrepôts et une visibilité limitée sur l'état réel de la flotte.",
    stats: [
      { value: "1M+", label: "Transactions / jour" },
      { value: "-55%", label: "Temps de synchro" },
      { value: "24/7", label: "Supervision" },
    ],
    solution:
      "Une architecture événementielle basée sur Kafka a remplacé les synchronisations par lots, permettant une cohérence quasi instantanée entre tous les sites logistiques et un suivi de flotte en temps réel.",
    solutionPoints: [
      "Bus d'événements central pour la synchronisation inter-entrepôts en temps réel.",
      "Tableau de bord de supervision de flotte avec alertes prédictives.",
      "Auto-scaling de l'infrastructure Cloud pendant les pics saisonniers.",
    ],
  },
  {
    slug: "medisecure-portal",
    category: "SANTÉ",
    sector: "Santé",
    type: "Sécurité",
    sceneVariants: ["medical", "security"],
    statusTag: "2023 · Sécurité",
    tag: "SANTÉ · SÉCURITÉ",
    title: "MediSecure Portal",
    description:
      "Infrastructure conforme HDS pour la gestion sécurisée de dossiers médicaux sensibles.",
    visualIcon: "heart-pulse",
    client: "Groupe Hospitalier Rhône Santé",
    technologies: ["Next.js", "PostgreSQL", "Vault", "OVH HDS"],
    timeline: "5 Mois (de la découverte au lancement)",
    leadName: "Léa Fontaine",
    leadRole: "Ingénieure Sécurité",
    challenge:
      "Le groupe hospitalier devait migrer ses dossiers patients vers une plateforme numérique tout en respectant strictement l'hébergement de données de santé (HDS) et le RGPD, sans interrompre le service.",
    stats: [
      { value: "100%", label: "Conformité HDS" },
      { value: "0", label: "Incident de fuite" },
      { value: "-30%", label: "Temps administratif" },
    ],
    solution:
      "Nous avons déployé une architecture de chiffrement de bout en bout avec gestion des secrets centralisée, hébergée exclusivement sur une infrastructure certifiée HDS, avec traçabilité complète des accès.",
    solutionPoints: [
      "Chiffrement au repos et en transit sur l'ensemble des dossiers patients.",
      "Journalisation immuable de chaque accès pour les audits réglementaires.",
      "Authentification forte multi-facteurs pour tout le personnel soignant.",
    ],
  },
  {
    slug: "pont-cloud-aether",
    category: "INFRASTRUCTURE",
    sector: "Infrastructure",
    type: "Infrastructure",
    sceneVariants: ["network", "code"],
    statusTag: "2024 · Cloud",
    tag: "INFRASTRUCTURE · CLOUD",
    title: "Pont cloud Aether",
    description: "Système de synchronisation de niveau entreprise.",
    visualIcon: "cloud",
    client: "Aether Industries",
    technologies: ["Terraform", "Kubernetes", "gRPC", "PostgreSQL"],
    timeline: "5 Mois (de la découverte au lancement)",
    leadName: "Marc Dubois",
    leadRole: "Architecte Cloud",
    challenge:
      "Aether Industries opérait sur deux fournisseurs Cloud distincts sans stratégie de synchronisation cohérente, provoquant des divergences de données critiques entre régions.",
    stats: [
      { value: "99.99%", label: "Cohérence des données" },
      { value: "-60%", label: "Coût d'infrastructure" },
      { value: "2", label: "Clouds unifiés" },
    ],
    solution:
      "Une couche d'orchestration multi-cloud a été mise en place pour synchroniser les états critiques en temps quasi réel, avec bascule automatique en cas d'incident régional.",
    solutionPoints: [
      "Orchestration Terraform unifiée sur deux fournisseurs Cloud.",
      "Réplication d'état événementielle avec résolution automatique des conflits.",
      "Bascule automatique en moins de 30 secondes en cas d'incident régional.",
    ],
  },
  {
    slug: "interface-trading-vortex",
    category: "FINTECH",
    sector: "Fintech",
    type: "Web App",
    sceneVariants: ["chart", "code"],
    statusTag: "2024 · Trading",
    tag: "FINTECH · UI",
    title: "Interface utilisateur de trading Vortex",
    description:
      "Interface à faible latence pour les traders algorithmique haute fréquence.",
    visualIcon: "line-chart",
    client: "Vortex Capital",
    technologies: ["React", "Rust", "WebGL", "gRPC"],
    timeline: "4 Mois (de la découverte au lancement)",
    leadName: "Sofia Ramirez",
    leadRole: "Lead Frontend Engineer",
    challenge:
      "Les traders algorithmiques de Vortex Capital avaient besoin d'une visualisation de marché capable de suivre des dizaines de milliers de mises à jour par seconde sans latence perceptible.",
    stats: [
      { value: "0.8ms", label: "Latence de rendu" },
      { value: "40k", label: "Mises à jour / sec" },
      { value: "+25%", label: "Vitesse de décision" },
    ],
    solution:
      "Un moteur de rendu WebGL sur mesure a été développé pour visualiser les carnets d'ordres et les graphiques de marché directement sur GPU, contournant les limites du DOM traditionnel.",
    solutionPoints: [
      "Rendu GPU des carnets d'ordres pour un affichage fluide à très haute fréquence.",
      "Pipeline de données binaire de bout en bout, du serveur jusqu'au canvas.",
      "Personnalisation des tableaux de bord par profil de trading.",
    ],
  },
  {
    slug: "sentinel-core",
    category: "GOVTECH",
    sector: "GovTech",
    type: "Sécurité",
    sceneVariants: ["security", "code"],
    statusTag: "2023 · Identité",
    tag: "GOVTECH · IDENTITÉ",
    title: "Sentinel Core",
    description: "Système de vérification d'identité au matériel pour GovTech.",
    visualIcon: "fingerprint",
    client: "Agence Nationale du Numérique",
    technologies: ["Rust", "TPM", "PostgreSQL", "Kubernetes"],
    timeline: "9 Mois (de la découverte au lancement)",
    leadName: "Dr. Elias Vance",
    leadRole: "Architecte Sécurité",
    challenge:
      "L'agence avait besoin d'un système de vérification d'identité à la fois hautement sécurisé et accessible à grande échelle, ancré dans du matériel de confiance plutôt que dans des secrets logiciels.",
    stats: [
      { value: "99.99%", label: "Précision de vérification" },
      { value: "<1s", label: "Temps de vérification" },
      { value: "0", label: "Compromission matérielle" },
    ],
    solution:
      "Une architecture d'ancrage matériel basée sur des modules TPM a été déployée pour garantir que chaque vérification d'identité repose sur une racine de confiance physique inviolable.",
    solutionPoints: [
      "Ancrage de confiance matériel via modules TPM certifiés.",
      "Vérification biométrique locale sans transmission de données sensibles.",
      "Audit complet et réversible de chaque tentative de vérification.",
    ],
  },
];

export function getProjectBySlug(slug: string) {
  return PROJECTS.find((p) => p.slug === slug);
}

export function getRelatedProjects(slug: string, count = 3) {
  return PROJECTS.filter((p) => p.slug !== slug).slice(0, count);
}
