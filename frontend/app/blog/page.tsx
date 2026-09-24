import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BlogExplorer } from "@/components/blog/blog-explorer";
import { getBlogPosts } from "@/lib/blog/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Blog : développement, cybersécurité et cloud en Afrique",
  description:
    "Analyses techniques et conseils sur la cybersécurité, l'architecture logicielle, le cloud et la transformation digitale des entreprises en Afrique.",
  path: "/blog",
});

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
