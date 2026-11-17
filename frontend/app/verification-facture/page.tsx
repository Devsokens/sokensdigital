import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InvoiceVerification } from "@/components/invoice-verification";

export const metadata: Metadata = {
  title: "Vérification de facture",
  robots: { index: false, follow: false },
};

/** Cible du QR code fiscal imprimé sur les factures. */
export default function VerificationFacturePage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-4 py-16 sm:py-24">
        <Suspense fallback={null}>
          <InvoiceVerification />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
