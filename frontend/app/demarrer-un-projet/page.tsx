import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StartProjectWizard } from "@/components/sections/start-project/start-project-wizard";

export const metadata: Metadata = {
  title: "Démarrer un Projet — Soken's Digital",
  description:
    "Parlez-nous de votre vision : informations, configuration technique et logistique pour lancer votre projet avec Soken's Digital.",
};

export default function DemarrerUnProjetPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <StartProjectWizard />
      </main>
      <SiteFooter />
    </>
  );
}
