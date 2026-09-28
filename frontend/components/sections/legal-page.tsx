import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

/** HTML riche saisi dans l'admin (site-settings-form.tsx, éditeur Tiptap),
 * nettoyé côté serveur avant stockage (core.sanitize.sanitize_html) — même
 * frontière de confiance que components/blog/article-content.tsx. */
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
              <div
                className="space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base [&_a]:text-primary [&_a]:underline [&_h2]:pt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:pt-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:pl-5"
                dangerouslySetInnerHTML={{ __html: text }}
              />
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
