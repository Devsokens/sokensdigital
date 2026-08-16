import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ContactForm } from "@/components/sections/contact/contact-form";
import { getSiteSettings } from "@/lib/api/public";

export const metadata: Metadata = {
  title: "Contact — Soken's Digital",
  description: "Une question, un projet ? Contactez l'équipe Soken's Digital.",
};

export default async function ContactPage() {
  const settings = await getSiteSettings();

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 pt-32 pb-20 sm:px-6 sm:pt-40 sm:pb-24 lg:px-8">
          <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">Contact</span>
          <h1 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">Parlons de votre projet</h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-muted-foreground">
            Une question, un besoin d&apos;accompagnement ? Notre équipe vous répond rapidement.
          </p>

          <div className="mt-12">
            <ContactForm settings={settings} />
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
