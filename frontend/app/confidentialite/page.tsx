import type { Metadata } from "next";
import { LegalPage } from "@/components/sections/legal-page";
import { getSiteSettings } from "@/lib/api/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Politique de confidentialité",
  description:
    "Politique de confidentialité et protection des données personnelles de Soken's Digital.",
  path: "/confidentialite",
});

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
