"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Loader2, MessageSquarePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitTestimonial } from "@/lib/api/public";
import type { PageSection } from "@/lib/api/types";

type Testimonial = {
  quote: string;
  name: string;
  role: string;
};

const DEFAULT_TITLE = "La voix de nos partenaires";
const DEFAULT_TESTIMONIALS: Testimonial[] = [
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

// Même rythme que le carrousel de la section Équipe (team.tsx) : avance
// d'une carte, pause franche, décélération marquée — pas un tapis roulant
// continu.
const PAUSE_MS = 4000;
const STEP_DURATION_MS = 900;
const STEP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const REPEAT = 4;

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

function TestimonialCard({ t }: { t: Testimonial }) {
  return (
    <figure className="w-full rounded-2xl border border-white/10 bg-card/60 p-6 sm:p-7">
      <blockquote className="text-sm leading-relaxed text-foreground/90 sm:text-base">
        &ldquo;{t.quote}&rdquo;
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {initials(t.name)}
        </span>
        <span>
          <span className="block text-sm font-semibold text-foreground">{t.name}</span>
          <span className="block text-xs text-muted-foreground">{t.role}</span>
        </span>
      </figcaption>
    </figure>
  );
}

/** Défilement autonome, même mécanique que TeamCarousel (team.tsx) : avance
 * d'une carte toutes les PAUSE_MS, décélère, boucle sans coupure sur une
 * liste répétée. Pas de glisser manuel ici (non demandé pour cette
 * section) — juste la pause au survol. */
function TestimonialCarousel({ testimonials }: { testimonials: Testimonial[] }) {
  const reduceMotion = useReducedMotion();
  const firstCardRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  const [index, setIndex] = useState(() => Math.floor(REPEAT / 2) * testimonials.length);
  const [instant, setInstant] = useState(false);
  const [paused, setPaused] = useState(false);

  const centerIndex = Math.floor(REPEAT / 2) * testimonials.length;

  useEffect(() => {
    const card = firstCardRef.current;
    if (!card) return;
    const measure = () => {
      const gap = parseFloat(getComputedStyle(card.parentElement!).columnGap || "0");
      setStep(card.getBoundingClientRect().width + gap);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(card);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (reduceMotion || paused || step === 0 || testimonials.length === 0) return;
    const id = setInterval(() => setIndex((i) => i + 1), PAUSE_MS);
    return () => clearInterval(id);
  }, [reduceMotion, paused, step, testimonials.length]);

  useEffect(() => {
    if (testimonials.length === 0) return;
    const N = testimonials.length;
    if (index >= N && index <= N * (REPEAT - 1)) return;
    const id = setTimeout(() => {
      setInstant(true);
      setIndex(((index % N) + N) % N + centerIndex);
    }, STEP_DURATION_MS + 20);
    return () => clearTimeout(id);
  }, [index, testimonials.length, centerIndex]);

  useEffect(() => {
    if (!instant) return;
    const id = requestAnimationFrame(() => setInstant(false));
    return () => cancelAnimationFrame(id);
  }, [instant]);

  if (testimonials.length === 0) return null;
  const items = Array.from({ length: REPEAT }, () => testimonials).flat();

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-linear-to-r from-background to-transparent sm:w-20" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-linear-to-l from-background to-transparent sm:w-20" />

      <div
        // items-start : sans ça, flexbox étire par défaut chaque carte à la
        // hauteur de la plus haute (align-items: stretch) — les cartes aux
        // citations courtes se retrouvaient avec un grand vide en bas.
        className="flex items-start gap-4 py-2"
        style={{
          transform: `translateX(-${index * step}px)`,
          transition: instant ? "none" : `transform ${STEP_DURATION_MS}ms ${STEP_EASE}`,
        }}
      >
        {items.map((t, i) => (
          // Largeur ET shrink-0 sur le même élément — celui que flexbox
          // traite réellement comme l'item de la rangée. Les poser sur
          // <figure> (un descendant) laissait le calcul de largeur de cet
          // item ambigu : les cartes finissaient soit compressées, soit —
          // une fois shrink-0 seul déplacé ici sans la largeur — bien plus
          // larges que prévu, avec le texte qui ne s'enroulait plus du tout.
          <div
            key={`${t.name}-${i}`}
            ref={i === 0 ? firstCardRef : undefined}
            className="w-[300px] shrink-0 sm:w-[420px]"
          >
            <TestimonialCard t={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

const EMPTY_FORM = { name: "", role: "", company_name: "", email: "", quote: "" };

/** Bouton + formulaire "Laisser un témoignage". Fenêtre bâtie directement
 * sur les primitives Dialog de base-ui (piège au clavier, Echap, clic
 * extérieur déjà gérés par la librairie) plutôt que sur components/ui/modal
 * — ce composant partagé est stylé pour l'admin (fond clair), et le
 * dupliquer ici en sombre serait plus simple que de le rendre "thémable"
 * pour ce seul usage public. */
function LeaveTestimonialButton() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      // On repart d'un formulaire propre à chaque ouverture ; le message de
      // succès, lui, reste visible pendant la fermeture précédente.
      setForm(EMPTY_FORM);
      setError(null);
      setSuccess(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitTestimonial({
        name: form.name,
        role: form.role || undefined,
        company_name: form.company_name || undefined,
        email: form.email || undefined,
        quote: form.quote,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur inattendue est survenue.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger
        render={
          <motion.button
            type="button"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <motion.span
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.5, ease: "easeInOut" }}
              className="inline-flex"
            >
              <MessageSquarePlus className="size-4" />
            </motion.span>
            Laisser un témoignage
          </motion.button>
        }
      />

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0" />
        <Dialog.Popup
          className="fixed top-1/2 left-1/2 z-50 flex max-h-[85vh] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-white/10 bg-card shadow-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] data-[starting-style]:scale-90 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
            <Dialog.Title className="text-base font-semibold text-foreground">
              Laisser un témoignage
            </Dialog.Title>
            <Dialog.Close
              aria-label="Fermer"
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-5">
            {success ? (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center gap-3 py-6 text-center"
              >
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <CheckCircle2 className="size-6" />
                </span>
                <p className="text-sm text-foreground">
                  Merci ! Ton témoignage a bien été reçu et sera examiné par notre équipe avant publication.
                </p>
                <Dialog.Close className="mt-1 text-sm font-medium text-primary hover:underline">
                  Fermer
                </Dialog.Close>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3.5">
                {error && (
                  <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
                    {error}
                  </p>
                )}

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Nom *</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Rôle</span>
                    <input
                      value={form.role}
                      onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-medium text-muted-foreground">Entreprise</span>
                    <input
                      value={form.company_name}
                      onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                      className="w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">
                    E-mail (facultatif, pour te recontacter)
                  </span>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    className="w-full rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-muted-foreground">Témoignage *</span>
                  <textarea
                    required
                    rows={4}
                    value={form.quote}
                    onChange={(e) => setForm((f) => ({ ...f, quote: e.target.value }))}
                    className="w-full resize-none rounded-lg border border-white/10 bg-background/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
                  />
                </label>

                <Button type="submit" disabled={submitting} className="w-full justify-center rounded-full py-2.5">
                  {submitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" /> Envoi...
                    </>
                  ) : (
                    "Envoyer mon témoignage"
                  )}
                </Button>
              </form>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Testimonials({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const testimonials: Testimonial[] = section?.items?.length
    ? (section.items as Testimonial[])
    : DEFAULT_TESTIMONIALS;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-end sm:justify-between sm:text-left">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h2>
        <LeaveTestimonialButton />
      </div>

      <div className="mt-10">
        <TestimonialCarousel testimonials={testimonials} />
      </div>
    </section>
  );
}
