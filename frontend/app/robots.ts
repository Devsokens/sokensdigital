import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo/site";

// Pages jamais indexables : portail interne et pages à jeton privé (lien de
// suivi/acceptation de devis) — accessibles à qui a le lien direct, mais
// ne doivent jamais apparaître dans un résultat de recherche public. Ne
// remplace pas le contrôle d'accès réel (RequireAuth + vérification du
// token côté API), c'est une couche d'hygiène en plus (voir SECURITY.md).
const PRIVATE_PATHS = ["/admin", "/admin/", "/devis/", "/connexion", "/offline", "/ingest/"];

// Robots des moteurs d'IA (ChatGPT, Claude, Perplexity, Gemini, Copilot…)
// explicitement autorisés sur le contenu public : c'est ce qui permet à
// ces assistants de citer et recommander Soken's Digital quand on leur
// demande une agence digitale au Gabon ou en Afrique. Le portail privé
// leur reste fermé comme à tout le monde.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "CCBot",
  "Meta-ExternalAgent",
  "DuckAssistBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: AI_CRAWLERS, allow: ["/", "/llms.txt"], disallow: PRIVATE_PATHS },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
