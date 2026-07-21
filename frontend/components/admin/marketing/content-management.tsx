"use client";

import { Sparkles } from "lucide-react";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { PageSectionEditor } from "@/components/admin/marketing/page-section-editor";
import { BlogPostList } from "@/components/admin/marketing/blog-post-list";

function ComingSoon({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-neutral-200 py-16 text-center">
      <Sparkles className="size-5 text-neutral-300" />
      <p className="text-sm text-neutral-400">{text}</p>
    </div>
  );
}

export function ContentManagement() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Gestion de contenu</h1>
        <p className="text-sm text-neutral-500">
          Tout ce qui s&apos;affiche sur le site public, page par page — textes, images, listes.
        </p>
      </div>

      <Tabs defaultValue="accueil">
        <TabsList>
          <TabsTab value="accueil">Accueil</TabsTab>
          <TabsTab value="expertise">Expertise</TabsTab>
          <TabsTab value="projets">Projets</TabsTab>
          <TabsTab value="blog">Blog</TabsTab>
          <TabsTab value="demarrer">Démarrer un projet</TabsTab>
          <TabsTab value="suivi">Suivi de projet</TabsTab>
          <TabsTab value="header-footer">Header & Footer</TabsTab>
          <TabsIndicator />
        </TabsList>

        <TabsPanel value="accueil" className="pt-6">
          <PageSectionEditor page="ACCUEIL" />
        </TabsPanel>

        <TabsPanel value="expertise" className="pt-6">
          <PageSectionEditor page="EXPERTISE" />
        </TabsPanel>

        <TabsPanel value="projets" className="pt-6">
          <ComingSoon text="Les projets vitrine (liste + fiches détaillées) nécessitent un module dédié — pas encore construit." />
        </TabsPanel>

        <TabsPanel value="blog" className="pt-6">
          <BlogPostList />
        </TabsPanel>

        <TabsPanel value="demarrer" className="pt-6">
          <ComingSoon text="Les libellés du formulaire 'Démarrer un projet' et son branchement sur l'API Lead arrivent bientôt." />
        </TabsPanel>

        <TabsPanel value="suivi" className="pt-6">
          <PageSectionEditor page="SUIVI_PROJET" />
        </TabsPanel>

        <TabsPanel value="header-footer" className="pt-6">
          <ComingSoon text="Logo, liens de navigation, réseaux sociaux et mentions légales — arrive bientôt." />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
