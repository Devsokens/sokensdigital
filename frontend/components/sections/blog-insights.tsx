import Link from "next/link";
import { ProjectCardMedia } from "@/components/projects/card-media";
import type { PageSection } from "@/lib/api/types";
import type { BlogPost } from "@/lib/blog/types";

export function BlogInsights({ section, posts }: { section?: PageSection | null; posts: BlogPost[] }) {
  const featured = posts.slice(0, 3);
  const title = section?.title || "Insights Techniques";
  const ctaLabel = section?.cta_label || "Lire le blog";
  const ctaLink = section?.cta_link || "/blog";

  if (featured.length === 0) return null;

  return (
    <section id="blog" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        <Link
          href={ctaLink}
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {ctaLabel}
          <span aria-hidden>→</span>
        </Link>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {featured.map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group overflow-hidden rounded-2xl border-2 border-primary/20 bg-card/60 transition-colors hover:border-primary/60"
          >
            <div aria-hidden className="relative aspect-video overflow-hidden">
              <ProjectCardMedia images={post.coverImage ? [post.coverImage] : undefined} />
            </div>
            <div className="p-5">
              <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
                {post.date}
              </span>
              <h3 className="mt-2 text-base font-semibold text-foreground">
                {post.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
