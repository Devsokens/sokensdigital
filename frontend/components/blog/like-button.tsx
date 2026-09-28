"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { getBlogLikeCount, setBlogLiked } from "@/lib/api/blog-interactions";

function likedStorageKey(slug: string) {
  return `blog-liked:${slug}`;
}

/** Like façon Facebook, sans compte visiteur : le compteur est partagé
 * (stocké côté serveur dans Firestore), mais "j'ai déjà liké" ne vit que
 * dans le localStorage de ce navigateur — pas de session publique pour
 * faire mieux, et ça suffit à éviter le double-clic accidentel. */
export function LikeButton({ slug }: { slug: string }) {
  const [count, setCount] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBlogLikeCount(slug)
      .then((data) => {
        if (!cancelled) setCount(data.like_count);
      })
      .catch(() => {
        if (!cancelled) setCount(0);
      });
    try {
      setLiked(localStorage.getItem(likedStorageKey(slug)) === "1");
    } catch {
      // localStorage indisponible (navigation privée stricte...) — le like
      // reste fonctionnel, juste sans mémoire d'une visite à l'autre.
    }
    return () => {
      cancelled = true;
    };
  }, [slug]);

  async function toggle() {
    if (pending) return;
    const next = !liked;
    setPending(true);
    setLiked(next);
    setCount((c) => (c === null ? c : Math.max(0, c + (next ? 1 : -1))));
    try {
      const data = await setBlogLiked(slug, next);
      setCount(data.like_count);
      try {
        if (next) localStorage.setItem(likedStorageKey(slug), "1");
        else localStorage.removeItem(likedStorageKey(slug));
      } catch {
        // idem — pas bloquant.
      }
    } catch {
      // Rollback optimiste si la requête échoue.
      setLiked(!next);
      setCount((c) => (c === null ? c : Math.max(0, c + (next ? -1 : 1))));
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={liked}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        liked
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-white/10 bg-white/[0.02] text-foreground hover:border-primary/40 hover:text-primary"
      )}
    >
      <Heart className={cn("size-4", liked && "fill-current")} />
      J&apos;aime
      {count !== null && <span className="text-muted-foreground">· {count}</span>}
    </button>
  );
}
