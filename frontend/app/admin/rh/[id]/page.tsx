import { EmployeeDetail } from "@/components/admin/rh/employee-detail";

export default async function RhEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EmployeeDetail id={id} />;
}
