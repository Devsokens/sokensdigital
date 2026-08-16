import { DepartmentDetail } from "@/components/admin/rh/department-detail";

export default async function RhDepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <DepartmentDetail id={id} />;
}
