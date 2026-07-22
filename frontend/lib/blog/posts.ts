import type { BlogPost } from "@/lib/blog/types";

export const POSTS: BlogPost[] = [
  {
    slug: "avenir-cybersecurite",
    title: "L'avenir de la Cyber-Sécurité dans les solutions Digitales",
    author: "Dr. Elias Vance",
    date: "18 OCT 2024",
    excerpt:
      "L'IA comme sentinelle, l'analyse des menaces et l'architecture Zero Trust : notre feuille de route sécurité.",
    visualIcon: "shield-check",
    visualLabel: "Global Digital Security Network",
    visualSublabel: "Advanced Cybersecurity & Threat Intelligence Visualization",
    tags: ["Blockchain", "AI Defense", "Cloud Security", "Compliance"],
    content: [
      {
        type: "p",
        text: "À l'ère de l'hyper-connectivité, la frontière entre le physique et le numérique s'efface. Les entreprises ne se contentent plus de protéger des serveurs ; elles doivent sécuriser des écosystèmes entiers de données vivantes. La cyber-sécurité n'est plus une option, mais le socle même de la confiance digitale.",
      },
      { type: "h2", text: "1. L'Intelligence Artificielle en tant que Sentinelle" },
      {
        type: "p",
        text: "L'intégration de modèles de Machine Learning avancés permet désormais de détecter des anomalies de comportement en temps réel, bien avant que l'intrusion ne soit consommée. Voici une implémentation simplifiée d'un filtre de détection d'anomalies basé sur le flux :",
      },
      {
        type: "code",
        filename: "security_engine.py",
        code: `class SecurityMonitor:
    def __init__(self, threshold=0.98):
        self.ai_model = load_model('v4_sentinel')
        self.threshold = threshold

    def analyze_traffic(self, stream):
        prediction = self.ai_model.predict(stream)
        if prediction > self.threshold:
            self.trigger_lockdown(stream.origin)
            return "ALARM_TRIGGERED"
        return "SAFE"`,
      },
      { type: "h2", text: "2. Analyse Comparative des Menaces" },
      {
        type: "p",
        text: "Le tableau ci-dessous illustre l'évolution des vecteurs d'attaque sur les trois derniers trimestres au sein des infrastructures Cloud hybrides.",
      },
      {
        type: "table",
        headers: ["Vecteur d'Attaque", "Fréquence Q1", "Fréquence Q3", "Impact Score"],
        rows: [
          { cells: ["Injection SQL / NoSQL", "12%", "8%"], tone: "medium" },
          { cells: ["Ransomware-as-a-Service", "18%", "34%"], tone: "critical" },
          { cells: ["Social Engineering (Vishing)", "25%", "28%"], tone: "high" },
        ],
      },
      { type: "h3", text: "3. Diagramme de Flux: Architecture Zero Trust", center: true },
      {
        type: "compare",
        left: {
          title: "Périmètre Traditionnel",
          description:
            "Sécurité basée sur le pare-feu externe. Une fois à l'intérieur, l'accès est large.",
          accent: "cyan",
        },
        right: {
          title: "Modèle Zero Trust",
          description:
            "Vérification continue. Chaque accès est validé, même à l'intérieur du réseau.",
          accent: "amber",
        },
      },
      {
        type: "callout",
        icon: "shield-check",
        title: "Infrastructures Immuables",
        description:
          "La prochaine étape est le déploiement de clusters auto-réparateurs capables de se reconstruire après chaque transaction suspecte.",
      },
    ],
  },
  {
    slug: "ia-generative-erp",
    title: "L'avenir de l'IA générative dans les ERP",
    author: "Léa Fontaine",
    date: "12 OCT 2024",
    excerpt:
      "Comment intégrer les modèles LLM privés pour sécuriser vos données métier...",
    visualIcon: "cpu",
    visualLabel: "Generative AI in Enterprise Systems",
    visualSublabel: "Private LLM Architecture Overview",
    tags: ["IA Générative", "ERP", "Data Privacy"],
    content: [
      {
        type: "p",
        text: "Les grands modèles de langage transforment la manière dont les ERP traitent l'information non structurée. Mais leur adoption en entreprise impose une réflexion sérieuse sur la souveraineté des données.",
      },
      { type: "h2", text: "Déployer un LLM privé" },
      {
        type: "p",
        text: "Héberger son propre modèle plutôt que de dépendre d'une API tierce garantit qu'aucune donnée métier sensible ne quitte votre infrastructure. C'est le socle de notre approche pour les clients réglementés.",
      },
    ],
  },
  {
    slug: "microservices-vs-monolithe",
    title: "Micro-services vs Monolithe Modulaire",
    author: "Marc Dubois",
    date: "05 OCT 2024",
    excerpt: "Choisir la bonne architecture pour votre croissance en 2025.",
    visualIcon: "git-branch",
    visualLabel: "Architecture Decision Map",
    visualSublabel: "Microservices vs Modular Monolith",
    tags: ["Architecture", "Scalabilité", "DevOps"],
    content: [
      {
        type: "p",
        text: "Le choix entre micro-services et monolithe modulaire ne devrait jamais être dogmatique. Il dépend de la taille de vos équipes, de votre vélocité de déploiement souhaitée et de la nature de votre charge.",
      },
      { type: "h2", text: "Le monolithe modulaire, un compromis sous-estimé" },
      {
        type: "p",
        text: "Pour la majorité des startups en phase de croissance, un monolithe bien découpé en modules offre 80% des bénéfices des micro-services pour une fraction de la complexité opérationnelle.",
      },
    ],
  },
  {
    slug: "cout-cache-js",
    title: "Performance Web : Le coût caché du JS",
    author: "Sofia Ramirez",
    date: "28 SEP 2024",
    excerpt:
      "Optimisation des bundles pour un chargement instantané sur mobile.",
    visualIcon: "gauge",
    visualLabel: "Bundle Performance Audit",
    visualSublabel: "JavaScript Payload Optimization",
    tags: ["Performance", "Frontend", "Mobile"],
    content: [
      {
        type: "p",
        text: "Chaque kilo-octet de JavaScript envoyé au navigateur a un coût réel : parsing, compilation et exécution consomment un budget CPU particulièrement critique sur les appareils mobiles d'entrée de gamme.",
      },
      { type: "h2", text: "Auditer avant d'optimiser" },
      {
        type: "p",
        text: "Avant toute optimisation, nous mesurons systématiquement le temps d'interactivité réel sur des terminaux représentatifs du parc de nos clients, plutôt que sur des machines de développement haut de gamme.",
      },
    ],
  },
  {
    slug: "menace-quantique-cryptage",
    title: "Quantum Computing",
    author: "Dr. Elias Vance",
    date: "02 OCT 2024",
    excerpt: "La menace quantique sur le cryptage actuel.",
    visualIcon: "atom",
    visualLabel: "Post-Quantum Cryptography",
    visualSublabel: "Preparing Encryption for the Quantum Era",
    tags: ["Cryptographie", "Quantum", "Compliance"],
    content: [
      {
        type: "p",
        text: "Les ordinateurs quantiques à large échelle rendront obsolètes une grande partie des algorithmes de chiffrement asymétrique actuels. La transition vers des standards post-quantiques doit commencer dès aujourd'hui.",
      },
      { type: "h2", text: "Se préparer dès maintenant" },
      {
        type: "p",
        text: "Nous accompagnons nos clients dans l'audit de leur surface cryptographique et la planification d'une migration progressive vers des algorithmes résistants aux attaques quantiques.",
      },
    ],
  },
  {
    slug: "infrastructure-digitale-performance",
    title: "Digital Infrastructure",
    author: "Marc Dubois",
    date: "20 SEP 2024",
    excerpt: "Optimiser la performance sans sacrifier la sécurité.",
    visualIcon: "server",
    visualLabel: "Secure Infrastructure Design",
    visualSublabel: "Performance & Security Trade-off Analysis",
    tags: ["Infrastructure", "Cloud", "Performance"],
    content: [
      {
        type: "p",
        text: "La performance et la sécurité sont trop souvent présentées comme des objectifs contradictoires. Une architecture bien conçue permet d'obtenir les deux simultanément.",
      },
      { type: "h2", text: "Chiffrement et latence" },
      {
        type: "p",
        text: "Le chiffrement de bout en bout n'impose plus de compromis de latence significatif dès lors que l'accélération matérielle est correctement exploitée sur l'ensemble de la chaîne réseau.",
      },
    ],
  },
];

export function getPostBySlug(slug: string) {
  return POSTS.find((p) => p.slug === slug);
}

export function getRelatedPosts(slug: string, count = 2) {
  return POSTS.filter((p) => p.slug !== slug).slice(0, count);
}
