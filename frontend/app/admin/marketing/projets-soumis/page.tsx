import { RequireRole } from "@/components/admin/require-role";
import { SubmittedProjects } from "@/components/admin/submitted-projects";

/* Côté Marketing : les demandes qu'il doit traiter — celles qui arrivent du
 * portail public, celles que Technique lui a rendues avec un cahier des
 * charges, et celles en attente de réponse du client. Les étapes purement
 * techniques ne l'encombrent pas. */
export default function ProjetsSoumisMarketingPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "RESPONSABLE_MARKETING", "COMMERCIAL"]}>
      <SubmittedProjects
        stages={["SOUMIS", "CDC_PRET", "SOUMIS_CLIENT", "VALIDE_CLIENT"]}
        title="Projets soumis"
        subtitle="Demandes reçues par le portail public, à transmettre au technique puis au client."
      />
    </RequireRole>
  );
}
