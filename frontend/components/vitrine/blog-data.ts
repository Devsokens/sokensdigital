import type { BlogPost } from "@/lib/blog/types";

/** Article tel qu'affiché par les cartes de la vitrine. */
export type VitrinePost = {
  title: string;
  excerpt: string;
  /** Date courte en minuscules, comme la maquette : « 28 sept. 2026 ». */
  date: string;
  href: string;
  /** URL de l'image de couverture, absente si l'article n'en a pas. */
  coverImage?: string;
};

/* Article à la une de la maquette, affiché tant que l'API ne renvoie aucun
 * article (backend éteint en local, blog encore vide). */
export const FALLBACK_POST: VitrinePost = {
  title: "IA générative en entreprise : 5 usages concrets qui créent de la valeur en 2026",
  excerpt: "Le vrai défi de 2026 n'est plus d'essayer l'IA, mais d'en tirer des bénéfices concrets pour votre activité.",
  date: "28 sept. 2026",
  href: "/blog",
};

export function toVitrinePost(post: BlogPost): VitrinePost {
  return {
    title: post.title,
    excerpt: post.excerpt,
    date: post.publishedAt
      ? new Date(post.publishedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })
      : "",
    href: `/blog/${post.slug}`,
    coverImage: post.coverImage,
  };
}
