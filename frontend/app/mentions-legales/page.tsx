import type { Metadata } from "next";
import { LegalPage } from "@/components/sections/legal-page";
import { getSiteSettings } from "@/lib/api/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Mentions légales",
  description:
    "Mentions légales du site Soken's Digital : éditeur, RCCM, hébergement.",
  path: "/mentions-legales",
});

export default async function MentionsLegalesPage() {
  const settings = await getSiteSettings();
  return (
    <LegalPage
      kicker="Informations légales"
      title="Mentions légales"
      text={settings.mentions_legales_text}
      emptyMessage="Les mentions légales seront bientôt disponibles ici."
    />
  );
}
