import type { Metadata } from "next";
import { LegalPage } from "@/components/sections/legal-page";
import { getSiteSettings } from "@/lib/api/public";

export const metadata: Metadata = {
  title: "Politique de confidentialité — Soken's Digital",
  description: "Politique de confidentialité et protection des données de Soken's Digital.",
};

export default async function ConfidentialitePage() {
  const settings = await getSiteSettings();
  return (
    <LegalPage
      kicker="Vie privée"
      title="Politique de confidentialité"
      text={settings.politique_confidentialite_text}
      emptyMessage="La politique de confidentialité sera bientôt disponible ici."
    />
  );
}
