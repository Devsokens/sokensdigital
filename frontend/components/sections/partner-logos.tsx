import type { PageSection } from "@/lib/api/types";

type Partner = { name: string; logo_url?: string };

const DEFAULT_TITLE = "Ils nous font confiance";
const DEFAULT_PARTNERS: Partner[] = [
  { name: "CYBERCORE" }, { name: "Logo strix" }, { name: "NEBULA" }, { name: "CLOUDSEC" }, { name: "ORBITAL" },
];

export function PartnerLogos({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const partners: Partner[] = section?.items?.length
    ? (section.items as Partner[])
    : DEFAULT_PARTNERS;

  return (
    // Même structure (mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8)
    // que Services/Témoignages/Équipe — avec un padding et un fond qui lui
    // étaient propres, cette section ressortait comme une bannière à part
    // plutôt que de suivre le même rythme que le reste de la page.
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <h2 className="text-center text-sm font-semibold tracking-[0.1em] text-muted-foreground uppercase">
        {title}
      </h2>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6 sm:justify-between">
        {partners.map((partner, i) => (
          partner.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={partner.logo_url} alt={partner.name} className="h-10 w-auto object-contain opacity-60 grayscale transition-opacity hover:opacity-90 sm:h-12" loading="lazy" decoding="async" />
          ) : (
            <span
              key={i}
              className="text-lg font-semibold tracking-[0.15em] text-muted-foreground/50 uppercase select-none sm:text-xl"
            >
              {partner.name}
            </span>
          )
        ))}
      </div>
    </section>
  );
}
