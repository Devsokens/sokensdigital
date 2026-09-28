import type { MetadataRoute } from "next";
import { getBlogPosts } from "@/lib/blog/public";
import { getShowcaseProjects } from "@/lib/projects/public";
import { absoluteUrl } from "@/lib/seo/site";

/** Plan du site pour les moteurs de recherche — pages publiques fixes,
 * plus chaque article publié et chaque étude de cas active, lus depuis le
 * CMS. Régénéré toutes les heures : un article publié apparaît sans
 * redéploiement. Les pages privées (admin, suivi par jeton, devis) sont
 * exclues ici comme dans robots.ts. */
export const revalidate = 3600;

const STATIC_PAGES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/expertise", priority: 0.9, changeFrequency: "monthly" },
  { path: "/projects", priority: 0.8, changeFrequency: "weekly" },
  { path: "/demarrer-un-projet", priority: 0.9, changeFrequency: "monthly" },
  { path: "/blog", priority: 0.7, changeFrequency: "weekly" },
  { path: "/contact", priority: 0.7, changeFrequency: "yearly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/suivi-projet", priority: 0.4, changeFrequency: "yearly" },
  { path: "/mentions-legales", priority: 0.2, changeFrequency: "yearly" },
  { path: "/confidentialite", priority: 0.2, changeFrequency: "yearly" },
  { path: "/cgu", priority: 0.2, changeFrequency: "yearly" },
  { path: "/cgv", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const [posts, projects] = await Promise.all([
    getBlogPosts().catch(() => []),
    getShowcaseProjects().catch(() => []),
  ]);

  return [
    ...STATIC_PAGES.map((page) => ({
      url: absoluteUrl(page.path),
      lastModified: now,
      changeFrequency: page.changeFrequency,
      priority: page.priority,
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.slug}`),
      lastModified: post.publishedAt ? new Date(post.publishedAt) : now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      ...(post.coverImage ? { images: [post.coverImage] } : {}),
    })),
    ...projects.map((project) => ({
      url: absoluteUrl(`/projects/${project.slug}`),
      lastModified: now,
      changeFrequency: "monthly" as const,
      priority: 0.6,
      ...(project.images?.[0] ? { images: [project.images[0]] } : {}),
    })),
  ];
}
