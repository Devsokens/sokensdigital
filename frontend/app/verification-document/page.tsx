import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DocumentVerification } from "@/components/document-verification";

export const metadata: Metadata = {
  title: "Vérification de document",
  robots: { index: false, follow: false },
};

/** Cible du QR code des pièces de caisse et des bons de demande. */
export default function VerificationDocumentPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 px-4 py-16 sm:py-24">
        <Suspense fallback={null}>
          <DocumentVerification />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
