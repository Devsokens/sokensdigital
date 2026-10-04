import { Suspense } from "react";
import { RequireRole } from "@/components/admin/require-role";
import { ProjectsHub } from "@/components/admin/technique/projects-hub";

export default function ProjetsPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "CHEF_DE_PROJET", "DEVELOPPEUR", "DIRECTEUR_FINANCIER"]}>
      {/* Suspense : ProjectsHub lit l'onglet dans l'URL (useSearchParams). */}
      <Suspense>
        <ProjectsHub />
      </Suspense>
    </RequireRole>
  );
}
