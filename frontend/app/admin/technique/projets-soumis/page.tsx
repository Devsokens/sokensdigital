import { RequireRole } from "@/components/admin/require-role";
import { SubmittedProjects } from "@/components/admin/submitted-projects";

/* Côté Technique : les demandes à analyser, et celles que le client vient de
 * valider et qu'il reste à passer en développement. */
export default function ProjetsSoumisTechniquePage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "CHEF_DE_PROJET", "DEVELOPPEUR"]}>
      <SubmittedProjects
        stages={["CHEZ_TECHNIQUE", "VALIDE_CLIENT", "EN_DEVELOPPEMENT"]}
        title="Gestion des projets"
        subtitle="Demandes à analyser, cahier des charges à produire, et passage en développement."
      />
    </RequireRole>
  );
}
