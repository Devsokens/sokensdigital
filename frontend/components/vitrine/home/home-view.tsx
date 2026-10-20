import type { PageSection } from "@/lib/api/types";
import type { Project } from "@/lib/projects/types";
import type { VitrinePost } from "../blog-data";
import { resolveSection } from "../cms";
import * as D from "../defaults";
import { EditableSection } from "../editable";
import { HomeBlog, HomeCta } from "./home-blog-cta";
import { HomeHero } from "./home-hero";
import { HomeProjects } from "./home-projects";
import { HomeServices } from "./home-services";
import { HomeTeam } from "./home-team";
import { HomeTrust } from "./home-trust";

/** Page d'accueil, à partir des sections du CMS. Partagée par le site public
 * (app/page.tsx) et l'éditeur visuel de l'admin : même rendu dans les deux. */
export function HomeView({ sections, projects, post, phone }: { sections: PageSection[]; projects: Project[]; post: VitrinePost; phone: string }) {
  const hero = resolveSection(sections, "hero", D.HERO);
  const partners = resolveSection(sections, "partner_logos", D.PARTNERS);
  const services = resolveSection(sections, "services", D.SERVICES);
  const recent = resolveSection(sections, "recent_projects", D.RECENT_PROJECTS);
  const team = resolveSection(sections, "team", D.TEAM);
  const blog = resolveSection(sections, "blog_insights", D.BLOG_INSIGHTS);
  const cta = resolveSection(sections, "cta", D.HOME_CTA);

  return (
    <>
      {hero && (
        <EditableSection section={hero} name="Hero">
          <HomeHero hero={hero} />
        </EditableSection>
      )}
      {partners && (
        <EditableSection section={partners} name="Logos partenaires">
          <HomeTrust section={partners} />
        </EditableSection>
      )}
      {services && (
        <EditableSection section={services} name="Nos services">
          <HomeServices section={services} />
        </EditableSection>
      )}
      {recent && projects.length > 0 && (
        <EditableSection section={recent} name="Nos derniers projets">
          <HomeProjects section={recent} projects={projects} />
        </EditableSection>
      )}
      {team && (
        <EditableSection section={team} name="Équipe">
          <HomeTeam section={team} />
        </EditableSection>
      )}
      {blog && (
        <EditableSection section={blog} name="Blog">
          <HomeBlog section={blog} post={post} />
        </EditableSection>
      )}
      {cta && (
        <EditableSection section={cta} name="Appel à l'action">
          <HomeCta section={cta} phone={phone} />
        </EditableSection>
      )}
    </>
  );
}
