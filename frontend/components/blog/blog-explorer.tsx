"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProjectCardMedia } from "@/components/projects/card-media";
import type { BlogPost } from "@/lib/blog/types";

type SortOrder = "recent" | "oldest";

export function BlogExplorer({ posts }: { posts: BlogPost[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortOrder>("recent");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = q
      ? posts.filter(
          (p) =>
            p.title.toLowerCase().includes(q) || p.excerpt.toLowerCase().includes(q)
        )
      : posts;
    return sort === "oldest" ? [...base].reverse() : base;
  }, [posts, query, sort]);

  const isSearching = query.trim().length > 0;
  const [featured, ...rest] = filtered;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-32 pb-20 sm:px-6 sm:pt-40 sm:pb-24 lg:px-8">
      <div className="mb-2 flex items-center gap-3">
        <span className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.15em] text-primary uppercase">
          <Diamond className="size-2.5 fill-primary" />
          Digital Intelligence
        </span>
        <span className="h-px flex-1 bg-white/10" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
        Actualités Techniques &amp; <span className="text-primary">Analyses Stratégiques</span>
      </h1>
      <p className="mt-4 max-w-2xl text-sm text-muted-foreground sm:text-base">
        Explorations approfondies des protocoles de sécurité de niveau
        entreprise, de calcul haute performance et de l&apos;avenir de
        l&apos;architecture numérique.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un thème technique..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.02] py-2.5 pr-3.5 pl-10 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-primary/50 focus:outline-none"
          />
        </label>

        <label className="flex shrink-0 items-center gap-2 text-sm text-muted-foreground">
          Trier par :
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOrder)}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none"
          >
            <option value="recent" className="bg-background">
              Dernières publications
            </option>
            <option value="oldest" className="bg-background">
              Plus anciennes
            </option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p className="mt-16 text-center text-sm text-muted-foreground">
          Aucun article ne correspond à &laquo;&nbsp;{query}&nbsp;&raquo;.
        </p>
      ) : isSearching ? (
        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <>
          <Link
            href={`/blog/${featured.slug}`}
            className="mt-10 grid grid-cols-1 overflow-hidden rounded-2xl border-2 border-primary/20 bg-card/60 transition-colors hover:border-primary/60 md:grid-cols-2"
          >
            <div aria-hidden className="relative aspect-video overflow-hidden md:aspect-auto">
              <ProjectCardMedia
                images={featured.visualImage ? [featured.visualImage] : undefined} icon={featured.visualIcon}
                iconClassName="relative size-14 text-primary/40"
              />
              <span className="absolute top-4 left-4 z-10 rounded-full bg-primary px-3 py-1 text-[10px] font-semibold tracking-[0.1em] text-primary-foreground uppercase">
                Tech Insights
              </span>
            </div>
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <span className="inline-flex items-center gap-2 text-xs font-medium tracking-[0.1em] text-muted-foreground uppercase">
                {featured.date}
                <span className="size-1 rounded-full bg-muted-foreground" />
              </span>
              <h2 className="mt-2 text-xl font-semibold text-foreground sm:text-2xl">
                {featured.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {featured.excerpt}
              </p>
              <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                <span className="text-sm font-medium text-foreground">
                  {featured.author}
                </span>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                  Lire l&apos;analyse
                  <ChevronRight className="size-4" />
                </span>
              </div>
            </div>
          </Link>

          {rest.length > 0 && (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              {rest.map((post) => (
                <PostCard key={post.slug} post={post} showArrow />
              ))}
            </div>
          )}

          <Pagination />
        </>
      )}
    </section>
  );
}

function PostCard({
  post,
  showArrow = false,
}: {
  post: BlogPost;
  showArrow?: boolean;
}) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group overflow-hidden rounded-2xl border-2 border-primary/20 bg-card/60 transition-colors hover:border-primary/60"
    >
      <div aria-hidden className="relative aspect-video overflow-hidden">
        <ProjectCardMedia images={post.visualImage ? [post.visualImage] : undefined} icon={post.visualIcon} />
      </div>
      <div className="p-5">
        <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
          {post.date}
        </span>
        <h3 className="mt-2 text-base font-semibold text-foreground">{post.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
        {showArrow && (
          <div className="mt-3 flex justify-end">
            <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
        )}
      </div>
    </Link>
  );
}

function Pagination() {
  const pages = [1, 2, 3];
  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <button
        type="button"
        disabled
        aria-label="Page précédente"
        className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 text-muted-foreground/50"
      >
        <ChevronLeft className="size-4" />
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          disabled={p !== 1}
          aria-current={p === 1 ? "page" : undefined}
          className={cn(
            "inline-flex size-9 items-center justify-center rounded-lg border text-sm font-medium",
            p === 1
              ? "border-primary/60 bg-primary/10 text-primary"
              : "border-white/10 text-muted-foreground/50"
          )}
        >
          {p}
        </button>
      ))}
      <span className="px-1 text-sm text-muted-foreground/50">…</span>
      <button
        type="button"
        disabled
        aria-label="Page suivante"
        className="inline-flex size-9 items-center justify-center rounded-lg border border-white/10 text-muted-foreground/50"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
