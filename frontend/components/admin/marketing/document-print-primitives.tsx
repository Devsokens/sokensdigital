"use client";

import type { CSSProperties } from "react";

/** Shared visual building blocks for every printable A4 document in the
 * admin (devis, cahier des charges...) — kept in one place so every
 * document type gets the exact same page shell/banner/contact block
 * instead of copy-pasted variants drifting apart. */

export const PAGE_BG = "#f2f3f5";

export const printColorAdjust = {
  WebkitPrintColorAdjust: "exact",
  printColorAdjust: "exact",
} as CSSProperties;

export function formatFCFA(value: string | number) {
  const n = typeof value === "string" ? Number(value) : value;
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(n))} FCFA`;
}

export function Paragraphs({ text, className }: { text: string; className?: string }) {
  const blocks = text.split(/\n{2,}/).filter(Boolean);
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map((block, i) => (
        <p key={i} className={className}>
          {block.split("\n").map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </>
  );
}

export function Banner({ accentColor }: { accentColor: string }) {
  return (
    <div
      className="flex items-center justify-between px-10 py-6"
      style={{ background: accentColor, ...printColorAdjust }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/assets/logo-sokens-digital-white.png" alt="Soken's Digital" className="h-10 w-auto" />
    </div>
  );
}

export function Page({ children, first }: { children: React.ReactNode; first?: boolean }) {
  return (
    <div
      className="mx-auto flex flex-col print:m-0"
      style={{
        width: "210mm",
        minHeight: "297mm",
        background: PAGE_BG,
        breakAfter: "page",
        marginTop: first ? 0 : "8mm",
        ...printColorAdjust,
      }}
    >
      {children}
    </div>
  );
}

export function ContactBlock({
  address,
  phone,
  email,
}: {
  address: string;
  phone?: string;
  email?: string;
}) {
  return (
    <div className="text-sm text-neutral-700">
      <p className="text-base font-bold text-neutral-900">SOKEN&apos;S DIGITAL</p>
      {address.split("\n").map((line, i) => (
        <p key={i}>{line}</p>
      ))}
      {phone && <p>Tél : {phone}</p>}
      {email && <p>Mail : {email}</p>}
    </div>
  );
}

/** Preset accent colors a document's owner can pick from — same swatch
 * convention as frontend/components/admin/rh/department-form-modal.tsx. */
export const DOCUMENT_COLOR_SWATCHES = [
  "#123f91", "#0f766e", "#7c2d12", "#5b21b6", "#991b1b", "#0e7490", "#166534", "#374151",
];
