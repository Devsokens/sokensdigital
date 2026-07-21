import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Hero } from "@/components/sections/hero";
import { Services } from "@/components/sections/services";
import { RecentProjects } from "@/components/sections/recent-projects";
import { Testimonials } from "@/components/sections/testimonials";
import { Team } from "@/components/sections/team";
import { PartnerLogos } from "@/components/sections/partner-logos";
import { BlogInsights } from "@/components/sections/blog-insights";
import { Cta } from "@/components/sections/cta";
import { getPageSections, findSection } from "@/lib/api/public";
import { getShowcaseProjects } from "@/lib/projects/public";

export default async function Home() {
  const [sections, homepageProjects] = await Promise.all([
    getPageSections("ACCUEIL"),
    getShowcaseProjects({ homepage: true }),
  ]);

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero section={findSection(sections, "hero")} />
        <Services section={findSection(sections, "services")} />
        <RecentProjects section={findSection(sections, "recent_projects")} projects={homepageProjects} />
        <Testimonials section={findSection(sections, "testimonials")} />
        <Team section={findSection(sections, "team")} />
        <PartnerLogos section={findSection(sections, "partner_logos")} />
        <BlogInsights section={findSection(sections, "blog_insights")} />
        <Cta section={findSection(sections, "cta")} />
      </main>
      <SiteFooter />
    </>
  );
}
