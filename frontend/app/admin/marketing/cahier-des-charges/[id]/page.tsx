import { SpecificationEditPage } from "@/components/admin/marketing/specification-edit-page";

export default async function EditSpecificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SpecificationEditPage id={id} />;
}
