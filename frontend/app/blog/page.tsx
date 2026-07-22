import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BlogExplorer } from "@/components/blog/blog-explorer";
import { getBlogPosts } from "@/lib/blog/public";

export const metadata: Metadata = {
  title: "Blog — Soken's Digital",
  description:
    "Analyses techniques sur la cybersécurité, l'architecture logicielle et les infrastructures cloud.",
};

export default async function BlogIndexPage() {
  const posts = await getBlogPosts();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <BlogExplorer posts={posts} />
      </main>
      <SiteFooter />
    </>
  );
}
