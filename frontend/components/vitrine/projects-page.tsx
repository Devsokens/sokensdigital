import Link from "next/link";
import type { PageSection } from "@/lib/api/types";
import type { Project } from "@/lib/projects/types";
import { AnimatedTitle, frenchSpacing, resolveSection, type Section } from "./cms";
import * as D from "./defaults";
import { Editable, EditableSection, ManagedElsewhere } from "./editable";
import { ProjectScreen, excerpt } from "./project-screen";
import { ArrowIcon, Breadcrumb, FONT_DISPLAY, FONT_DISPLAY_SYS, FONT_MONO, HEADER_HEIGHT, underHeader } from "./ui";

/* Page Projets : études de cas tirées des projets vitrine du CMS (vraies
 * captures d'écran), entre un hero et l'appel « Votre projet sera le prochain ». */

const LABEL = { fontFamily: FONT_MONO, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: "oklch(var(--sd-primary-hi))" } as const;

function ProjectsHero({ section }: { section: Section }) {
  return (
    <section style={{ position: "relative", overflow: "hidden", ...underHeader("clamp(72px, 9vw, 120px)", "clamp(48px, 6vw, 72px)") }}>
      <div aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
        <div className="sd-aurora sd-au1" style={{ width: "600px", height: "600px", left: "30%", top: `${-320 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-1))", opacity: 0.3 }} />
        <div className="sd-aurora sd-au2" style={{ width: "480px", height: "480px", right: "-80px", top: `${-100 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-2))", opacity: 0.2 }} />
        <div style={{ position: "absolute", inset: "0", backgroundImage: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)", backgroundSize: "64px 64px", WebkitMaskImage: "radial-gradient(ellipse 60% 70% at 50% 0%, #000 15%, transparent 75%)", maskImage: "radial-gradient(ellipse 60% 70% at 50% 0%, #000 15%, transparent 75%)" }} />
      </div>
      <div style={{ position: "relative", zIndex: 1, maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
        <Breadcrumb current="Projets" />
        <h1 style={{ margin: "28px 0 0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(48px, 7.4vw, 104px)", lineHeight: 0.98, letterSpacing: "-0.045em" }}>
          <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title} hint="La partie entre *astérisques* s'affiche en dégradé.">
            <AnimatedTitle title={section.title} start={0.1} step={0.12} />
          </Editable>
        </h1>
        <p className="sd-bw" style={{ animationDelay: "0.36s", margin: "26px 0 0", maxWidth: "620px", fontSize: "clamp(17px, 1.5vw, 19px)", lineHeight: 1.65, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
          <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
            {frenchSpacing(section.subtitle)}
          </Editable>
        </p>
      </div>
    </section>
  );
}

/** Carte d'un projet ; dans l'éditeur, ses textes s'enregistrent sur le projet (repéré par son slug). */
function CaseStudy({ project, reverse }: { project: Project; reverse: boolean }) {
  const slug = project.slug;
  const chips = [
    { key: "type", value: project.type },
    { key: "timeline", value: project.timeline },
  ].filter((chip) => chip.value);
  const need = project.challengeSummary || excerpt(project.challenge || project.description);
  const answer = project.solutionSummary || excerpt(project.solution || project.description);
  const visual = (
    <div aria-hidden="true" style={{ flex: "1 1 520px", minWidth: "0", minHeight: "440px", position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 28px", background: "radial-gradient(ellipse 70% 70% at 50% 60%, oklch(var(--sd-primary) / 0.16), transparent 70%), oklch(var(--sd-panel-deep))" }}>
      <div style={{ position: "absolute", inset: "0", backgroundImage: "radial-gradient(rgba(255,255,255,0.1) 1px, transparent 1px)", backgroundSize: "20px 20px", WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 10%, transparent 70%)", maskImage: "radial-gradient(circle at 50% 50%, #000 10%, transparent 70%)" }} />
      <ProjectScreen project={project} sizes="(max-width: 860px) 90vw, 500px" style={{ width: "100%", maxWidth: "500px" }} />
    </div>
  );
  return (
    <article className="sd-spot sd-rv" style={{ borderRadius: "28px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-card))", display: "flex", flexWrap: reverse ? "wrap-reverse" : "wrap" }}>
      {!reverse && visual}
      <div style={{ flex: "1 1 460px", minWidth: "0", padding: "clamp(28px, 4vw, 52px)", display: "flex", flexDirection: "column", gap: "22px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {project.sector && (
            <span style={{ padding: "5px 12px", borderRadius: "999px", background: "oklch(var(--sd-primary) / 0.12)", color: "oklch(var(--sd-primary-hi))", fontSize: "13px", fontWeight: 500 }}>
              <Editable path={{ scope: "project", key: "sector", slug }} value={project.sector}>
                {project.sector}
              </Editable>
            </span>
          )}
          {chips.map((chip) => (
            <span key={chip.key} style={{ padding: "5px 12px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.12)", fontSize: "13px", color: "oklch(var(--sd-fg-2))" }}>
              <Editable path={{ scope: "project", key: chip.key, slug }} value={chip.value}>
                {chip.value}
              </Editable>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <h2 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "clamp(30px, 3.2vw, 42px)", lineHeight: 1.08, letterSpacing: "-0.03em" }}>
            <Editable path={{ scope: "project", key: "title", slug }} value={project.title}>
              {project.title}
            </Editable>
          </h2>
          {project.client && (
            <p style={{ margin: "0", fontSize: "15px", color: "oklch(var(--sd-fg-4))" }}>
              Pour{" "}
              <Editable path={{ scope: "project", key: "client", slug }} value={project.client}>
                {project.client}
              </Editable>
            </p>
          )}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={LABEL}>Le besoin</span>
            <p style={{ margin: "0", fontSize: "15.5px", color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
              <Editable path={{ scope: "project", key: "challenge_summary", slug }} kind="textarea" value={need} hint="Le problème du client, en une ou deux phrases (repris sur la page du projet)." placeholder="Décrire le besoin du client">
                {frenchSpacing(need)}
              </Editable>
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <span style={LABEL}>Ce que nous avons fait</span>
            <p style={{ margin: "0", fontSize: "15.5px", color: "oklch(var(--sd-fg-3))", textWrap: "pretty" }}>
              <Editable path={{ scope: "project", key: "solution_summary", slug }} kind="textarea" value={answer} hint="La solution livrée, en une ou deux phrases (« Notre réponse » sur la page du projet)." placeholder="Décrire notre réponse">
                {frenchSpacing(answer)}
              </Editable>
            </p>
          </div>
        </div>
        <Editable path={{ scope: "project", key: "solution_points", slug }} kind="list" value={project.solutionPoints} hint="Un point clé par ligne (ce que le client a gagné ou peut faire désormais)." placeholder="Ajouter les points clés du résultat">
          {project.solutionPoints.length > 0 && (
            <ul style={{ margin: "0", padding: "20px 0 0", listStyle: "none", borderTop: "1px solid rgba(255,255,255,0.07)", display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {project.solutionPoints.map((point) => (
                <li key={point} style={{ padding: "7px 13px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", fontSize: "13.5px", color: "oklch(var(--sd-fg-2b))" }}>{point}</li>
              ))}
            </ul>
          )}
        </Editable>
        <div style={{ marginTop: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 20px" }}>
          {project.projectUrl && (
            <a className="sd-ghost sd-arrow-link" href={project.projectUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "48px", padding: "0 20px", borderRadius: "11px", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "oklch(var(--sd-fg))", fontSize: "15px", fontWeight: 500 }}>
              Visiter le site
              <svg className="sd-arr" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17 17 7" />
                <path d="M8 7h9v9" />
              </svg>
            </a>
          )}
          <Link className="sd-arrow-link" href={`/projects/${project.slug}`} style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 500, color: "oklch(var(--sd-primary-hi))" }}>
            Lire l&apos;étude de cas
            <ArrowIcon size={15} />
          </Link>
        </div>
      </div>
      {reverse && visual}
    </article>
  );
}

export function ProjectsCta({ section }: { section: Section }) {
  return (
    <Link className="sd-dash sd-arrow-link sd-rv" href={section.ctaLink} style={{ borderRadius: "28px", padding: "clamp(32px, 5vw, 56px)", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "24px", color: "oklch(var(--sd-fg))", backgroundColor: "rgba(255,255,255,0.015)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "22px" }}>
        <span style={{ width: "60px", height: "60px", flex: "none", borderRadius: "18px", border: "1px solid oklch(var(--sd-primary) / 0.35)", background: "oklch(var(--sd-primary) / 0.08)", color: "oklch(var(--sd-primary-hi))", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "clamp(22px, 2.4vw, 30px)", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title}>
              {frenchSpacing(section.title)}
            </Editable>
          </span>
          <span style={{ fontSize: "15.5px", color: "oklch(var(--sd-fg-3))" }}>
            <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
              {frenchSpacing(section.subtitle)}
            </Editable>
          </span>
        </div>
      </div>
      <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "15.5px", fontWeight: 500, color: "oklch(var(--sd-primary-hi))" }}>
        <Editable section={section} path={{ scope: "field", field: "cta" }} kind="link" value={{ label: section.ctaLabel, href: section.ctaLink }}>
          {section.ctaLabel}
        </Editable>
        <ArrowIcon size={17} />
      </span>
    </Link>
  );
}

/** Page Projets, partagée par le site public et l'éditeur visuel. */
export function ProjectsView({ sections, projects }: { sections: PageSection[]; projects: Project[] }) {
  const hero = resolveSection(sections, "projects_hero", D.PROJECTS_HERO);
  const cta = resolveSection(sections, "projects_cta", D.PROJECTS_CTA);
  return (
    <>
      {hero && (
        <EditableSection section={hero} name="Hero">
          <ProjectsHero section={hero} />
        </EditableSection>
      )}
      <section style={{ padding: "0 0 clamp(88px, 10vw, 136px)" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)", display: "flex", flexDirection: "column", gap: "24px" }}>
          <ManagedElsewhere label="Textes modifiables au clic ; captures, ordre et visibilité : liste des projets ci-dessous">
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              {projects.map((project, i) => (
                <CaseStudy key={project.slug} project={project} reverse={i % 2 === 1} />
              ))}
            </div>
          </ManagedElsewhere>
          {cta && (
            <EditableSection section={cta} name="Appel à l'action">
              <ProjectsCta section={cta} />
            </EditableSection>
          )}
        </div>
      </section>
    </>
  );
}
