import type { Metadata } from "next";
import { LegalPage } from "@/components/sections/legal-page";
import { getSiteSettings } from "@/lib/api/public";

export const metadata: Metadata = {
  title: "Conditions Générales de Vente — Soken's Digital",
  description: "Conditions générales de vente des prestations Soken's Digital.",
};

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
