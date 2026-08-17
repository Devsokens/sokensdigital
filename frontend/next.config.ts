import type { NextConfig } from "next";

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
};

export default nextConfig;
