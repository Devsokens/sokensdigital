import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FAQAccordion } from "@/components/sections/faq/faq-accordion";
import { listPublicFAQ } from "@/lib/api/public";
import { pageMetadata } from "@/lib/seo/metadata";
import { JsonLd } from "@/components/seo/json-ld";
import { faqSchema } from "@/lib/seo/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "FAQ : questions fréquentes",
  description:
    "Réponses aux questions fréquentes sur les services, délais, tarifs et méthodes de Soken's Digital, agence digitale à Libreville (Gabon).",
  path: "/faq",
});

export default async function FAQPage() {
  const entries = await listPublicFAQ();

  return (
    <>
      {entries.length > 0 && (
        <JsonLd data={faqSchema(entries.map((e) => ({ question: e.question, answer: e.answer })))} />
      )}
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 pt-14 pb-20 sm:px-6 sm:pt-22 sm:pb-24 lg:px-8">
          <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">FAQ</span>
          <h1 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">Questions fréquentes</h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
            Vous ne trouvez pas de réponse ? Contactez-nous via le chat ou notre formulaire de contact.
          </p>

          <div className="mt-12">
            {entries.length > 0 ? (
              <FAQAccordion entries={entries} />
            ) : (
              <p className="text-sm text-muted-foreground">Aucune question pour l&apos;instant.</p>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
