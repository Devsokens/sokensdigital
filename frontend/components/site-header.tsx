import { getSiteSettings } from "@/lib/api/public";
import { NAV_LINKS } from "@/lib/site-nav";
import { SiteHeaderClient } from "@/components/site-header-client";

export async function SiteHeader() {
  const settings = await getSiteSettings();
  return <SiteHeaderClient navLinks={NAV_LINKS} logoUrl={settings.logo_url} />;
}
