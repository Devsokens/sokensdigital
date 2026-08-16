import { DevisAcceptancePage } from "@/components/devis/devis-acceptance-page";

export default async function DevisTrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <DevisAcceptancePage token={token} />;
}
