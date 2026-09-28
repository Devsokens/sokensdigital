import type { Metadata } from "next";
import { LegalPage } from "@/components/sections/legal-page";
import { getSiteSettings } from "@/lib/api/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Conditions générales d'utilisation",
  description:
    "Conditions générales d'utilisation du site et des services Soken's Digital.",
  path: "/cgu",
});

export default async function CGUPage() {
  const settings = await getSiteSettings();
  return (
    <LegalPage
      kicker="Conditions"
      title="Conditions Générales d'Utilisation"
      text={settings.cgu_text}
      emptyMessage="Les conditions générales d'utilisation seront bientôt disponibles ici."
    />
  );
}
