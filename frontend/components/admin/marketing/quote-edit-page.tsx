"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { getQuote } from "@/lib/api/marketing";
import type { Quote } from "@/lib/api/types";
import { QuoteEditor } from "@/components/admin/marketing/quote-editor";

export function QuoteEditPage({ id }: { id: string }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getQuote(id)
      .then(setQuote)
      .catch(() => setError("Impossible de charger ce devis."));
  }, [id]);

  if (error) return <p className="p-8 text-sm text-destructive">{error}</p>;
  if (!quote) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return <QuoteEditor quote={quote} />;
}
