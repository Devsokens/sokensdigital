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

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <Services />
        <RecentProjects />
        <Testimonials />
        <Team />
        <PartnerLogos />
        <BlogInsights />
        <Cta />
      </main>
      <SiteFooter />
    </>
  );
}
