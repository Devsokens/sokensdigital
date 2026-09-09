"use client";

import { useEffect } from "react";

/**
 * Enregistre le service worker après le premier rendu.
 *
 * Volontairement passif : aucun état, aucun rendu. Si l'enregistrement
 * échoue (navigateur sans support, contexte non sécurisé, utilisateur qui a
 * bloqué le stockage), l'application continue de fonctionner exactement
 * comme avant — le hors-ligne est un bonus, jamais une dépendance.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    // En développement, un SW qui met en cache la coque rend le
    // rechargement à chaud imprévisible — on ne l'active qu'en production.
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* pas de SW : l'app reste pleinement utilisable en ligne */
      });
    };

    // Après `load` : l'enregistrement ne dispute pas la bande passante au
    // premier rendu, qui compte davantage pour la vitesse perçue.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
