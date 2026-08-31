import type { MetadataRoute } from "next";

/**
 * Manifest PWA — servi par Next.js sur /manifest.webmanifest.
 *
 * `start_url` pointe sur /connexion plutôt que sur la racine : l'app
 * installée est l'outil interne, pas le site vitrine. Un utilisateur qui
 * lance l'icône depuis son écran d'accueil veut son back-office ; s'il a
 * déjà une session, /connexion le redirige tout seul.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Soken's Digital — Plateforme interne",
    short_name: "Soken's",
    description:
      "Back-office Soken's Digital : RH, projets, finance, trésorerie, support et messagerie d'équipe.",
    start_url: "/connexion",
    id: "/",
    scope: "/",
    display: "standalone",
    // Repli progressif pour les navigateurs qui ne gèrent pas "standalone"
    // (certains contextes iOS/desktop) — plutôt que retomber direct sur un
    // onglet classique.
    display_override: ["window-controls-overlay", "standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#0e121a",
    theme_color: "#0e121a",
    lang: "fr",
    dir: "ltr",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android rogne jusqu'à 20 % des bords selon le lanceur : ces
      // variantes gardent le logo dans la zone sûre centrale.
      { src: "/icons/icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Messagerie", url: "/admin/messagerie" },
      { name: "Tableau de bord", url: "/admin" },
    ],
  };
}
