import type { NextConfig } from "next";

// Domains the app actually talks to from the browser — Firebase Auth (login),
// Firestore/Storage, the Django API, and the two asset hosts already wired
// into `images.remotePatterns` below (Cloudinary, Supabase). Kept in one
// place so the CSP below and any future `connect-src` additions stay in
// sync with what's really used (see SECURITY.md §CSP).
const csp = [
  "default-src 'self'",
  // Next.js injects small inline bootstrap/hydration scripts — 'unsafe-inline'
  // is required without a nonce-based setup (see SECURITY.md for the
  // stricter nonce-based follow-up). 'unsafe-eval' is dev-only (Fast Refresh).
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV !== "production" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://res.cloudinary.com https://*.supabase.co",
  "font-src 'self' data:",
  // NEXT_PUBLIC_API_BASE_URL is the Django backend — a different origin in
  // every deployment (localhost in dev, the Render URL in prod) — so it must
  // be added explicitly or every fetch() to it gets CSP-blocked.
  `connect-src 'self' ${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"} https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://*.cloudfunctions.net https://res.cloudinary.com https://*.supabase.co`,
  "frame-src 'self' https://*.firebaseapp.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
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
};

export default nextConfig;
