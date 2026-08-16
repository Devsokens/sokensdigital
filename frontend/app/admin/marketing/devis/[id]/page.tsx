import { QuoteEditPage } from "@/components/admin/marketing/quote-edit-page";

export default async function DevisEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <QuoteEditPage id={id} />;
}
