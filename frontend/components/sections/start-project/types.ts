export type Objectif = "transformation" | "logiciel" | "audit";
export type Delai = "express" | "standard" | "etendue";
export type Canal = "email" | "video" | "slack" | "appel";

export type ProjectFormData = {
  prenom: string;
  nom: string;
  email: string;
  entreprise: string;
  secteur: string;
  objectif: Objectif | null;
  typeSolution: string;
  budget: string;
  description: string;
  delai: Delai;
  canal: Canal;
  nda: boolean;
};

export const INITIAL_FORM_DATA: ProjectFormData = {
  prenom: "",
  nom: "",
  email: "",
  entreprise: "",
  secteur: "",
  objectif: null,
  typeSolution: "Développement Web",
  budget: "",
  description: "",
  delai: "standard",
  canal: "email",
  nda: false,
};
