import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { Project } from "@/lib/projects/types";
import { frenchSpacing, type Section } from "./cms";
import { Editable, ManagedElsewhere } from "./editable";
import { ProjectCaseStudy } from "./project-case-study";
import { ProjectGallery } from "./project-gallery";
import { excerpt } from "./project-screen";
import { ProjectsCta } from "./projects-page";
import { TechLogo, techLogo } from "./tech-logos";
import { ArrowIcon, FONT_DISPLAY, FONT_DISPLAY_SYS, FONT_MONO, HEADER_HEIGHT, underHeader } from "./ui";

/* Détail d'un projet vitrine, « récit en 3 temps » : grand visuel, trois
 * cartes Besoin / Réponse / Résultat lisibles en 30 secondes, puis l'étude de
 * cas complète, dépliable. Partagé par /projects/[slug] et l'éditeur visuel
 * de l'admin (chaque champ du projet s'y modifie au clic). */

const LABEL = { fontFamily: FONT_MONO, fontSize: "12px", letterSpacing: "0.1em", textTransform: "uppercase", color: "oklch(var(--sd-primary-hi))" } as const;

const ICONS = {
  besoin: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
  reponse: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M12 2a7 7 0 0 0-4 12.7V16h8v-1.3A7 7 0 0 0 12 2z" /></>,
  resultat: <><path d="M3 17l6-6 4 4 8-8" /><path d="M14 7h7v7" /></>,
};

