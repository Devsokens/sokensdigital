import { getSiteSettings } from "@/lib/api/public";
import { VitrineFooter } from "@/components/vitrine/site-footer";

/** Pied de page public, partagé par les pages vitrine et les pages secondaires. */
export async function SiteFooter() {
  const settings = await getSiteSettings();
  return <VitrineFooter settings={settings} />;
}
