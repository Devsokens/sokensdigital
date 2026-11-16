"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getServiceContract, type ServiceContract } from "@/lib/api/contracts";
import { ContractEditor } from "@/components/admin/contracts/contract-editor";

export function ContractEditPage({ id }: { id: string }) {
  const [contract, setContract] = useState<ServiceContract | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getServiceContract(id)
      .then(setContract)
      .catch(() => setError("Impossible de charger ce contrat."));
  }, [id]);

  if (error) return <p className="p-8 text-sm text-destructive">{error}</p>;
  if (!contract) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }
  return <ContractEditor key={contract.id} contract={contract} />;
}
