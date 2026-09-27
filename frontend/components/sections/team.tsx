"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PageSection } from "@/lib/api/types";

type Member = {
  name: string;
  role: string;
  bio?: string;
  photo_url?: string;
};

const DEFAULT_TITLE = "Notre Équipe";
const DEFAULT_SUBTITLE =
  "Les architectes, ingénieurs et experts sécurité qui conçoivent et livrent chacun de vos projets.";

const DEFAULT_TEAM: Member[] = [
  {
    name: "Dr. Elias Vance",
    role: "Architecte Sécurité",
    photo_url: "/assets/team/elias-vance.jpg",
    bio: "Pilote la stratégie de cybersécurité et l'architecture Zero Trust.",
  },
  {
    name: "Sofia Ramirez",
    role: "Lead Frontend Engineer",
    photo_url: "/assets/team/sofia-ramirez.jpg",
    bio: "Conçoit des interfaces temps réel pour les environnements haute fréquence.",
  },
  {
    name: "Marc Dubois",
    role: "Architecte Cloud",
    photo_url: "/assets/team/al-anderson.jpg",
    bio: "Orchestre les infrastructures multi-cloud à grande échelle.",
  },
  {
    name: "Léa Fontaine",
    role: "Ingénieure Sécurité",
    photo_url: "/assets/team/teresa-akins.jpg",
    bio: "Sécurise les données sensibles et les architectures réglementées.",
  },
  {
    name: "Taiger Dev",
    role: "Développeur Full Stack",
    photo_url: "/assets/team/george-talbot.jpg",
    bio: "Construit les briques techniques de nos solutions sur-mesure.",
  },
];

const DEFAULT_AVATARS: Record<string, string> = {
  "dr. elias vance": "/assets/team/elias-vance.jpg",
  "sofia ramirez": "/assets/team/sofia-ramirez.jpg",
  "marc dubois": "/assets/team/al-anderson.jpg",
  "léa fontaine": "/assets/team/teresa-akins.jpg",
  "lea fontaine": "/assets/team/teresa-akins.jpg",
  "taiger dev": "/assets/team/george-talbot.jpg",
};

// Pause entre deux avancées et durée de chaque avancée : un défilement
// continu façon tapis roulant a l'air mécanique. Ici, le carrousel avance
// d'une carte, s'arrête net (comme un humain qui relâche après un swipe),
// patiente, puis recommence.
const PAUSE_MS = 4000;
const STEP_DURATION_MS = 900;
const STEP_EASE = "cubic-bezier(0.22, 1, 0.36, 1)"; // décélération franche, pas linéaire

// Nombre de copies de la liste des membres, mises bout à bout, pour pouvoir
// glisser manuellement dans les deux sens (pas seulement vers l'avant comme
// l'auto-défilement) sans jamais tomber à court de cartes à afficher.
const REPEAT = 6;
const DRAG_THRESHOLD_PX = 6;

