"use client";

import { Fragment, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { DocumentPreviewCards } from "@/components/admin/marketing/document-preview-cards";
import { printColorAdjust } from "@/components/admin/marketing/document-print-primitives";
import type { ContractDocumentSettings, ServiceContractFields } from "@/lib/api/contracts";
import { documentBlocks, documentTitle, type ContractBlock } from "@/components/admin/contracts/contract-blocks";

/* Aperçu du contrat, page par page, avec les mêmes mesures que le PDF
 * (backend/marketing/templates/marketing/contract_pdf.html) : marges, tailles,
 * bandeau facultatif, filigrane, pied de page. Le texte est découpé en pages
 * comme le fait WeasyPrint : blocs jamais coupés, titres gardés avec la suite,
 * annexes sur une nouvelle page. Modifier les deux ensemble. */

const PAGE_W = 793;
const PAGE_H = 1122;
const SIDE = 80;
const BOTTOM = 76;
const CONTENT_W = PAGE_W - 2 * SIDE;
const FONT = "'Times New Roman', 'Liberation Serif', Tinos, serif";

const topMargin = (header: boolean) => (header ? 124 : 76);
const HEADINGS = new Set(["title", "section", "article", "sub", "annex"]);
const KEEP_WITH_NEXT = new Set(["section", "article", "sub", "annex", "closing"]);

/** Marge au-dessus du bloc, selon le bloc précédent (règles CSS du PDF). */
function marginTop(block: ContractBlock, prev: ContractBlock | undefined) {
  switch (block.t) {
    case "title":
      return 0;
    case "section":
      return 22;
    case "article":
      return 16;
    case "sub":
      return 12;
    case "annex":
      return 18;
    case "li":
      return prev?.t === "p" ? 6 : 4;
    case "closing":
      return 22;
    case "signatures":
      return 30;
    case "schedule":
      return 10;
    default:
      return prev && HEADINGS.has(prev.t) ? 6 : 9;
  }
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/).map((part, i) => {
        const lines = part.split("\n").map((line, j, arr) => (
          <Fragment key={j}>
            {line}
            {j < arr.length - 1 && <br />}
          </Fragment>
        ));
        return i % 2 ? <strong key={i}>{lines}</strong> : <Fragment key={i}>{lines}</Fragment>;
      })}
    </>
  );
}

function Block({ block, accent, stampUrl, style }: { block: ContractBlock; accent: string; stampUrl: string; style?: CSSProperties }) {
  const base: CSSProperties = { textAlign: "justify", ...style };
  switch (block.t) {
    case "title":
      return (
        <p style={{ ...base, textAlign: "center", fontSize: 21, fontWeight: 700, textDecoration: "underline", color: accent }}>
          <Rich text={block.text} />
        </p>
      );
    case "section":
      return <p style={{ ...base, fontSize: 15.5, fontWeight: 700, color: accent }}><Rich text={block.text} /></p>;
    case "article":
    case "annex":
      return <p style={{ ...base, fontSize: 15, fontWeight: 700, color: accent }}><Rich text={block.text} /></p>;
    case "sub":
      return <p style={{ ...base, fontWeight: 700 }}><Rich text={block.text} /></p>;
    case "li":
      return (
        <p style={{ ...base, position: "relative", paddingLeft: 34 }}>
          <span style={{ position: "absolute", left: 16, top: 0 }}>•</span>
          <Rich text={block.text} />
        </p>
      );
    case "closing":
      return (
        <p style={{ ...base, paddingTop: 10, borderTop: "1px solid #555" }}>
          <Rich text={block.text} />
        </p>
      );
    case "signatures":
      return (
        <div style={{ ...style, display: "grid", gridTemplateColumns: "1fr 1fr", fontSize: 14 }}>
          {[
            { who: block.left_label, name: block.client, stamp: "" },
            { who: block.right_label, name: block.provider, stamp: stampUrl },
          ].map((side) => (
            <div key={side.who} style={{ paddingRight: 16 }}>
              <p style={{ fontWeight: 700 }}>{side.who}</p>
              <p>Nom et qualité&nbsp;: {side.name}</p>
              <p>Signature précédée de la mention «&nbsp;Lu et approuvé&nbsp;»&nbsp;:</p>
              {side.stamp ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={side.stamp} alt="Cachet Soken's Digital" style={{ maxHeight: 92, maxWidth: 200, marginTop: 6 }} />
              ) : (
                <div style={{ height: 96 }} />
              )}
            </div>
          ))}
        </div>
      );
    case "schedule":
      return (
        <table style={{ ...style, width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
          <thead>
            <tr style={{ background: accent, color: "#fff", ...printColorAdjust }}>
              <th style={{ padding: "6px 10px", textAlign: "left", fontWeight: 400 }}>Échéance</th>
              <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 400 }}>Part</th>
              <th style={{ padding: "6px 10px", textAlign: "right", fontWeight: 400 }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i} style={{ borderBottom: "1px solid #bbb", background: "rgba(255,255,255,.6)" }}>
                <td style={{ padding: "6px 10px" }}>{row.label}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap" }}>{row.percentage}</td>
                <td style={{ padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap" }}>{row.amount}</td>
              </tr>
            ))}
            <tr style={{ fontWeight: 700, borderBottom: `2px solid ${accent}` }}>
              <td style={{ padding: "6px 10px" }}>Total</td>
              <td style={{ padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap" }}>{block.total_percentage}</td>
              <td style={{ padding: "6px 10px", textAlign: "right", whiteSpace: "nowrap" }}>{block.total}</td>
            </tr>
          </tbody>
        </table>
      );
    default:
      return <p style={base}><Rich text={block.text} /></p>;
  }
}

