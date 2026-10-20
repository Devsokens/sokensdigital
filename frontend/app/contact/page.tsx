import type { Metadata } from "next";
import { VitrineShell } from "@/components/vitrine/vitrine-shell";
import { ContactView } from "@/components/vitrine/contact-page";
import { contactInfo } from "@/components/vitrine/ui";
import { getPageSections, getSiteSettings } from "@/lib/api/public";
import { pageMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = pageMetadata({
  title: "Contact : agence digitale à Libreville",
  description:
    "Contactez Soken's Digital à Libreville (Gabon) : téléphone 060 00 13 33, e-mail ou formulaire. Réponse rapide pour vos projets web, mobiles et cloud partout en Afrique.",
  path: "/contact",
});

export default async function ContactPage() {
  const [sections, settings] = await Promise.all([getPageSections("CONTACT"), getSiteSettings()]);
  const { email, phone } = contactInfo(settings);
  return (
    <VitrineShell page="contact">
      <ContactView sections={sections} email={email} phone={phone} />
    </VitrineShell>
  );
}
