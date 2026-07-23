export type ProjectFormData = {
  prenom: string;
  nom: string;
  email: string;
  entreprise: string;
  secteur: string;
  /** The chosen objective's title text (not a coded key) — the option
   * list is admin-editable, so there's no fixed enum to key off anymore. */
  objectif: string | null;
  typeSolution: string;
  budget: string;
  description: string;
  delai: string;
  canal: string;
  nda: boolean;
};

/** The wizard's 4 multiple-choice "questions" — admin-editable via the
 * "Démarrer un projet" CMS tab (PageSection, page=DEMARRER_PROJET). Each
 * type mirrors the shape of that section's `items` JSON. */
export type ObjectifOption = { icon: string; title: string; description: string };
export type SolutionOption = { label: string };
export type DelaiOption = { title: string; subtitle: string };
export type CanalOption = { icon: string; label: string };
