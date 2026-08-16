import { ClientDetail } from "@/components/admin/rh/client-detail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ClientDetail id={id} />;
}
