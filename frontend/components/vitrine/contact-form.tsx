"use client";

import { useState } from "react";
import { createLead } from "@/lib/api/public";
import { frenchSpacing, str, type Section } from "./cms";
import { AddItem, Editable, ItemTools, useEditor } from "./editable";
import { ArrowIcon, FONT_DISPLAY } from "./ui";

const LABEL_STYLE = { flex: "1 1 200px", minWidth: "0", display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", fontWeight: 500, color: "oklch(var(--sd-fg-2))" } as const;
const INPUT_STYLE = { width: "100%", height: "48px", padding: "0 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "oklch(var(--sd-panel))", color: "oklch(var(--sd-fg))", fontFamily: "inherit", fontSize: "15px" } as const;

/** Formulaire « Démarrer un projet » de la page Contact. Crée une demande
 * (lead) côté CRM, comme l'ancien formulaire de contact ; le besoin choisi
 * est ajouté en tête du message, le CRM n'ayant pas de champ dédié. */
export function ContactForm({ section }: { section: Section }) {
  const needs = section.items.map((item) => str(item, "label"));
  const editor = useEditor();
  const [picked, setNeed] = useState<string | null>(null);
  const need = picked ?? needs[0] ?? "";
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    // Dans l'éditeur de l'admin, le formulaire n'envoie rien.
    if (editor) return;
    const data = new FormData(e.currentTarget);
    const message = String(data.get("message") ?? "").trim();
    setError(null);
    setSending(true);
    try {
      await createLead({
        first_name: String(data.get("prenom") ?? "").trim(),
        last_name: String(data.get("nom") ?? "").trim(),
        email: String(data.get("email") ?? "").trim(),
        phone: String(data.get("telephone") ?? "").trim(),
        message: need ? (message ? `Besoin : ${need}\n\n${message}` : `Besoin : ${need}`) : message,
        source: "FORMULAIRE_CONTACT",
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="sd-beam" style={{ gridArea: "form", minWidth: "0", borderRadius: "26px", border: "1px solid rgba(255,255,255,0.08)", background: "oklch(0.143 0.014 240 / 0.88)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)", padding: "clamp(24px, 3.5vw, 40px)", boxShadow: "0 40px 100px -40px rgba(0,0,0,0.85)" }}>
      {!sent && (
        <form onSubmit={handleSubmit} aria-label="Formulaire de contact" style={{ margin: "0", display: "flex", flexDirection: "column", gap: "20px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <h2 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "26px", lineHeight: 1.2, letterSpacing: "-0.02em" }}>
              <Editable section={section} path={{ scope: "field", field: "title" }} value={section.title}>
                {frenchSpacing(section.title)}
              </Editable>
            </h2>
            <p style={{ margin: "0", fontSize: "14.5px", color: "oklch(0.668 0.014 240)" }}>
              <Editable section={section} path={{ scope: "field", field: "subtitle" }} kind="textarea" value={section.subtitle}>
                {frenchSpacing(section.subtitle)}
              </Editable>
            </p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <label style={LABEL_STYLE}>
              Prénom
              <input className="sd-field" type="text" name="prenom" autoComplete="given-name" required style={INPUT_STYLE} />
            </label>
            <label style={LABEL_STYLE}>
              Nom
              <input className="sd-field" type="text" name="nom" autoComplete="family-name" required style={INPUT_STYLE} />
            </label>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
            <label style={LABEL_STYLE}>
              Email
              <input className="sd-field" type="email" name="email" autoComplete="email" placeholder="vous@entreprise.com" required style={INPUT_STYLE} />
            </label>
            <label style={LABEL_STYLE}>
              Téléphone
              <input className="sd-field" type="tel" name="telephone" autoComplete="tel" placeholder="0X XX XX XX" style={INPUT_STYLE} />
            </label>
          </div>
          <fieldset style={{ margin: "0", padding: "0", border: "0", minWidth: "0" }}>
            <legend style={{ padding: "0", marginBottom: "10px", fontSize: "14px", fontWeight: 500, color: "oklch(var(--sd-fg-2))" }}>Votre besoin</legend>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {needs.map((label, i) => {
                const on = label === need;
                return (
                  <span key={i} style={{ position: "relative", display: "inline-flex" }}>
                  <ItemTools section={section} index={i} />
                  <button className="sd-chip" type="button" aria-pressed={on} onClick={() => setNeed(label)} style={{ height: "40px", padding: "0 16px", borderRadius: "999px", border: `1px solid ${on ? "oklch(var(--sd-primary))" : "rgba(255,255,255,0.12)"}`, background: on ? "oklch(var(--sd-primary) / 0.14)" : "transparent", color: on ? "oklch(var(--sd-fg))" : "oklch(var(--sd-fg-3))", fontFamily: "inherit", fontSize: "14px", fontWeight: 500, cursor: "pointer" }}>
                    <Editable section={section} path={{ scope: "item", index: i, key: "label" }} value={label}>
                      {label}
                    </Editable>
                  </button>
                  </span>
                );
              })}
              <AddItem section={section} template={{ label: "Nouveau besoin" }} label="Ajouter un choix" style={{ minHeight: "40px", borderRadius: "999px" }} />
            </div>
          </fieldset>
          <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "14px", fontWeight: 500, color: "oklch(var(--sd-fg-2))" }}>
            Message
            <textarea className="sd-field" name="message" rows={4} placeholder="Parlez-nous de votre projet, de vos objectifs et de vos délais." style={{ width: "100%", minHeight: "120px", padding: "12px 14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "oklch(var(--sd-panel))", color: "oklch(var(--sd-fg))", fontFamily: "inherit", fontSize: "15px", lineHeight: 1.55, resize: "vertical" }} />
          </label>
          {error && (
            <p role="alert" style={{ margin: "0", padding: "10px 14px", borderRadius: "10px", border: "1px solid rgba(244,63,94,0.3)", background: "rgba(244,63,94,0.1)", fontSize: "14px", color: "#FDA4AF" }}>{error}</p>
          )}
          <button className="sd-shimmer sd-arrow-link" type="submit" disabled={sending} style={{ height: "56px", border: "0", borderRadius: "12px", background: "oklch(var(--sd-primary))", color: "oklch(var(--sd-on-primary))", fontFamily: "inherit", fontSize: "16px", fontWeight: 600, cursor: sending ? "wait" : "pointer", opacity: sending ? 0.75 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            {sending ? (
              "Envoi en cours…"
            ) : (
              <Editable section={section} path={{ scope: "field", field: "cta" }} value={section.ctaLabel}>
                {section.ctaLabel}
              </Editable>
            )}
            <ArrowIcon size={18} />
          </button>
          <p style={{ margin: "0", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "13px", color: "oklch(0.668 0.014 240)" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Vos informations restent confidentielles.
          </p>
        </form>
      )}
      {sent && (
        <div role="status" style={{ minHeight: "560px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "18px", padding: "24px 8px" }}>
          <span className="sd-pop" style={{ width: "72px", height: "72px", borderRadius: "50%", background: "rgba(61,214,140,0.12)", color: "#3DD68C", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 0 12px rgba(61,214,140,0.05)" }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          </span>
          <h2 style={{ margin: "0", fontFamily: FONT_DISPLAY, fontWeight: 600, fontSize: "28px", lineHeight: 1.2, letterSpacing: "-0.02em" }}>Message envoyé&nbsp;!</h2>
          <p style={{ margin: "0", maxWidth: "360px", fontSize: "15.5px", color: "oklch(var(--sd-fg-3))" }}>Merci pour votre confiance. Nous revenons vers vous très rapidement.</p>
          <button className="sd-ghost" type="button" onClick={() => setSent(false)} style={{ marginTop: "6px", height: "46px", padding: "0 20px", borderRadius: "11px", border: "1px solid rgba(255,255,255,0.14)", background: "transparent", color: "oklch(var(--sd-fg-2))", fontFamily: "inherit", fontSize: "15px", fontWeight: 500, cursor: "pointer" }}>Envoyer un autre message</button>
        </div>
      )}
    </div>
  );
}
