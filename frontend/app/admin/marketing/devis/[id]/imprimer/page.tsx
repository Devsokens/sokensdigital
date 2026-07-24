import { RequireRole } from "@/components/admin/require-role";
import { QuotePrintView } from "@/components/admin/marketing/quote-print-view";

export default async function DevisImprimerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <RequireRole roles={["SUPER_ADMIN", "COMMERCIAL", "CHEF_DE_PROJET"]}>
      <QuotePrintView id={id} />
    </RequireRole>
  );
}
