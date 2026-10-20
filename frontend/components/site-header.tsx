import { getSiteSettings } from "@/lib/api/public";
import { VitrineHeader } from "@/components/vitrine/site-header";
import { contactInfo } from "@/components/vitrine/ui";

/** En-tête public, partagé par les pages vitrine et les pages secondaires
 * (légal, FAQ, détail projet/article, suivi, devis). */
export async function SiteHeader() {
  const settings = await getSiteSettings();
  return <VitrineHeader logoUrl={settings.logo_url} phone={contactInfo(settings).phone} />;
}
