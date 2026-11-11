import { DisbursementList } from "@/components/admin/technique/disbursement-list";

/** Interface Besoins du département Support Client : tout employé y exprime et suit
 * ses besoins ; la validation se fait dans Finance > Décaissements. */
export default function BesoinsPage() {
  return <DisbursementList mode="department" departmentLabel="Support Client" />;
}
