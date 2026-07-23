import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ArticleVisual } from "@/components/blog/article-visual";
import { ArticleContent } from "@/components/blog/article-content";
import { ArticleSidebar } from "@/components/blog/article-sidebar";
import { getBlogPostBySlug, getBlogPosts, getRelatedBlogPosts } from "@/lib/blog/public";

export async function generateStaticParams() {
  const posts = await getBlogPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getBlogPostBySlug(slug);
  if (!post) return {};
  return {
    title: `${post.title} — Soken's Digital`,
    description: post.excerpt,
  };
}

export default async function BlogArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [post, allPosts] = await Promise.all([
    getBlogPostBySlug(slug),
    getBlogPosts(),
  ]);
  if (!post) notFound();

  const relatedPosts = getRelatedBlogPosts(allPosts, post.slug);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <article className="mx-auto max-w-6xl px-4 pt-28 pb-20 sm:px-6 sm:pt-32 sm:pb-24 lg:px-8">
          <Link
            href="/blog"
            aria-label="Retour au blog"
            className="mb-6 inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_20rem]">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {post.title}
              </h1>
              <p className="mt-3 text-sm text-muted-foreground">{post.author}</p>

              <div className="mt-6">
                <ArticleVisual image={post.coverImage} />
              </div>

              <div className="mt-8">
                <ArticleContent html={post.content} />
              </div>

              <div className="mt-10 flex justify-end">
                <Link
                  href="/blog"
                  aria-label="Retour aux articles"
                  className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <ArrowLeft className="size-4" />
                </Link>
              </div>
            </div>

            <ArticleSidebar relatedPosts={relatedPosts} />
          </div>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