function StoryCard({ icon, label, children }: { icon: keyof typeof ICONS; label: string; children: ReactNode }) {
  return (
    <div className="sd-rv" style={{ position: "relative", padding: "28px", borderRadius: "22px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-card))", display: "flex", flexDirection: "column", gap: "16px" }}>
      <span style={{ width: "44px", height: "44px", borderRadius: "12px", background: "oklch(var(--sd-primary) / 0.1)", color: "oklch(var(--sd-primary-hi))", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS[icon]}</svg>
      </span>
      <span style={LABEL}>{label}</span>
      {children}
    </div>
  );
}

const PARAGRAPH = { margin: "0", fontSize: "16px", lineHeight: 1.65, color: "oklch(var(--sd-fg-3))", textWrap: "pretty" } as const;

export function ProjectDetailView({ project, related, cta, editing = false }: { project: Project; related: Project[]; cta: Section | null; editing?: boolean }) {
  const summary = project.summary || excerpt(project.description, 220);
  const need = project.challengeSummary || excerpt(project.challenge || project.description);
  const answer = project.solutionSummary || excerpt(project.solution || project.description);
  const stats = (project.stats ?? []).filter((s) => s.value.trim());
  const chips = [
    { key: "type", value: project.type },
    { key: "timeline", value: project.timeline },
  ];

  return (
    <>
      <section style={{ position: "relative", overflow: "hidden", ...underHeader("clamp(56px, 7vw, 96px)", "clamp(40px, 5vw, 56px)") }}>
        <div aria-hidden="true" style={{ position: "absolute", inset: "0", pointerEvents: "none" }}>
          <div className="sd-aurora sd-au1" style={{ width: "600px", height: "600px", left: "-120px", top: `${-320 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-1))", opacity: 0.28 }} />
          <div className="sd-aurora sd-au2" style={{ width: "480px", height: "480px", right: "-80px", top: `${-120 + HEADER_HEIGHT}px`, background: "oklch(var(--sd-glow-2))", opacity: 0.2 }} />
        </div>
        <div style={{ position: "relative", zIndex: 1, maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
          <p className="sd-bw" style={{ margin: "0", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", fontSize: "14px", color: "oklch(var(--sd-fg-4))" }}>
            <Link className="sd-nl" href="/" style={{ color: "oklch(var(--sd-fg-4))" }}>Accueil</Link>
            <span aria-hidden="true">/</span>
            <Link className="sd-nl" href="/projects" style={{ color: "oklch(var(--sd-fg-4))" }}>Projets</Link>
            <span aria-hidden="true">/</span>
            <span style={{ color: "oklch(var(--sd-fg-2))" }}>{project.title}</span>
          </p>
          <div style={{ marginTop: "28px", display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "28px 48px" }}>
            <div style={{ flex: "1 1 560px", minWidth: "0" }}>
              <h1 className="sd-bw" style={{ margin: "0", animationDelay: "0.1s", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(44px, 6.4vw, 88px)", lineHeight: 0.98, letterSpacing: "-0.045em" }}>
                <Editable path={{ scope: "project", key: "title" }} value={project.title}>
                  {project.title}
                </Editable>
              </h1>
              <p className="sd-bw" style={{ animationDelay: "0.22s", margin: "22px 0 0", maxWidth: "640px", fontSize: "clamp(17px, 1.6vw, 20px)", lineHeight: 1.6, color: "oklch(var(--sd-fg-2))", textWrap: "pretty" }}>
                <Editable path={{ scope: "project", key: "summary" }} kind="textarea" value={summary} hint="Une à deux phrases qui donnent envie : aussi utilisée sur les cartes de l'accueil.">
                  {frenchSpacing(summary)}
                </Editable>
              </p>
              <div className="sd-bw" style={{ animationDelay: "0.32s", marginTop: "22px", display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <span style={{ padding: "6px 13px", borderRadius: "999px", background: "oklch(var(--sd-primary) / 0.12)", color: "oklch(var(--sd-primary-hi))", fontSize: "13.5px", fontWeight: 500 }}>
                  <Editable path={{ scope: "project", key: "sector" }} value={project.sector}>
                    {project.sector}
                  </Editable>
                </span>
                {chips.map((chip) =>
                  chip.value || editing ? (
                    <span key={chip.key} style={{ padding: "6px 13px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.12)", fontSize: "13.5px", color: "oklch(var(--sd-fg-2))" }}>
                      <Editable path={{ scope: "project", key: chip.key }} value={chip.value}>
                        {chip.value || (chip.key === "type" ? "Type" : "Durée")}
                      </Editable>
                    </span>
                  ) : null,
                )}
                {(project.client || editing) && (
                  <span style={{ padding: "6px 13px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.12)", fontSize: "13.5px", color: "oklch(var(--sd-fg-2))" }}>
                    Client :{" "}
                    <Editable path={{ scope: "project", key: "client" }} value={project.client}>
                      {project.client || "nom du client"}
                    </Editable>
                  </span>
                )}
              </div>
            </div>
            <div className="sd-bw sd-btn-row" style={{ animationDelay: "0.38s", display: "flex", flexWrap: "wrap", gap: "12px" }}>
              {(project.projectUrl || editing) && (
                <a className="sd-ghost sd-arrow-link" href={project.projectUrl || "#"} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: "8px", height: "52px", padding: "0 22px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.14)", background: "rgba(255,255,255,0.03)", color: "oklch(var(--sd-fg))", fontSize: "15.5px", fontWeight: 500 }}>
                  <Editable path={{ scope: "project", key: "project_url" }} value={project.projectUrl ?? ""} hint="Adresse du site en ligne (https://…). Laissez vide pour masquer ce bouton.">
                    {project.projectUrl ? "Visiter le site" : "Ajouter l'adresse du site"}
                  </Editable>
                  <svg className="sd-arr" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M7 17 17 7" />
                    <path d="M8 7h9v9" />
                  </svg>
                </a>
              )}
              <Link className="sd-shimmer sd-arrow-link" href="/contact" style={{ display: "inline-flex", alignItems: "center", gap: "10px", height: "52px", padding: "0 24px", borderRadius: "12px", background: "oklch(var(--sd-primary))", color: "oklch(var(--sd-on-primary))", fontWeight: 600, fontSize: "15.5px" }}>
                Démarrer un projet similaire
                <ArrowIcon size={17} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section style={{ padding: "0 0 clamp(64px, 8vw, 104px)" }}>
        <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)", display: "flex", flexDirection: "column", gap: "clamp(40px, 5vw, 64px)" }}>
          <ProjectGallery project={project} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: "16px" }}>
            <StoryCard icon="besoin" label="Le besoin">
              <p style={PARAGRAPH}>
                <Editable path={{ scope: "project", key: "challenge_summary" }} kind="textarea" value={need} hint="Le problème du client, en une ou deux phrases.">
                  {frenchSpacing(need)}
                </Editable>
              </p>
            </StoryCard>
            <StoryCard icon="reponse" label="Notre réponse">
              <p style={PARAGRAPH}>
                <Editable path={{ scope: "project", key: "solution_summary" }} kind="textarea" value={answer} hint="La solution livrée, en une ou deux phrases.">
                  {frenchSpacing(answer)}
                </Editable>
              </p>
            </StoryCard>
            <StoryCard icon="resultat" label="Le résultat">
              <Editable path={{ scope: "project", key: "solution_points" }} kind="list" value={project.solutionPoints} hint="Un point clé par ligne (ce que le client a gagné ou peut faire désormais).">
                {project.solutionPoints.length ? (
                  <ul style={{ margin: "0", padding: "0", listStyle: "none", display: "flex", flexDirection: "column", gap: "10px" }}>
                    {project.solutionPoints.map((point) => (
                      <li key={point} style={{ display: "flex", alignItems: "flex-start", gap: "10px", fontSize: "15.5px", lineHeight: 1.5, color: "oklch(var(--sd-fg-2b))" }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="oklch(var(--sd-primary))" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flex: "none", marginTop: "3px" }}>
                          <path d="M5 12.5l4.5 4.5L19 7.5" />
                        </svg>
                        {frenchSpacing(point)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={PARAGRAPH}>{editing ? "Ajouter les points clés du résultat" : frenchSpacing(answer)}</p>
                )}
              </Editable>
            </StoryCard>
          </div>

          {(stats.length > 0 || editing) && (
            <Editable path={{ scope: "project", key: "stats" }} kind="list" value={stats.map((s) => `${s.value} | ${s.label}`)} hint="Un chiffre par ligne, sous la forme « valeur | libellé » (ex. : +40 % | de réservations en ligne).">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
                {stats.length ? (
                  stats.map((stat) => (
                    <div key={stat.label + stat.value} style={{ flex: "1 1 200px", padding: "22px 24px", borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)" }}>
                      <span style={{ display: "block", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "clamp(30px, 3vw, 40px)", lineHeight: 1.1, letterSpacing: "-0.03em" }}>{stat.value}</span>
                      <span style={{ fontSize: "14px", color: "oklch(var(--sd-fg-3))" }}>{stat.label}</span>
                    </div>
                  ))
                ) : (
                  <span style={{ fontSize: "14px", color: "oklch(var(--sd-fg-4))" }}>Ajouter des chiffres clés (facultatif)</span>
                )}
              </div>
            </Editable>
          )}

          {(project.technologies.length > 0 || editing) && (
            <div className="sd-rv" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 16px" }}>
              <span style={LABEL}>Technologies</span>
              <Editable path={{ scope: "project", key: "technologies" }} kind="list" value={project.technologies} hint="Une technologie par ligne. Les plus courantes (Next.js, Python, Django, PostgreSQL, Docker, AWS, Redis) s'affichent avec leur logo.">
                <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "8px" }}>
                  {project.technologies.length ? (
                    project.technologies.map((tech) => (
                      <span key={tech} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "7px 14px 7px 10px", borderRadius: "999px", border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.03)", fontSize: "14px", color: "oklch(var(--sd-fg))" }}>
                        <TechLogo src={techLogo(tech)} size={18} />
                        {tech}
                      </span>
                    ))
                  ) : (
                    <span style={{ fontSize: "14px", color: "oklch(var(--sd-fg-4))" }}>Ajouter les technologies utilisées</span>
                  )}
                </span>
              </Editable>
            </div>
          )}

          {(project.challenge || project.solution || editing) && <ProjectCaseStudy project={project} />}

          {cta && (
            <ManagedElsewhere label="Encart modifiable dans l'aperçu de la page Projets">
              <ProjectsCta section={cta} />
            </ManagedElsewhere>
          )}
        </div>
      </section>

      {related.length > 0 && (
        <section style={{ padding: "clamp(64px, 8vw, 104px) 0", background: "oklch(var(--sd-bg-deep))", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ maxWidth: "1240px", margin: "0 auto", padding: "0 clamp(20px, 4vw, 40px)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "16px 32px", marginBottom: "28px" }}>
              <h2 style={{ margin: "0", fontFamily: FONT_DISPLAY_SYS, fontWeight: 600, fontSize: "clamp(28px, 3.2vw, 40px)", lineHeight: 1.05, letterSpacing: "-0.03em" }}>Projets similaires</h2>
              <Link className="sd-arrow-link" href="/projects" style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "15px", fontWeight: 500, color: "oklch(var(--sd-fg))" }}>
                Tous nos projets
                <ArrowIcon size={16} />
              </Link>
            </div>
            <div className="sd-hscroll" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(300px, 100%), 1fr))", gap: "16px" }}>
              {related.map((item) => (
                <Link key={item.slug} className="sd-spot sd-arrow-link" href={`/projects/${item.slug}`} style={{ borderRadius: "18px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(var(--sd-card))", display: "flex", flexDirection: "column", color: "oklch(var(--sd-fg))" }}>
                  <div style={{ position: "relative", height: "170px", overflow: "hidden", background: "oklch(var(--sd-panel-deep))", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                    {item.images?.[0] ? (
                      <Image className="sd-zoom" src={item.images[0]} alt="" fill sizes="(max-width: 860px) 92vw, 380px" style={{ objectFit: "cover", objectPosition: "top center" }} />
                    ) : (
                      <span style={{ position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "22px", color: "oklch(var(--sd-fg-3))" }}>{item.title}</span>
                    )}
                  </div>
                  <div style={{ padding: "18px 20px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
                    <span style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: "0" }}>
                      <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "19px", lineHeight: 1.25, letterSpacing: "-0.015em" }}>{item.title}</span>
                      <span style={{ fontSize: "13.5px", color: "oklch(var(--sd-fg-4))", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{[item.sector, item.type].filter(Boolean).join(" · ")}</span>
                    </span>
                    <span style={{ flex: "none", color: "oklch(var(--sd-primary-hi))" }}>
                      <ArrowIcon size={17} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