function initials(name: string) {
  return name
    .replace("Dr. ", "")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

function MemberCard({ member }: { member: Member }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const photo =
    member.photo_url ||
    DEFAULT_AVATARS[member.name.toLowerCase().trim()];

  return (
    <div
      onClick={() => setIsFlipped((prev) => !prev)}
      className={cn(
        // rounded-full est volontairement évité ici : sur une carte non carrée
        // (230x390 / 250x420), un rayon = moitié de la largeur transforme les
        // bords haut/bas en demi-cercles continus (forme "stade") sans aucun
        // segment plat — le nom/rôle, positionné pile dans cette zone (au
        // repos sous la photo, ou au-dessus une fois survolé), se retrouvait
        // alors rogné à gauche et à droite par cette courbe. Un rayon fixe
        // nettement inférieur à la moitié de la largeur garde un bord plat
        // au centre, où le texte s'affiche, tout en restant très arrondi.
        "group/card relative flex h-full w-full cursor-pointer flex-col justify-between overflow-hidden rounded-[3rem] border border-white/10 bg-card/60 p-3.5 select-none transition-all duration-500 hover:border-primary/40 hover:bg-card hover:shadow-xl hover:shadow-primary/10",
        isFlipped && "border-primary/40 bg-card shadow-xl shadow-primary/10"
      )}
    >
      {/* Photo circulaire (en haut en état normal, glisse vers le bas au survol) */}
      <div
        className={cn(
          "relative z-10 aspect-square w-full overflow-hidden rounded-full border border-white/10 bg-background/80 shadow-md transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]",
          "group-hover/card:translate-y-[168px] sm:group-hover/card:translate-y-[178px]",
          isFlipped && "translate-y-[168px] sm:translate-y-[178px]"
        )}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={member.name}
            loading="lazy"
            decoding="async"
            className="size-full object-cover grayscale transition-all duration-700 ease-out group-hover/card:grayscale-0 group-hover/card:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center bg-linear-to-br from-primary/20 via-card to-background">
            <span className="text-3xl font-bold tracking-tight text-primary">
              {initials(member.name)}
            </span>
          </div>
        )}
      </div>

      {/* Bloc texte (en bas en état normal, glisse vers le haut au survol) */}
      <div
        className={cn(
          "relative z-0 flex flex-1 flex-col items-center justify-center px-3 text-center transition-transform duration-700 ease-[cubic-bezier(0.25,1,0.5,1)]",
          "group-hover/card:-translate-y-[212px] sm:group-hover/card:-translate-y-[222px]",
          isFlipped && "-translate-y-[212px] sm:-translate-y-[222px]"
        )}
      >
        <h3 className="text-base font-semibold text-foreground tracking-tight sm:text-lg">
          {member.name}
        </h3>
        <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary">
          {member.role}
        </p>
      </div>
    </div>
  );
}

/** Carrousel qui avance carte par carte ("en bloc"), avec une pause entre
 * chaque avancée — plutôt qu'un tapis roulant continu. La liste est dupliquée
 * une fois pour boucler sans coupure : dès que le défilement atteint le début
 * de la copie (visuellement identique à l'original), on saute à zéro sans
 * transition, pendant l'œil ne peut pas le voir. */
