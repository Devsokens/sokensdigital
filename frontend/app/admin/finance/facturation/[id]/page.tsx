import { RequireRole } from "@/components/admin/require-role";
import { InvoiceEditPage } from "@/components/admin/finance/invoice-edit-page";

export default async function InvoiceEditRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequireRole roles={["SUPER_ADMIN", "DIRECTEUR_FINANCIER", "COMPTABLE"]}>
      <InvoiceEditPage id={id} />
    </RequireRole>
  );
}
