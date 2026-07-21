import type { ShowcaseProject as ApiShowcaseProject } from "@/lib/api/types";
import type { Project } from "@/lib/projects/types";
import type { SceneVariant } from "@/components/projects/mockup-scenes";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function toProject(p: ApiShowcaseProject): Project {
  return {
    slug: p.slug,
    category: p.category,
    sector: p.sector,
    type: p.type,
    featured: p.featured,
    statusTag: p.status_tag,
    tag: p.tag,
    title: p.title,
    description: p.description,
    visualIcon: p.visual_icon,
    projectUrl: p.project_url || undefined,
    videoSrc: p.video_src || undefined,
    images: p.images?.length ? p.images : undefined,
    sceneVariants: p.scene_variants?.length ? (p.scene_variants as SceneVariant[]) : undefined,
    client: p.client,
    technologies: p.technologies,
    timeline: p.timeline,
    leadName: p.lead_name,
    leadRole: p.lead_role,
    challenge: p.challenge,
    stats: p.stats,
    solution: p.solution,
    solutionPoints: p.solution_points,
  };
}

/** Server-side fetch (public, unauthenticated) used by the public site's
 * Server Components. Revalidates every 60s so CMS edits show up without a
 * redeploy, without hitting Django on every single request.
 * `homepage: true` restricts to the projects flagged for the Accueil
 * "Projets récents" carousel (filtered server-side — show_on_homepage
 * itself isn't part of the public response shape). */
export async function getShowcaseProjects({ homepage = false }: { homepage?: boolean } = {}): Promise<Project[]> {
  try {
    const qs = homepage ? "?homepage=true" : "";
    const response = await fetch(`${API_BASE_URL}/api/v1/public/showcase-projects/${qs}`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as ApiShowcaseProject[];
    return data.map(toProject);
  } catch {
    return [];
  }
}

export async function getShowcaseProjectBySlug(slug: string): Promise<Project | null> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/public/showcase-projects/${slug}/`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    return toProject((await response.json()) as ApiShowcaseProject);
  } catch {
    return null;
  }
}

export function getRelatedShowcaseProjects(projects: Project[], slug: string, count = 3) {
  return projects.filter((p) => p.slug !== slug).slice(0, count);
}
