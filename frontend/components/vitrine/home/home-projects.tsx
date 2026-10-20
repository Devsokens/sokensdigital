import Link from "next/link";
import type { Project } from "@/lib/projects/types";
import { AutoScroll } from "../auto-scroll";
import { Title, frenchSpacing, type Section } from "../cms";
import { Editable, ManagedElsewhere } from "../editable";
import { ProjectScreen, excerpt } from "../project-screen";
import { ArrowIcon, Eyebrow, FONT_DISPLAY, FONT_DISPLAY_SYS } from "../ui";

/** « Nos derniers projets » : les projets vitrine du CMS (cochés « accueil »),
 * avec leur vraie capture d'écran dans le cadre navigateur. */
export function HomeProjects({ section, projects }: { section: Section; projects: Project[] }) {
  return (
    <section id="projets" style={{ padding: "0 0 clamp(88px, 10vw, 136px)" }}>
      <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <div className="sd-rv" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "20px 48px", marginBottom: "48px" }}>
          <div style={{ maxWidth: "700px" }}>
            <Eyebrow>
              <Editable section={section} path={{ scope: "field", field: "kicker" }} value={section.kicker}>
                {section.kicker}
              </Editable>
            </Eyebrow>
            <h2 style={{ margin: "16px 0 0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(36px, 4.6vw, 60px)", lineHeight: 1.02, letterSpacing: "-0.035em" }}>
              <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title}>
                <Title title={section.title} />
              </Editable>
            </h2>
          </div>
          {section.ctaLabel && (
            <Link className="sd-arrow-link" href={section.ctaLink} style={{ display: "inline-flex", alignItems: "center", gap: "8px", minHeight: "44px", fontSize: "15.5px", fontWeight: 500, color: "oklch(var(--sd-fg))" }}>
              <Editable section={section} path={{ scope: "field", field: "cta" }} kind="link" value={{ label: section.ctaLabel, href: section.ctaLink }}>
                {section.ctaLabel}
              </Editable>
              <ArrowIcon size={17} />
            </Link>
          )}
        </div>
        <ManagedElsewhere label="Projets : onglet « Projets » (cochez « Accueil » sur un projet pour l'afficher ici)">
          <AutoScroll className="sd-rv sd-hscroll" style={{ display: "flex", flexWrap: "wrap", gap: "20px" }}>
            {projects.map((project) => (
              <Link key={project.slug} className="sd-spot sd-arrow-link" href={`/projects/${project.slug}`} style={{ flex: "1 1 520px", minWidth: "0", borderRadius: "24px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-card))", display: "flex", flexDirection: "column", color: "oklch(var(--sd-fg))" }}>
                <div aria-hidden="true" style={{ height: "320px", position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end", justifyContent: "center", background: "radial-gradient(ellipse 70% 80% at 50% 100%, oklch(var(--sd-primary) / 0.18), transparent 70%), oklch(var(--sd-panel-deep))", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <ProjectScreen project={project} compact sizes="(max-width: 860px) 82vw, 470px" style={{ width: "82%", maxWidth: "470px", marginBottom: "-24px", borderRadius: "14px 14px 0 0", borderBottom: "0", boxShadow: "0 -20px 60px -20px rgba(0,0,0,0.7)" }} />
                </div>
                <div style={{ padding: "28px clamp(24px, 3vw, 32px) 32px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "13px", color: "oklch(var(--sd-fg-3))" }}>
                    {[project.sector, project.type, project.timeline].filter(Boolean).map((meta, i) => (
                      <span key={meta} style={{ display: "inline-flex", gap: "8px" }}>
                        {i > 0 && <span aria-hidden="true">·</span>}
                        <span>{meta}</span>
                      </span>
                    ))}
                  </div>
                  <h3 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "26px", lineHeight: 1.2, letterSpacing: "-0.02em" }}>{project.title}</h3>
                  <p style={{ margin: "0", fontSize: "15.5px", color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>{frenchSpacing(project.summary || excerpt(project.description, 170))}</p>
                  <span style={{ marginTop: "6px", display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 500, color: "oklch(var(--sd-primary-hi))" }}>
                    Découvrir le projet
                    <ArrowIcon size={16} />
                  </span>
                </div>
              </Link>
            ))}
          </AutoScroll>
        </ManagedElsewhere>
      </div>
    </section>
  );
}
