// Version déployée, comparée par le client (lib/admin/auto-refresh.tsx)
// pour proposer l'actualisation après une mise en production.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
