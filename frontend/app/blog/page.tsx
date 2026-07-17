import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BlogExplorer } from "@/components/blog/blog-explorer";

export const metadata: Metadata = {
  title: "Blog — Soken's Digital",
  description:
    "Analyses techniques sur la cybersécurité, l'architecture logicielle et les infrastructures cloud.",
};

export default function BlogIndexPage() {
  return (
    <>
      <SiteHeader />
      <main className="flex-1">
        <BlogExplorer />
      </main>
      <SiteFooter />
    </>
  );
}
