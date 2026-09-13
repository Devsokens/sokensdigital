import type { Metadata } from "next";
import { LegalPage } from "@/components/sections/legal-page";
import { getSiteSettings } from "@/lib/api/public";

export const metadata: Metadata = {
  title: "Mentions légales — Soken's Digital",
  description: "Mentions légales du site Soken's Digital.",
};

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
