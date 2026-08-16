"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getSpecification } from "@/lib/api/marketing";
import type { Specification } from "@/lib/api/types";
import { SpecificationEditor } from "@/components/admin/marketing/specification-editor";

export function SpecificationEditPage({ id }: { id: string }) {
  const [spec, setSpec] = useState<Specification | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSpecification(id)
      .then(setSpec)
      .catch(() => setError("Impossible de charger ce cahier des charges."));
  }, [id]);

  if (error) return <p className="p-8 text-sm text-destructive">{error}</p>;
  if (!spec) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return <SpecificationEditor spec={spec} />;
}
