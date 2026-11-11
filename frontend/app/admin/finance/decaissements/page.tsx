import { DisbursementList } from "@/components/admin/technique/disbursement-list";
import { DecaissementsGuard } from "@/components/admin/finance/decaissements-guard";

/** Finance & Comptabilité > Décaissements : tous les besoins des
 * départements, validation signée (Directeur financier puis Gérant). */
export default function DecaissementsFinancePage() {
  return (
    <DecaissementsGuard>
      <DisbursementList mode="finance" />
    </DecaissementsGuard>
  );
}
