import { SocialMediaCredentialsForm } from "@/components/admin/parametres/social-media-credentials-form";

export function ParametresReseauxSociaux() {
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Réseaux sociaux</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Identifiants de publication Facebook et Instagram — la publication programmée du Plan Éditorial les utilise directement, sans redéploiement.
      </p>
      <SocialMediaCredentialsForm />
    </div>
  );
}
