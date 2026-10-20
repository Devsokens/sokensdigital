import type { Metadata } from "next";
import { VitrineShell } from "@/components/vitrine/vitrine-shell";
import { HomeView } from "@/components/vitrine/home/home-view";
import { FALLBACK_POST, toVitrinePost } from "@/components/vitrine/blog-data";
import { contactInfo } from "@/components/vitrine/ui";
import { getPageSections, getSiteSettings } from "@/lib/api/public";
import { getBlogPosts } from "@/lib/blog/public";
import { getShowcaseProjects } from "@/lib/projects/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: { absolute: "Soken's Digital — Agence digitale à Libreville, Gabon" },
  description:
    "Soken's Digital, agence digitale à Libreville (Gabon) : applications web et mobiles, logiciels sur mesure, cloud et cybersécurité pour les entreprises en Afrique.",
  path: "/",
});

export default async function Home() {
  const [sections, homepageProjects, allProjects, posts, settings] = await Promise.all([
    getPageSections("ACCUEIL"),
    getShowcaseProjects({ homepage: true }),
    getShowcaseProjects(),
    getBlogPosts(),
    getSiteSettings(),
  ]);
  // Projets cochés « accueil », sinon les deux premiers projets vitrine.
  const projects = homepageProjects.length ? homepageProjects : allProjects.slice(0, 2);

  return (
    <VitrineShell page="accueil">
      <HomeView sections={sections} projects={projects} post={posts[0] ? toVitrinePost(posts[0]) : FALLBACK_POST} phone={contactInfo(settings).phone} />
    </VitrineShell>
  );
}
