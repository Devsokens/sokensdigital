import { getSiteSettings } from "@/lib/api/public";
import { SiteHeaderClient } from "@/components/site-header-client";

export async function SiteHeader() {
  const settings = await getSiteSettings();
  return <SiteHeaderClient navLinks={settings.nav_links} logoUrl={settings.logo_url} />;
}
