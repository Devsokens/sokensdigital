"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Send, Share2 } from "lucide-react";

/** Partage façon réseaux sociaux : Facebook, X, WhatsApp, LinkedIn, plus
 * "Copier le lien" et, sur mobile/navigateurs compatibles, le partage
 * natif du système (Web Share API — la feuille de partage native
 * iOS/Android, avec SMS/Messages/Mail en plus des réseaux). `url`/`title`
 * sont passés en props car ce composant peut être rendu pour un article de
 * blog ou une étude de cas — pas de dépendance à un type précis. */
export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  // navigator.share n'existe que côté client — vérifié après montage pour
  // éviter tout mismatch d'hydratation (le serveur ne peut pas le savoir).
  useEffect(() => {
    if (typeof navigator !== "undefined" && "share" in navigator) setCanNativeShare(true);
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Presse-papiers indisponible (permission refusée, contexte non
      // sécurisé) — rien de grave, l'utilisateur peut copier l'URL à la main.
    }
  }

  async function handleNativeShare() {
    try {
      await navigator.share({ title, url });
    } catch {
      // AbortError si l'utilisateur ferme la feuille de partage — pas une
      // erreur à remonter.
    }
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const links = [
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: FacebookLogo,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      icon: XLogo,
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      icon: MessageCircle,
    },
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: Send,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2">
      {links.map(({ label, href, icon: Icon }) => (
        <a
          key={label}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Icon className="size-3.5" />
          {label}
        </a>
      ))}
      <button
        type="button"
        onClick={handleCopy}
        className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
      >
        {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
        {copied ? "Copié" : "Copier"}
      </button>
      {canNativeShare && (
        <button
          type="button"
          onClick={handleNativeShare}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Share2 className="size-3.5" />
          Plus
        </button>
      )}
    </div>
  );
}

/** lucide-react n'a pas de logo Facebook/X dédié — silhouettes simples en
 * SVG inline, même API (prop `className`) que les icônes lucide utilisées
 * à côté. */
function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22c4.78-.76 8.44-4.92 8.44-9.94z" />
    </svg>
  );
}

function XLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
