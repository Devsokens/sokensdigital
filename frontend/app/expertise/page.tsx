import type { Metadata } from "next";
import { VitrineShell } from "@/components/vitrine/vitrine-shell";
import { ExpertiseView } from "@/components/vitrine/expertise-page";
import { getPageSections } from "@/lib/api/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Expertise : développement web, mobile, cloud et cybersécurité",
  description:
    "Développement d'applications web et mobiles, logiciels sur mesure, cloud et cybersécurité à Libreville (Gabon) : une expertise technique au service des entreprises africaines.",
  path: "/expertise",
  keywords: ["développement sur mesure Gabon", "cybersécurité Afrique", "cloud Libreville"],
});

export default async function ExpertisePage() {
  const sections = await getPageSections("EXPERTISE");
  return (
    <VitrineShell page="expertise">
      <ExpertiseView sections={sections} />
    </VitrineShell>
  );
}
