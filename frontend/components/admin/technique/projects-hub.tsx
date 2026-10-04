"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FolderKanban, Inbox } from "lucide-react";
import { ProjectList } from "@/components/admin/technique/project-list";
import { SubmittedProjects } from "@/components/admin/submitted-projects";
import { useAuth } from "@/lib/auth/auth-context";
import { profileRoles, type AppRole } from "@/lib/firebase/types";
import { cn } from "@/lib/utils";

// Mêmes rôles que l'ancienne page /admin/technique/projets-soumis.
const SUBMITTED_ROLES: AppRole[] = ["SUPER_ADMIN", "CHEF_DE_PROJET", "DEVELOPPEUR"];

type HubTab = "projets" | "soumis";

/** Page « Projets » du module Technique : la liste des projets et, en
 * second onglet, les projets soumis (anciennement une entrée de menu à
 * part). L'onglet vit dans l'URL (?tab=soumis) pour les liens directs et
 * les notifications. */
export function ProjectsHub() {
  const { profile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const canSeeSubmitted = profileRoles(profile).some((r) => SUBMITTED_ROLES.includes(r));
  const tab: HubTab = searchParams.get("tab") === "soumis" && canSeeSubmitted ? "soumis" : "projets";

  function selectTab(next: HubTab) {
    router.replace(next === "soumis" ? `${pathname}?tab=soumis` : pathname, { scroll: false });
  }

  const tabs = canSeeSubmitted ? (
    <div className="mb-5 inline-flex rounded-xl bg-neutral-100 p-1">
      {([
        { value: "projets", label: "Projets", icon: FolderKanban },
        { value: "soumis", label: "Projets soumis", icon: Inbox },
      ] as const).map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => selectTab(value)}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
            tab === value ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-900"
          )}
        >
          <Icon className="size-4" />
          {label}
        </button>
      ))}
    </div>
  ) : null;

  if (tab === "soumis") {
    return (
      <div>
        {tabs}
        <SubmittedProjects
          stages={["CHEZ_TECHNIQUE", "VALIDE_CLIENT", "EN_DEVELOPPEMENT"]}
          title="Projets soumis"
          subtitle="Demandes à analyser, cahier des charges à produire, et passage en développement."
        />
      </div>
    );
  }

  return <ProjectList headerTabs={tabs} />;
}
