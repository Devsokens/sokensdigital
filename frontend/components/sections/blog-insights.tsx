import { Cpu, GitBranch, Gauge } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Post = {
  icon: LucideIcon;
  date: string;
  title: string;
  excerpt: string;
};

const POSTS: Post[] = [
  {
    icon: Cpu,
    date: "12 OCT 2024",
    title: "L'avenir de l'IA générative dans les ERP",
    excerpt:
      "Comment intégrer les modèles LLM privés pour sécuriser vos données métier...",
  },
  {
    icon: GitBranch,
    date: "05 OCT 2024",
    title: "Micro-services vs Monolithe Modulaire",
    excerpt:
      "Choisir la bonne architecture pour votre croissance en 2025.",
  },
  {
    icon: Gauge,
    date: "28 SEP 2024",
    title: "Performance Web : Le coût caché du JS",
    excerpt:
      "Optimisation des bundles pour un chargement instantané sur mobile.",
  },
];

export function BlogInsights() {
  return (
    <section id="blog" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Insights Techniques
        </h2>
        <a
          href="#blog"
          className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          Lire le blog
          <span aria-hidden>→</span>
        </a>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {POSTS.map((post) => (
          <article
            key={post.title}
            className="group overflow-hidden rounded-2xl border border-white/10 bg-card/60 transition-colors hover:border-primary/30"
          >
            <div
              aria-hidden
              className="relative flex aspect-video items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_70%_30%,color-mix(in_oklch,var(--primary),transparent_78%),transparent_65%),linear-gradient(160deg,oklch(0.17_0.02_235),oklch(0.08_0.01_240))]"
            >
              <post.icon className="size-9 text-primary/50 transition-transform duration-300 group-hover:scale-110" />
            </div>
            <div className="p-5">
              <span className="text-[11px] font-medium tracking-[0.1em] text-muted-foreground uppercase">
                {post.date}
              </span>
              <h3 className="mt-2 text-base font-semibold text-foreground">
                {post.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {post.excerpt}
              </p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
