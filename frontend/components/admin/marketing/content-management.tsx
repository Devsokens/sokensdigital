"use client";

import { CheckCircle2 } from "lucide-react";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { PageSectionEditor } from "@/components/admin/marketing/page-section-editor";
import { BlogPostList } from "@/components/admin/marketing/blog-post-list";
import { ShowcaseProjectList } from "@/components/admin/marketing/showcase-project-list";
import { SiteSettingsForm } from "@/components/admin/marketing/site-settings-form";

function InfoNote({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/[0.03] p-5">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
      <p className="text-sm text-neutral-600">{text}</p>
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
          <ShowcaseProjectList />
        </TabsPanel>

        <TabsPanel value="blog" className="pt-6">
          <BlogPostList />
        </TabsPanel>

        <TabsPanel value="demarrer" className="pt-6">
          <InfoNote
            text={
              "Le formulaire « Démarrer un projet » n'a pas de contenu éditorial (ses champs sont fixes) — chaque soumission crée maintenant un vrai Lead, visible dans Marketing > Leads."
            }
          />
        </TabsPanel>

        <TabsPanel value="suivi" className="pt-6">
          <PageSectionEditor page="SUIVI_PROJET" />
        </TabsPanel>

        <TabsPanel value="header-footer" className="pt-6">
          <SiteSettingsForm />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
