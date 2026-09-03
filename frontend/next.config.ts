import type { NextConfig } from "next";

/**
 * Content-Security-Policy, en Report-Only.
 *
 * Deploye en Report-Only et non en mode bloquant : une directive trop
 * serree casse silencieusement une page entiere cote navigateur, sans
 * erreur serveur pour le signaler. On observe d'abord les violations
 * reelles, on resserre ensuite, puis on bascule l'en-tete sur
 * `Content-Security-Policy` une fois le rapport propre.
 *
 * `unsafe-inline` sur script-src est necessaire tant qu'on n'a pas de
 * middleware a nonce : l'App Router injecte ses propres scripts inline pour
 * l'hydratation et le streaming. C'est la principale faiblesse de cette
 * politique, et le premier point a reprendre apres la phase d'observation.
 * Elle apporte deja frame-ancestors, object-src et base-uri, qui ferment le
 * clickjacking, les plugins et la reecriture de <base>.
 */
const API_ORIGIN = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").origin;
  } catch {
    return "http://localhost:8000";
  }
})();

const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // Tailwind et les styles inline de Next : pas de nonce disponible ici non plus.
  "style-src 'self' 'unsafe-inline'",
  // next/font/google auto-heberge les fichiers au build, donc pas de gstatic.
  "font-src 'self' data:",
  // Cloudinary et Supabase Storage servent les visuels et les pieces jointes.
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.supabase.co",
  "media-src 'self' https://res.cloudinary.com https://*.supabase.co",
  [
    "connect-src 'self'",
    API_ORIGIN,
    // Firebase Auth (verification de jeton) et Firestore (chat,
    // notifications) — Firestore ouvre aussi un canal websocket.
    "https://*.googleapis.com",
    "https://*.firebaseio.com",
    "wss://*.firebaseio.com",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.ingest.sentry.io",
    "https://*.ingest.de.sentry.io",
    "https://*.ingest.us.sentry.io",
  ].join(" "),
  "worker-src 'self' blob:",
  // Le service worker de la PWA doit pouvoir prendre la main sur tout le site.
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy-Report-Only", value: CSP_DIRECTIVES },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Aucun ecran n'utilise ces capteurs : les refuser explicitement evite
  // qu'un script tiers introduit plus tard les demande a l'utilisateur.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  images: {
    // Sans ça, next/image refuse toute image distante (Cloudinary,
    // Supabase Storage) — c'est très probablement pourquoi le code utilise
    // <img> brut à 23 endroits au lieu de next/image partout : l'optimisation
    // (redimensionnement, conversion WebP/AVIF, lazy loading automatique)
    // était bloquée par ce config manquant, pas par choix. Purement additif,
    // ne change aucun rendu existant (les <img> actuels continuent de
    // marcher tels quels) — débloque juste next/image pour du code futur
    // ou une migration progressive des images publiques à fort impact LCP
    // (galerie projets, showcase).
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },

  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default nextConfig;