function TeamCarousel({ team }: { team: Member[] }) {
  const reduceMotion = useReducedMotion();
  const viewportRef = useRef<HTMLDivElement>(null);
  const firstCardRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);
  // Démarre au milieu de la liste répétée : ni le tout début ni la fin, pour
  // pouvoir glisser dans les deux sens dès le départ sans manquer de cartes.
  const [index, setIndex] = useState(() => Math.floor(REPEAT / 2) * team.length);
  const [instant, setInstant] = useState(false);
  const [paused, setPaused] = useState(false);

  // État du glisser manuel (souris + tactile, via Pointer Events).
  const [dragging, setDragging] = useState(false);
  const [dragDelta, setDragDelta] = useState(0);
  const dragStartXRef = useRef(0);
  const dragStartIndexRef = useRef(0);
  const draggedRef = useRef(false); // a-t-on dépassé le seuil de tolérance ? (distingue un clic d'un glissement)

  const centerIndex = Math.floor(REPEAT / 2) * team.length;

  // Mesure la largeur réelle "carte + espace" (dépend du breakpoint), pour
  // convertir un déplacement d'une carte en pixels.
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
    if (reduceMotion || paused || dragging || step === 0 || team.length === 0) return;
    const id = setInterval(() => setIndex((i) => i + 1), PAUSE_MS);
    return () => clearInterval(id);
  }, [reduceMotion, paused, dragging, step, team.length]);

  // La liste est répétée REPEAT fois : dès que l'index (avancée auto ou
  // glissement manuel) s'éloigne trop du centre, on le ramène — sans
  // transition — à la position équivalente de la copie du milieu, pour
  // garder toujours assez de cartes des deux côtés. Comme chaque copie est
  // identique, ce saut est invisible.
  useEffect(() => {
    if (team.length === 0 || dragging) return;
    const N = team.length;
    const safeMin = N;
    const safeMax = N * (REPEAT - 1);
    if (index >= safeMin && index <= safeMax) return;
    const id = setTimeout(() => {
      setInstant(true);
      setIndex(((index % N) + N) % N + centerIndex);
    }, STEP_DURATION_MS + 20);
    return () => clearTimeout(id);
  }, [index, team.length, dragging, centerIndex]);

  useEffect(() => {
    if (!instant) return;
    const id = requestAnimationFrame(() => setInstant(false));
    return () => cancelAnimationFrame(id);
  }, [instant]);

  function handlePointerDown(e: React.PointerEvent) {
    if (step === 0) return;
    draggedRef.current = false;
    dragStartXRef.current = e.clientX;
    dragStartIndexRef.current = index;
    setPaused(true);
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return;
    const delta = e.clientX - dragStartXRef.current;
    if (Math.abs(delta) > DRAG_THRESHOLD_PX) draggedRef.current = true;
    setDragDelta(delta);
  }

  function handlePointerUp() {
    if (!dragging) return;
    const stepsMoved = step > 0 ? Math.round(-dragDelta / step) : 0;
    setDragging(false);
    setDragDelta(0);
    setIndex(dragStartIndexRef.current + stepsMoved);
    setPaused(false);
  }

  // Empêche le clic (bascule photo/texte de la carte) de se déclencher
  // juste après un glissement, tout en le laissant passer pour un vrai clic.
  function handleClickCapture(e: React.MouseEvent) {
    if (draggedRef.current) {
      e.stopPropagation();
      e.preventDefault();
      draggedRef.current = false;
    }
  }

  if (team.length === 0) return null;
  const items = Array.from({ length: REPEAT }, () => team).flat();

  return (
    <div
      ref={viewportRef}
      className="relative min-w-0 flex-1 overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => {
        setPaused(false);
        if (dragging) handlePointerUp();
      }}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 z-20 w-10 bg-linear-to-r from-background to-transparent sm:w-16" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-20 w-10 bg-linear-to-l from-background to-transparent sm:w-16" />

      <div
        className={cn("flex cursor-grab gap-6 py-4 select-none", dragging && "cursor-grabbing")}
        style={{
          transform: `translateX(${-(index * step) + dragDelta}px)`,
          transition: instant || dragging ? "none" : `transform ${STEP_DURATION_MS}ms ${STEP_EASE}`,
          touchAction: "pan-y",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onClickCapture={handleClickCapture}
      >
        {items.map((member, i) => (
          // Largeur/hauteur ET shrink-0 sur le même élément — celui que
          // flexbox traite réellement comme l'item de la rangée (pas
          // <MemberCard>, un descendant) — voir la même correction, avec le
          // même raisonnement détaillé, dans testimonials.tsx.
          <div
            key={`${member.name}-${i}`}
            ref={i === 0 ? firstCardRef : undefined}
            className="h-[390px] w-[230px] shrink-0 sm:h-[420px] sm:w-[250px]"
          >
            <MemberCard member={member} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Team({ section }: { section?: PageSection | null }) {
  const title = section?.title || DEFAULT_TITLE;
  const subtitle = section?.subtitle || DEFAULT_SUBTITLE;
  const team: Member[] = section?.items?.length ? (section.items as Member[]) : DEFAULT_TEAM;

  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24 lg:px-8">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center">
        {/* Zone de texte à gauche, fixe — ne s'étire plus sur toute la ligne */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as const }}
          className="lg:w-64 lg:shrink-0"
        >
          <span className="mb-4 inline-flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Users className="size-6" />
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">
            {subtitle}
          </p>
        </motion.div>

        {/* Carrousel : occupe le reste de la ligne, mais reste dans le
         * conteneur max-w-6xl, contrairement à l'ancienne version en
         * pleine largeur d'écran. */}
        <TeamCarousel team={team} />
      </div>
    </section>
  );
}
