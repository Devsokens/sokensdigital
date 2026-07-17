import { Button } from "@/components/ui/button";

export function ProjectsCta() {
  return (
    <section className="border-t border-white/10 bg-white/[0.02] py-16 sm:py-20">
      <div className="mx-auto max-w-2xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Sécurisez Votre Futur Digital.
        </h2>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Prêt à déployer une solution haute performance ? Nos spécialistes
          sont à votre écoute.
        </p>
        <Button
          render={<a href="/demarrer-un-projet">Démarrer un Projet</a>}
          nativeButton={false}
          size="lg"
          className="mt-7 h-12 rounded-full bg-primary px-7 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        />
      </div>
    </section>
  );
}
