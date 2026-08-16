import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FAQAccordion } from "@/components/sections/faq/faq-accordion";
import { listPublicFAQ } from "@/lib/api/public";

export const metadata: Metadata = {
  title: "FAQ — Soken's Digital",
  description: "Réponses aux questions les plus fréquentes sur nos services et notre fonctionnement.",
};

export default async function FAQPage() {
  const entries = await listPublicFAQ();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 pt-32 pb-20 sm:px-6 sm:pt-40 sm:pb-24 lg:px-8">
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
