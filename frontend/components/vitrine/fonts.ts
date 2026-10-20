import { Bricolage_Grotesque, Geist } from "next/font/google";

/* Polices de la maquette, chargées ici plutôt que dans le layout racine pour
 * ne pas les précharger dans l'admin. Geist Mono vient déjà du layout racine
 * (--font-geist-mono). Polices variables : toutes les graisses de la
 * maquette (400 à 700) sont couvertes par un seul fichier. */
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
});

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

/** Classe racine de tout bloc vitrine : variables de police + portée `.sd`. */
export const vitrineRootClass = `sd ${bricolage.variable} ${geist.variable}`;
