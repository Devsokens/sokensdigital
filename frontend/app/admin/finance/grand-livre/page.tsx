import { RequireRole } from "@/components/admin/require-role";
import { JournalEntries } from "@/components/admin/finance/journal-entries";

export default function GrandLivrePage() {
  return (
    <RequireRole roles={["SUPER_ADMIN", "DIRECTEUR_FINANCIER", "COMPTABLE"]}>
      <JournalEntries />
    </RequireRole>
  );
}
