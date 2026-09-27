import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/** Texte brut (pas de rich text côté CMS, voir site-settings-form.tsx) —
 * `whitespace-pre-wrap` reproduit les sauts de ligne saisis dans l'admin
 * sans avoir besoin de parser du Markdown/HTML. */
export function LegalPage({
  kicker,
  title,
  text,
  emptyMessage,
}: {
  kicker: string;
  title: string;
  text: string;
  emptyMessage: string;
}) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-6xl px-4 pt-32 pb-20 sm:px-6 sm:pt-40 sm:pb-24 lg:px-8">
          <span className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">{kicker}</span>
          <h1 className="mt-3 text-3xl font-semibold text-foreground sm:text-4xl">{title}</h1>

          <div className="mt-10 max-w-3xl">
            {text ? (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground sm:text-base">
                {text}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
