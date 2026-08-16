"use client";

import { useEffect, useState } from "react";
import { Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getQuote, getQuoteSettings } from "@/lib/api/marketing";
import type { Quote, QuoteSettings } from "@/lib/api/types";
import { QuoteDocumentPages } from "@/components/admin/marketing/quote-document-pages";

export function QuotePrintView({ id, hideToolbar }: { id: string; hideToolbar?: boolean }) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [settings, setSettings] = useState<QuoteSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getQuote(id), getQuoteSettings()])
      .then(([q, s]) => {
        setQuote(q);
        setSettings(s);
      })
      .catch(() => setError("Impossible de charger ce devis."));
  }, [id]);

  if (error) return <p className="p-8 text-sm text-destructive">{error}</p>;
  if (!quote || !settings) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div style={{ background: "#dfe1e6" }}>
      {!hideToolbar && (
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-3 print:hidden">
          <p className="text-sm text-neutral-500">
            Aperçu du devis <span className="font-medium text-neutral-900">{quote.quote_number}</span>
          </p>
          <Button onClick={() => window.print()} className="gap-1.5 rounded-full px-4">
            <Printer className="size-4" /> Imprimer / Télécharger en PDF
          </Button>
        </div>
      )}

      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          html, body { background: #fff !important; }
        }
      `}</style>

      <div className="py-8 print:py-0">
        <QuoteDocumentPages quote={quote} settings={settings} accentColor={quote.document_color} />
      </div>
    </div>
  );
}
