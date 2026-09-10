import { prefersReducedData } from "@/lib/network-awareness";

/**
 * Insère une transformation Cloudinary de basse consommation dans une URL,
 * si l'appareil a demandé d'économiser les données (réglage navigateur/
 * système, ou connexion classée 2G).
 *
 * `q_auto:eco` réduit la qualité JPEG/WebP de façon perceptuelle plutôt que
 * par un pourcentage fixe — Cloudinary vise le point où la différence
 * devient invisible à l'œil, pas un taux de compression arbitraire.
 * `f_auto` sert AVIF ou WebP selon ce que le navigateur accepte, sans que
 * l'appelant ait à choisir un format.
 *
 * No-op sur toute URL qui n'est pas un asset Cloudinary `/upload/` — en
 * particulier Supabase Storage, qui ne fait pas de transformation à la
 * volée sur ce projet. Retourne l'URL telle quelle plutôt que de deviner un
 * format de transformation qui n'existe pas côté serveur.
 */
export function adaptiveImageUrl(url: string): string {
  if (!prefersReducedData()) return url;

  const marker = "/image/upload/";
  const index = url.indexOf(marker);
  if (index === -1) return url;

  // Une URL déjà transformée (rare ici, mais possible si l'appelant a déjà
  // choisi ses propres paramètres) ne doit pas recevoir un second préfixe.
  const afterMarker = url.slice(index + marker.length);
  if (/^[a-z]+_[^/]+\//.test(afterMarker)) return url;

  return url.slice(0, index + marker.length) + "q_auto:eco,f_auto/" + afterMarker;
}
