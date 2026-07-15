type Testimonial = {
  quote: string;
  name: string;
  role: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    quote:
      "Soken's Digital n'est pas seulement un prestataire, c'est un partenaire stratégique. Leur capacité à comprendre nos enjeux de sécurité critique a été déterminante pour notre migration cloud.",
    name: "Alexandre Dumas",
    role: "CTO, CyberSentinel Inc.",
  },
  {
    quote:
      "La précision technique et le respect des délais sont rares dans ce secteur. L'équipe a livré une plateforme robuste qui gère aujourd'hui plus d'un million de transactions quotidiennes.",
    name: "Marie Leblanc",
    role: "Directrice Innovation, AeroLogistics",
  },
];

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <h2 className="text-center text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
        La voix de nos partenaires
      </h2>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="rounded-2xl border border-white/10 bg-card/60 p-6 sm:p-7"
          >
            <blockquote className="text-sm leading-relaxed text-foreground/90 sm:text-base">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                {initials(t.name)}
              </span>
              <span>
                <span className="block text-sm font-semibold text-foreground">
                  {t.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t.role}
                </span>
              </span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