/** Répartit les blocs en pages, à partir de leurs hauteurs mesurées. */
function paginate(blocks: ContractBlock[], heights: number[], header: boolean) {
  const available = PAGE_H - topMargin(header) - BOTTOM;
  const pages: number[][] = [[]];
  let used = 0;

  blocks.forEach((block, i) => {
    let page = pages[pages.length - 1];
    const forced = block.t === "annex" && block.break && page.length > 0;
    let needed = (page.length ? marginTop(block, blocks[i - 1]) : 0) + heights[i];
    // Titre (ou « Fait à… ») gardé avec le bloc qui le suit.
    if (KEEP_WITH_NEXT.has(block.t) && i + 1 < blocks.length) {
      needed += marginTop(blocks[i + 1], block) + heights[i + 1];
    }
    if (forced || (page.length > 0 && used + needed > available)) {
      pages.push([]);
      page = pages[pages.length - 1];
      used = 0;
    }
    used += (page.length ? marginTop(block, blocks[i - 1]) : 0) + heights[i];
    page.push(i);
  });
  return pages;
}

function ContractPage({
  index,
  total,
  blocks,
  indexes,
  accent,
  header,
  watermark,
  stampUrl,
  title,
}: {
  title: string;
  index: number;
  total: number;
  blocks: ContractBlock[];
  indexes: number[];
  accent: string;
  header: boolean;
  watermark: { src: string; opacity: number } | null;
  stampUrl: string;
}) {
  const top = topMargin(header);
  return (
    <div
      className="admin-paper relative overflow-hidden text-black"
      style={{ width: PAGE_W, height: PAGE_H, background: "#fff", fontFamily: FONT, fontSize: 14.5, lineHeight: 1.36, ...printColorAdjust }}
      aria-label={`Page ${index + 1} sur ${total}`}
    >
      {header && (
        <div className="absolute inset-x-0 top-0" style={{ height: 84, padding: `22px ${SIDE}px`, background: accent, ...printColorAdjust }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/logo-sokens-digital-white.png" alt="Soken's Digital" style={{ height: 40, width: "auto" }} />
        </div>
      )}
      {watermark && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={watermark.src}
          alt=""
          className="pointer-events-none absolute"
          style={{ top: top + 150, left: (PAGE_W - 560) / 2, width: 560, maxHeight: 620, objectFit: "contain", opacity: watermark.opacity }}
        />
      )}
      <div className="absolute" style={{ top, left: SIDE, width: CONTENT_W }}>
        {indexes.map((i, pos) => (
          <Block
            key={i}
            block={blocks[i]}
            accent={accent}
            stampUrl={stampUrl}
            style={{ marginTop: pos === 0 ? 0 : marginTop(blocks[i], blocks[i - 1]) }}
          />
        ))}
      </div>
      <p
        className="absolute inset-x-0 text-center"
        style={{ top: PAGE_H - BOTTOM + 26, fontFamily: "Calibri, Carlito, Arial, sans-serif", fontSize: 10.5, color: "#7f7f7f" }}
      >
        {title} – Page {index + 1}
      </p>
    </div>
  );
}

export function ContractPreview({
  contract,
  settings,
  maxScale,
  zoomable = true,
}: {
  contract: ServiceContractFields;
  settings: ContractDocumentSettings;
  maxScale?: number;
  zoomable?: boolean;
}) {
  const blocks = useMemo(() => documentBlocks(contract, settings), [contract, settings]);
  const accent = contract.document_color || "#1f3864";
  const header = contract.show_header;
  const stampUrl = settings.apply_stamp ? settings.company_stamp_url : "";
  const watermark =
    settings.watermark === "BALANCE"
      ? { src: "/assets/contract-balance.svg", opacity: 1 }
      : settings.watermark === "IMAGE" && settings.watermark_url
        ? { src: settings.watermark_url, opacity: Math.min(Math.max(settings.watermark_opacity || 15, 1), 100) / 100 }
        : null;

  const measureRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState<number[][]>([blocks.map((_, i) => i)]);
  const [fontsReady, setFontsReady] = useState(0);

  useLayoutEffect(() => {
    document.fonts?.ready.then(() => setFontsReady((n) => n + 1));
  }, []);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return;
    const heights = Array.from(root.children).map((el) => (el as HTMLElement).getBoundingClientRect().height);
    if (heights.length !== blocks.length) return;
    setPages(paginate(blocks, heights, header));
  }, [blocks, header, stampUrl, fontsReady]);

  const renderPage = (index: number): ReactNode => (
    <ContractPage
      index={index}
      total={pages.length}
      blocks={blocks}
      indexes={pages[index] ?? []}
      accent={accent}
      header={header}
      watermark={watermark}
      stampUrl={stampUrl}
      title={documentTitle(contract.contract_type)}
    />
  );

  return (
    <>
      {/* Mesure des blocs, hors écran, à la largeur réelle du texte. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none fixed top-0 -left-[10000px] invisible"
        style={{ width: CONTENT_W, fontFamily: FONT, fontSize: 14.5, lineHeight: 1.36 }}
      >
        {blocks.map((block, i) => (
          <Block key={i} block={block} accent={accent} stampUrl={stampUrl} style={{ marginTop: 0 }} />
        ))}
      </div>
      <DocumentPreviewCards pageCount={pages.length} renderPage={renderPage} maxScale={maxScale} zoomable={zoomable} />
    </>
  );
}
