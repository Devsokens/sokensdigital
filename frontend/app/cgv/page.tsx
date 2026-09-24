import type { Metadata } from "next";
import { LegalPage } from "@/components/sections/legal-page";
import { getSiteSettings } from "@/lib/api/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Conditions générales de vente",
  description:
    "Conditions générales de vente des prestations Soken's Digital.",
  path: "/cgv",
});

export default async function CGVPage() {
  const settings = await getSiteSettings();
  return (
    <LegalPage
      kicker="Conditions"
      title="Conditions Générales de Vente"
      text={settings.cgv_text}
      emptyMessage="Les conditions générales de vente seront bientôt disponibles ici."
    />
  );
}
