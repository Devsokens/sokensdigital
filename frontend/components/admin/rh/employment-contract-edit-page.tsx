"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { EmploymentContractDocument } from "@/lib/api/types";
import { getEmploymentContract } from "@/lib/api/documents-service";
import { EmploymentContractEditor } from "@/components/admin/rh/employment-contract-editor";

export function EmploymentContractEditPage({ id, basePath }: { id: string; basePath?: string }) {
  const [contract, setContract] = useState<EmploymentContractDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getEmploymentContract(id)
      .then((data) => {
        if (!data) setError("Contrat de travail introuvable.");
        else setContract(data);
        setLoading(false);
      })
      .catch(() => {
        setError("Erreur lors du chargement du contrat de travail.");
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

  if (error || !contract) {
    return <p className="p-8 text-sm text-destructive">{error || "Introuvable"}</p>;
  }

  return <EmploymentContractEditor contract={contract} basePath={basePath} />;
}
