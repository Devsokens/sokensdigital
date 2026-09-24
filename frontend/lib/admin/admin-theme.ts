/** Thème clair/sombre de l'espace d'administration — choix personnel de
 * chaque utilisateur, mémorisé dans ce navigateur.
 *
 * Le thème est posé sur <html> (attribut `data-admin-theme`) et non sur le
 * shell : les feuilles, modales et popovers sont rendus en portail
 * directement dans <body>, hors du shell — un attribut sur le shell les
 * laisserait en clair.
 *
 * Le rendu sombre ne réécrit aucun composant : globals.css redéfinit, sous
 * `html[data-admin-theme="dark"]`, les variables de couleur que Tailwind
 * utilise pour `white` et l'échelle `neutral-*` — celles dont l'admin est
 * construite partout. Un seul endroit à maintenir, et tout écran existant
 * ou futur suit automatiquement. */

export type AdminTheme = "light" | "dark";

export const ADMIN_THEME_STORAGE_KEY = "admin-theme";
export const ADMIN_THEME_EVENT = "admin-theme-changed";

export function readAdminTheme(): AdminTheme {
  try {
    const stored = window.localStorage.getItem(ADMIN_THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // stockage indisponible : on retombe sur la préférence système
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyAdminTheme(theme: AdminTheme) {
  document.documentElement.dataset.adminTheme = theme;
}

export function setAdminTheme(theme: AdminTheme) {
  try {
    window.localStorage.setItem(ADMIN_THEME_STORAGE_KEY, theme);
  } catch {
    // le choix vaut pour la session en cours à défaut d'être mémorisé
  }
  applyAdminTheme(theme);
  window.dispatchEvent(new CustomEvent(ADMIN_THEME_EVENT, { detail: theme }));
}

export function clearAdminTheme() {
  delete document.documentElement.dataset.adminTheme;
}

/** Script inline exécuté avant l'hydratation : applique le thème mémorisé
 * dès le premier rendu, sans éclair clair au chargement d'une page admin
 * en mode sombre. Reprend la logique de readAdminTheme() à l'identique. */
export const ADMIN_THEME_BOOTSTRAP = `(function(){try{var t=localStorage.getItem('${ADMIN_THEME_STORAGE_KEY}');if(t!=='light'&&t!=='dark'){t=window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.dataset.adminTheme=t;}catch(e){}})();`;
