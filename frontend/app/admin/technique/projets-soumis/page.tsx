import { redirect } from "next/navigation";

/* Les projets soumis côté Technique sont désormais un onglet de la page
 * Projets — l'ancienne adresse y renvoie (liens et notifications déjà
 * envoyés). */
export default function ProjetsSoumisTechniquePage() {
  redirect("/admin/technique/projets?tab=soumis");
}
