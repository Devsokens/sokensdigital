import { RequireRole } from "@/components/admin/require-role";
import { QuoteList } from "@/components/admin/marketing/quote-list";

export default function DevisPage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "COMMERCIAL", "CHEF_DE_PROJET"]}>
      <QuoteList />
    </RequireRole>
  );
}
