"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import {
  ADMIN_THEME_EVENT,
  applyAdminTheme,
  clearAdminTheme,
  readAdminTheme,
  setAdminTheme,
  type AdminTheme,
} from "@/lib/admin/admin-theme";

/** Bascule clair/sombre de l'administration, disponible pour tous les
 * utilisateurs quel que soit leur rôle. */
export function AdminThemeToggle() {
  const [theme, setTheme] = useState<AdminTheme | null>(null);

  useEffect(() => {
    setTheme(readAdminTheme());
    const onChange = (event: Event) => setTheme((event as CustomEvent<AdminTheme>).detail);
    window.addEventListener(ADMIN_THEME_EVENT, onChange);
    return () => window.removeEventListener(ADMIN_THEME_EVENT, onChange);
  }, []);

  const isDark = theme === "dark";
  const label = isDark ? "Passer en mode clair" : "Passer en mode sombre";

  return (
    <button
      type="button"
      onClick={() => setAdminTheme(isDark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className="flex size-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
    >
      {isDark ? <Sun className="size-[1.1rem]" /> : <Moon className="size-[1.1rem]" />}
    </button>
  );
}

/** Retire le thème admin de <html> en quittant l'espace d'administration :
 * le site vitrine a sa propre palette et ne doit jamais hériter du
 * remappage des couleurs. */
export function AdminThemeScope() {
  useEffect(() => {
    // Le script inline du layout couvre le premier chargement ; une
    // navigation côté client depuis le site vitrine ne le réexécute pas.
    applyAdminTheme(readAdminTheme());
    return () => clearAdminTheme();
  }, []);
  return null;
}
