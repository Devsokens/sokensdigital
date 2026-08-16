import { SpecificationEditPage } from "@/components/admin/marketing/specification-edit-page";

export default async function TechniqueEditSpecificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <SpecificationEditPage id={id} basePath="/admin/technique/cahier-des-charges" />;
}
