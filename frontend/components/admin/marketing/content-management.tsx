"use client";

import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { PageSectionEditor } from "@/components/admin/marketing/page-section-editor";
import { BlogPostList } from "@/components/admin/marketing/blog-post-list";
import { ShowcaseProjectList } from "@/components/admin/marketing/showcase-project-list";
import { SiteSettingsForm } from "@/components/admin/marketing/site-settings-form";

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
          <PageSectionEditor page="DEMARRER_PROJET" />
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
