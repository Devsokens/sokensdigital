import { RequireRole } from "@/components/admin/require-role";
import { ProjectDetail } from "@/components/admin/technique/project-detail";

export default async function ProjetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireRole roles={["SUPER_ADMIN", "CHEF_DE_PROJET", "DEVELOPPEUR", "DIRECTEUR_FINANCIER"]}>
      <ProjectDetail id={id} />
    </RequireRole>
  );
}
