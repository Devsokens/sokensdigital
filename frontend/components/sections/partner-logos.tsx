import type { PageSection } from "@/lib/api/types";

const DEFAULT_PARTNERS = ["CYBERCORE", "Logo strix", "NEBULA", "CLOUDSEC", "ORBITAL"];

export function PartnerLogos({ section }: { section?: PageSection | null }) {
  const partners = section?.items?.length
    ? (section.items as { name: string }[]).map((item) => item.name)
    : DEFAULT_PARTNERS;

  return (
    <section className="border-y border-white/10 bg-white/[0.02] py-10">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 sm:justify-between sm:px-6 lg:px-8">
        {partners.map((partner, i) => (
          <span
            key={partner}
            className="text-sm font-semibold tracking-[0.15em] text-muted-foreground/50 uppercase select-none"
            style={i === 2 ? { filter: "blur(2px)" } : undefined}
          >
            {partner}
          </span>
        ))}
      </div>
    </section>
  );
}
