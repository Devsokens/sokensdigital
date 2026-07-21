import type { PageSection } from "@/lib/api/types";

type Partner = { name: string; logo_url?: string };

const DEFAULT_PARTNERS: Partner[] = [
  { name: "CYBERCORE" }, { name: "Logo strix" }, { name: "NEBULA" }, { name: "CLOUDSEC" }, { name: "ORBITAL" },
];

export function PartnerLogos({ section }: { section?: PageSection | null }) {
  const partners: Partner[] = section?.items?.length
    ? (section.items as Partner[])
    : DEFAULT_PARTNERS;

  return (
    <section className="border-y border-white/10 bg-white/[0.02] py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 sm:justify-between sm:px-6 lg:px-8">
        {partners.map((partner, i) => (
          partner.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={partner.logo_url} alt={partner.name} className="h-7 w-auto object-contain opacity-60 grayscale transition-opacity hover:opacity-90" />
          ) : (
            <span
              key={i}
              className="text-sm font-semibold tracking-[0.15em] text-muted-foreground/50 uppercase select-none"
            >
              {partner.name}
            </span>
          )
        ))}
      </div>
    </section>
  );
}
