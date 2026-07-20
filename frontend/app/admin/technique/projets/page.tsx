import { RequireRole } from "@/components/admin/require-role";
import { ProjectList } from "@/components/admin/technique/project-list";

export default function ProjetsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "CHEF_DE_PROJET", "DEVELOPPEUR", "DIRECTEUR_FINANCIER"]}>
      <ProjectList />
    </RequireRole>
  );
}
