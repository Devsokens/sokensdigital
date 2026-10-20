"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ServiceProposal } from "@/lib/api/types";
import { getServiceProposal } from "@/lib/api/documents-service";
import { ServiceProposalEditor } from "@/components/admin/marketing/service-proposal-editor";

export function ServiceProposalEditPage({ id, basePath }: { id: string; basePath?: string }) {
  const [proposal, setProposal] = useState<ServiceProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getServiceProposal(id)
      .then((data) => {
        if (!data) setError("Offre de service introuvable.");
        else setProposal(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Erreur lors du chargement de l'offre de service.");
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  if (error || !proposal) {
    return <p className="p-8 text-sm text-destructive">{error || "Introuvable"}</p>;
  }

  return <ServiceProposalEditor proposal={proposal} basePath={basePath} />;
}
