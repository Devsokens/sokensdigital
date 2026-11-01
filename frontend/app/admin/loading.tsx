import { Loader2 } from "lucide-react";

/* État de chargement de toutes les pages /admin.
 *
 * Sans ce fichier, un clic dans la sidebar ne change rien à l'écran tant que
 * le serveur n'a pas répondu pour la nouvelle route (et, en `next dev`, tant
 * qu'elle n'a pas été compilée) : la navigation paraissait figée plusieurs
 * secondes. Avec lui, Next affiche ce repli immédiatement dans le shell,
 * qui reste en place et interactif, et peut précharger les routes
 * dynamiques ([id]) partiellement. */
export default function AdminLoading() {
  return (
    <div className="flex flex-1 items-center justify-center py-32">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}
