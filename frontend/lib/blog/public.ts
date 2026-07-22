import type { BlogPost as ApiBlogPost } from "@/lib/api/types";
import type { BlogPost, Block } from "@/lib/blog/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function formatDate(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
}

function authorName(author: ApiBlogPost["author"]): string {
  if (!author) return "";
  if (typeof author === "string") return author;
  return `${author.first_name} ${author.last_name}`.trim();
}

function toPost(p: ApiBlogPost): BlogPost {
  return {
    slug: p.slug,
    title: p.title,
    author: authorName(p.author),
    date: formatDate(p.published_at),
    excerpt: p.excerpt,
    visualIcon: p.visual_icon,
    visualImage: p.visual_image || undefined,
    visualLabel: p.visual_label,
    visualSublabel: p.visual_sublabel,
    tags: p.tags,
    content: p.content as unknown as Block[],
  };
}

/** Server-side fetch (public, unauthenticated) used by the public site's
 * Server Components. Revalidates every 60s so CMS edits show up without a
 * redeploy, without hitting Django on every single request. */
export async function getBlogPosts(): Promise<BlogPost[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/public/cms/blog/`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as { results: ApiBlogPost[] };
    return data.results.map(toPost);
  } catch {
    return [];
  }
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/public/cms/blog/${slug}/`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return toPost((await response.json()) as ApiBlogPost);
  } catch {
    return null;
  }
}

export function getRelatedBlogPosts(posts: BlogPost[], slug: string, count = 3) {
  return posts.filter((p) => p.slug !== slug).slice(0, count);
}
