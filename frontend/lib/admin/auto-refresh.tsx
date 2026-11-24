"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/* Actualisation automatique, sans gêner l'utilisateur.
 *
 * 1. Données : un signal « app:refresh » est émis toutes les 60 s quand
 *    l'onglet est visible ET que l'utilisateur ne fait rien (pas de saisie
 *    en cours, aucune fenêtre ouverte, pas d'action depuis 20 s), et au
 *    retour sur l'onglet après une absence. Les écrans abonnés via
 *    useAutoRefresh() rechargent leurs données en arrière-plan, sans
 *    écran de chargement ni perte de filtres ou de défilement.
 * 2. Nouvelle version : la version déployée est comparée à celle chargée
 *    (toutes les 5 min et au retour sur l'onglet). Si elle a changé : la
 *    page se recharge d'elle-même si l'onglet est caché, sinon un petit
 *    bandeau propose « Actualiser » — jamais de rechargement en pleine saisie.
 *
 * La messagerie et les notifications sont déjà en temps réel (Firestore). */

const REFRESH_EVENT = "app:refresh";
const DATA_INTERVAL_MS = 60_000;
const VERSION_INTERVAL_MS = 5 * 60_000;
const IDLE_AFTER_MS = 20_000;
const CURRENT_BUILD = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

let lastInteraction = Date.now();

function userIsBusy(): boolean {
  if (Date.now() - lastInteraction < IDLE_AFTER_MS) return true;
  const el = document.activeElement as HTMLElement | null;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return true;
  // Fenêtre modale, panneau latéral ou menu ouvert.
  return Boolean(document.querySelector('[role="dialog"], [data-popup-open], [data-open]'));
}

/** Recharge les données de l'écran à chaque signal d'actualisation. */
export function useAutoRefresh(callback: () => unknown) {
  const ref = useRef(callback);
  useEffect(() => {
    ref.current = callback;
  });
  useEffect(() => {
    const handler = () => {
      if (!navigator.onLine) return;
      try {
        const result = ref.current();
        if (result && typeof (result as Promise<unknown>).catch === "function") {
          (result as Promise<unknown>).catch(() => {});
        }
      } catch {
        /* une actualisation ratée sera retentée au prochain signal */
      }
    };
    window.addEventListener(REFRESH_EVENT, handler);
    return () => window.removeEventListener(REFRESH_EVENT, handler);
  }, []);
}

export function AutoRefresh() {
  const [newVersion, setNewVersion] = useState(false);

  useEffect(() => {
    const touch = () => {
      lastInteraction = Date.now();
    };
    const events = ["pointerdown", "keydown", "wheel", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));

    let hiddenSince = 0;
    const emit = () => window.dispatchEvent(new Event(REFRESH_EVENT));

    const dataTimer = window.setInterval(() => {
      if (document.visibilityState === "visible" && !userIsBusy()) emit();
    }, DATA_INTERVAL_MS);

    let reloadPending = false;
    async function checkVersion() {
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { build } = (await res.json()) as { build?: string };
        if (build && CURRENT_BUILD !== "dev" && build !== CURRENT_BUILD) {
          if (document.visibilityState === "hidden") {
            reloadPending = true;
          } else {
            setNewVersion(true);
          }
        }
      } catch {
        /* hors ligne : on réessaiera */
      }
    }
    const versionTimer = window.setInterval(checkVersion, VERSION_INTERVAL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenSince = Date.now();
        return;
      }
      // Retour sur l'onglet : nouvelle version en attente → rechargement
      // immédiat (l'utilisateur n'était pas en train de travailler dessus).
      if (reloadPending) {
        window.location.reload();
        return;
      }
      if (hiddenSince && Date.now() - hiddenSince > 15_000) {
        emit();
        checkVersion();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      window.clearInterval(dataTimer);
      window.clearInterval(versionTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  if (!newVersion) return null;
  return (
    <div className="fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 print:hidden lg:bottom-6">
      <div className="flex items-center gap-3 rounded-full bg-neutral-900 py-2 pr-2 pl-4 text-sm text-white shadow-lg">
        <span>Une mise à jour est disponible.</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-xs font-semibold text-neutral-900"
        >
          <RefreshCw className="size-3.5" /> Actualiser
        </button>
        <button type="button" onClick={() => setNewVersion(false)} aria-label="Plus tard" className="px-1 text-xs text-white/60 hover:text-white">
          Plus tard
        </button>
      </div>
    </div>
  );
}
