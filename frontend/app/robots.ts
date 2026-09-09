import type { MetadataRoute } from "next";

// Empêche les moteurs de recherche d'indexer le portail interne et les
// pages à token privé (lien de suivi/acceptation de devis) — celles-ci
// restent accessibles à qui a le lien direct, mais ne doivent jamais
// apparaître dans un résultat de recherche public. Ne remplace pas le
// contrôle d'accès réel (RequireAuth + vérification du token côté API),
// c'est une couche d'hygiène en plus (voir SECURITY.md).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/admin/", "/devis/", "/connexion"],
    },
  };
}
