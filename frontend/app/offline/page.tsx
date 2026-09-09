import { WifiOff } from "lucide-react";

export const metadata = { title: "Hors ligne — Soken's Digital" };

/**
 * Page servie par le service worker quand une navigation échoue faute de
 * réseau. Volontairement statique et sans appel API : elle doit s'afficher
 * précisément dans le cas où plus rien ne répond.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-white/5 text-primary">
        <WifiOff className="size-6" />
      </span>
      <h1 className="text-xl font-semibold text-foreground">Vous êtes hors ligne</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Cette page n&apos;a pas pu être chargée. Les écrans déjà consultés restent
        accessibles ; la connexion sera reprise automatiquement dès qu&apos;elle revient.
      </p>
    </main>
  );
}
