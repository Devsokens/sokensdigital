import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StartProjectWizard } from "@/components/sections/start-project/start-project-wizard";
import { getPageSections, findSection } from "@/lib/api/public";
import type {
  ObjectifOption,
  SolutionOption,
  DelaiOption,
  CanalOption,
} from "@/components/sections/start-project/types";

export const metadata: Metadata = {
  title: "Démarrer un Projet — Soken's Digital",
  description:
    "Parlez-nous de votre vision : informations, configuration technique et logistique pour lancer votre projet avec Soken's Digital.",
};

const DEFAULT_OBJECTIFS: ObjectifOption[] = [
  { icon: "rocket", title: "Transformation Digitale", description: "Modernisez vos processus internes et votre stack technologique." },
  { icon: "square-terminal", title: "Logiciel Sur-Mesure", description: "Conception et développement d'applications critiques hautes performances." },
  { icon: "shield", title: "Audit Cybersécurité", description: "Évaluation des vulnérabilités et renforcement de l'infrastructure." },
];

const DEFAULT_SOLUTIONS: SolutionOption[] = [
  { label: "Développement Web" },
  { label: "Application Mobile" },
  { label: "Logiciel Sur-Mesure" },
  { label: "Infrastructure Cloud" },
  { label: "Audit Cybersécurité" },
  { label: "Autre" },
];

const DEFAULT_DELAIS: DelaiOption[] = [
  { title: "Express", subtitle: "Moins d'un mois" },
  { title: "Standard", subtitle: "2 à 3 mois" },
  { title: "Étendue", subtitle: "Plus de 4 mois" },
];

const DEFAULT_CANAUX: CanalOption[] = [
  { icon: "mail", label: "Email" },
  { icon: "video", label: "Vidéo" },
  { icon: "message-square", label: "Slack" },
  { icon: "phone", label: "Appel" },
];

export default async function DemarrerUnProjetPage() {
  const sections = await getPageSections("DEMARRER_PROJET");

  const objectifs = (findSection(sections, "start_project_objectifs")?.items as ObjectifOption[] | undefined)?.length
    ? (findSection(sections, "start_project_objectifs")!.items as unknown as ObjectifOption[])
    : DEFAULT_OBJECTIFS;
  const solutions = (findSection(sections, "start_project_solutions")?.items as SolutionOption[] | undefined)?.length
    ? (findSection(sections, "start_project_solutions")!.items as unknown as SolutionOption[])
    : DEFAULT_SOLUTIONS;
  const delais = (findSection(sections, "start_project_delais")?.items as DelaiOption[] | undefined)?.length
    ? (findSection(sections, "start_project_delais")!.items as unknown as DelaiOption[])
    : DEFAULT_DELAIS;
  const canaux = (findSection(sections, "start_project_canaux")?.items as CanalOption[] | undefined)?.length
    ? (findSection(sections, "start_project_canaux")!.items as unknown as CanalOption[])
    : DEFAULT_CANAUX;

  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <StartProjectWizard objectifs={objectifs} solutions={solutions} delais={delais} canaux={canaux} />
      </main>
      <SiteFooter />
    </>
  );
}
