"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CodeBlock({ filename, code }: { filename: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/40">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="font-mono text-xs font-medium tracking-wide text-primary uppercase">
          {filename}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copier le code"
          className="text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="size-3.5 text-primary" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-relaxed sm:text-sm">
        <code className="font-mono text-foreground/90">{code}</code>
      </pre>
    </div>
  );
}
