import { RequireRole } from "@/components/admin/require-role";
import { QuoteList } from "@/components/admin/marketing/quote-list";

export default function TechniqueDevisPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "COMMERCIAL", "CHEF_DE_PROJET"]}>
      <QuoteList basePath="/admin/technique/devis" />
    </RequireRole>
  );
}
