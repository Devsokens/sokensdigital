import type { PageSection, SitePage } from "@/lib/api/types";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Server-side fetch (no Firebase auth — these are public, unauthenticated
 * endpoints) used by the public site's Server Components. Revalidates every
 * 60s so content edits made in /admin/marketing/blog show up without a
 * redeploy, without hitting Django on every single request. */
export async function getPageSections(page: SitePage): Promise<PageSection[]> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/public/cms/page-sections/?page=${page}`, {
      next: { revalidate: 60 },
    });
    if (!response.ok) return [];
    return (await response.json()) as PageSection[];
  } catch {
    // Backend unreachable — the calling page falls back to its own
    // hardcoded defaults rather than breaking the public site.
    return [];
  }
}

export function findSection(sections: PageSection[], key: string) {
  return sections.find((s) => s.section_key === key) ?? null;
}
