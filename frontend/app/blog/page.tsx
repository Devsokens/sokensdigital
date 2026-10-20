import type { Metadata } from "next";
import { VitrineShell } from "@/components/vitrine/vitrine-shell";
import { BlogView } from "@/components/vitrine/blog-page";
import { FALLBACK_POST, toVitrinePost } from "@/components/vitrine/blog-data";
import { getPageSections } from "@/lib/api/public";
import { getBlogPosts } from "@/lib/blog/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Blog : développement, cybersécurité et cloud en Afrique",
  description:
    "Analyses techniques et conseils sur la cybersécurité, l'architecture logicielle, le cloud et la transformation digitale des entreprises en Afrique.",
  path: "/blog",
});

export default async function BlogIndexPage() {
  const [sections, apiPosts] = await Promise.all([getPageSections("BLOG"), getBlogPosts()]);
  const posts = apiPosts.map(toVitrinePost);
  const [featured = FALLBACK_POST, ...others] = posts;

  return (
    <VitrineShell page="blog">
      <BlogView sections={sections} featured={featured} posts={others} />
    </VitrineShell>
  );
}
