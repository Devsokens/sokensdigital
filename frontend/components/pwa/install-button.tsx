"use client";

import { useEffect, useState } from "react";
import { Download, Share, Plus, X } from "lucide-react";

/** L'événement n'est pas dans lib.dom.d.ts (proposition non standardisée,
 * implémentée par Chromium uniquement) — on le décrit nous-mêmes. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "prompt" | "ios" | "installed" | "unsupported";

function detectIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // iPadOS 13+ s'annonce comme un Mac : le test du multi-touch le distingue
  // d'un vrai macOS de bureau.
  const iPadOs = /Macintosh/.test(ua) && typeof document !== "undefined" && "ontouchend" in document;
  return /iPad|iPhone|iPod/.test(ua) || iPadOs;
}

function detectStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS n'expose pas display-mode et utilise ce champ non standard.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Bouton « Installer l'application ».
 *
 * Deux chemins, parce que les plateformes n'offrent pas la même chose :
 *  - Chromium (Android, Windows, macOS, Linux) expose `beforeinstallprompt`,
 *    on déclenche la boîte de dialogue native.
 *  - iOS/iPadOS Safari n'a AUCUNE API d'installation. Le seul chemin est
 *    Partager → Sur l'écran d'accueil : on affiche donc la marche à suivre
 *    plutôt qu'un bouton qui ne ferait rien.
 *
 * Si l'app tourne déjà en mode installé, le composant ne rend rien : proposer
 * d'installer ce qui est installé n'aide personne.
 */
export function InstallButton({ className = "" }: { className?: string }) {
  const [platform, setPlatform] = useState<Platform>("unsupported");
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    if (detectStandalone()) {
      setPlatform("installed");
      return;
    }
    if (detectIos()) {
      setPlatform("ios");
      return;
    }

    const onBeforeInstall = (event: Event) => {
      // Sans preventDefault, Chrome affiche sa propre mini-infobar et ne
      // nous laisse plus déclencher le prompt au moment choisi.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setPlatform("prompt");
    };
    const onInstalled = () => setPlatform("installed");

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // Le prompt n'est utilisable qu'une fois : après un refus, le navigateur
    // le réémettra de lui-même plus tard s'il le juge pertinent.
    setDeferred(null);
    if (outcome === "accepted") setPlatform("installed");
    else setPlatform("unsupported");
  }

  if (platform === "installed" || platform === "unsupported") return null;

  if (platform === "ios") {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={() => setShowIosHelp((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/80 transition-colors hover:border-white/30 hover:text-white"
        >
          <Download className="size-4" />
          Installer l&apos;application
        </button>

        {showIosHelp && (
          <div className="relative mt-3 rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
            <button
              type="button"
              onClick={() => setShowIosHelp(false)}
              aria-label="Fermer"
              className="absolute right-3 top-3 text-white/40 hover:text-white/70"
            >
              <X className="size-4" />
            </button>
            <p className="mb-3 font-medium text-white">Sur iPhone / iPad</p>
            <ol className="space-y-2 text-white/70">
              <li className="flex items-center gap-2">
                <span className="text-white/40">1.</span>
                Touchez <Share className="mx-0.5 inline size-4" /> Partager
              </li>
              <li className="flex items-center gap-2">
                <span className="text-white/40">2.</span>
                Choisissez <Plus className="mx-0.5 inline size-4" /> Sur l&apos;écran d&apos;accueil
              </li>
              <li className="flex items-center gap-2">
                <span className="text-white/40">3.</span>
                Confirmez avec Ajouter
              </li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
      className={`flex w-full items-center justify-center gap-2 rounded-full border border-white/15 px-4 py-2.5 text-sm text-white/80 transition-colors hover:border-white/30 hover:text-white ${className}`}
    >
      <Download className="size-4" />
      Installer l&apos;application
    </button>
  );
}
