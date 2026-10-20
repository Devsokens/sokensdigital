"use client";

import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { PageSectionEditor } from "@/components/admin/marketing/page-section-editor";
import { VitrineEditor } from "@/components/admin/marketing/vitrine-editor";
import { BlogPostList } from "@/components/admin/marketing/blog-post-list";
import { CommentModeration } from "@/components/admin/marketing/comment-moderation";
import { ShowcaseProjectList } from "@/components/admin/marketing/showcase-project-list";
import { SiteSettingsForm } from "@/components/admin/marketing/site-settings-form";

export function ContentManagement() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-neutral-900">Gestion de contenu</h1>
        <p className="text-sm text-neutral-500">
          Le site tel qu&apos;il apparaît en ligne : cliquez sur n&apos;importe quel texte, bouton ou image pour le modifier.
        </p>
      </div>

      <Tabs defaultValue="accueil">
        <TabsList>
          <TabsTab value="accueil">Accueil</TabsTab>
          <TabsTab value="expertise">Expertise</TabsTab>
          <TabsTab value="projets">Projets</TabsTab>
          <TabsTab value="blog">Blog</TabsTab>
          <TabsTab value="contact">Contact</TabsTab>
          <TabsTab value="commentaires">Commentaires</TabsTab>
          <TabsTab value="demarrer">Démarrer un projet</TabsTab>
          <TabsTab value="suivi">Suivi de projet</TabsTab>
          <TabsTab value="header-footer">Paramètres du site</TabsTab>
          <TabsIndicator />
        </TabsList>

        <TabsPanel value="accueil" className="pt-6">
          <VitrineEditor page="ACCUEIL" />
        </TabsPanel>

        <TabsPanel value="expertise" className="pt-6">
          <VitrineEditor page="EXPERTISE" />
        </TabsPanel>

        <TabsPanel value="projets" className="space-y-10 pt-6">
          <VitrineEditor page="PROJETS" />
          <div>
            <h2 className="mb-1 text-lg font-semibold text-neutral-900">Projets vitrine</h2>
            <p className="mb-4 text-sm text-neutral-500">Les études de cas affichées sur la page Projets et sur l&apos;accueil (cochez « Accueil »).</p>
            <ShowcaseProjectList />
          </div>
        </TabsPanel>

        <TabsPanel value="blog" className="space-y-10 pt-6">
          <VitrineEditor page="BLOG" />
          <div>
            <h2 className="mb-1 text-lg font-semibold text-neutral-900">Articles</h2>
            <p className="mb-4 text-sm text-neutral-500">Le plus récent est mis à la une sur la page Blog et sur l&apos;accueil.</p>
            <BlogPostList />
          </div>
        </TabsPanel>

        <TabsPanel value="contact" className="pt-6">
          <VitrineEditor page="CONTACT" />
        </TabsPanel>

        <TabsPanel value="commentaires" className="pt-6">
          <CommentModeration />
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
