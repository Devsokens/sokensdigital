import { RequireRole } from "@/components/admin/require-role";
import { QuotePrintView } from "@/components/admin/marketing/quote-print-view";

export default async function DevisImprimerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ embed?: string }>;
}) {
  const { id } = await params;
  const { embed } = await searchParams;
  return (
    <RequireRole roles={["SUPER_ADMIN", "COMMERCIAL", "CHEF_DE_PROJET"]}>
      <QuotePrintView id={id} hideToolbar={embed === "1"} />
    </RequireRole>
  );
}
