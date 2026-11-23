import { RequireRole } from "@/components/admin/require-role";
import { InvoiceEditor } from "@/components/admin/finance/invoice-editor";

export default function NewInvoicePage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "COMPTABLE"]}>
      <InvoiceEditor />
    </RequireRole>
  );
}
