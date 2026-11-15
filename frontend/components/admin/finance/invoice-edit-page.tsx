"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getInvoice } from "@/lib/api/finance";
import type { Invoice } from "@/lib/api/types";
import { InvoiceEditor } from "@/components/admin/finance/invoice-editor";

export function InvoiceEditPage({ id }: { id: string }) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getInvoice(id)
      .then(setInvoice)
      .catch(() => setError("Impossible de charger cette facture."));
  }, [id]);

  if (error) return <p className="p-8 text-sm text-destructive">{error}</p>;
  if (!invoice) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }
  return <InvoiceEditor invoice={invoice} />;
}
