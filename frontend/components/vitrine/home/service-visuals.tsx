import { FONT_MONO } from "../ui";

/* Visuels animés du bloc « Nos services » de l'accueil, un par service.
 * Chacun est remonté à chaque changement de service : les animations
 * d'apparition (sd-vin, sd-bld) rejouent. */

/** Lignes de code de l'audit : largeur, et pastille d'anomalie sur certaines. */
const CODE_LINES = ["62%", "48%", "74%", "36%", "58%", "68%", "42%", "54%", "30%"].map((width, i) => ({
  width,
  color: i % 3 === 0 ? "oklch(var(--sd-line-hi))" : "oklch(var(--sd-line))",
  flagged: [1, 4, 6].includes(i),
  delay: `${((i / 9) * 3).toFixed(2)}s`,
}));

export function WebVisual() {
  return (
    <div className="sd-vin" style={{ position: "relative", width: "100%", maxWidth: "540px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)", background: "oklch(var(--sd-panel))", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.85)" }}>
      <div style={{ height: "34px", display: "flex", alignItems: "center", gap: "6px", padding: "0 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "oklch(var(--sd-line))" }} />
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "oklch(var(--sd-line))" }} />
        <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "oklch(var(--sd-line))" }} />
        <span style={{ marginLeft: "12px", padding: "2px 12px", borderRadius: "6px", background: "rgba(255,255,255,0.05)", fontFamily: FONT_MONO, fontSize: "11px", color: "oklch(var(--sd-fg-4))" }}>www.votre-entreprise.com</span>
      </div>
      <div style={{ padding: "22px", display: "flex", flexDirection: "column", gap: "18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span className="sd-bld" style={{ width: "26px", height: "26px", borderRadius: "8px", background: "linear-gradient(135deg, oklch(var(--sd-primary)), oklch(var(--sd-accent)))" }} />
          <span style={{ display: "flex", gap: "12px" }}>
            <span className="sd-bld" style={{ width: "40px", height: "6px", borderRadius: "3px", background: "oklch(var(--sd-line))", animationDelay: "0.1s" }} />
            <span className="sd-bld" style={{ width: "40px", height: "6px", borderRadius: "3px", background: "oklch(var(--sd-line))", animationDelay: "0.15s" }} />
            <span className="sd-bld" style={{ width: "40px", height: "6px", borderRadius: "3px", background: "oklch(var(--sd-line))", animationDelay: "0.2s" }} />
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "8px 0" }}>
          <span className="sd-bld" style={{ width: "78%", height: "16px", borderRadius: "5px", background: "oklch(var(--sd-ink))", animationDelay: "0.25s" }} />
          <span className="sd-bld" style={{ width: "56%", height: "16px", borderRadius: "5px", background: "oklch(var(--sd-ink))", animationDelay: "0.35s" }} />
          <span className="sd-bld" style={{ width: "64%", height: "7px", marginTop: "6px", borderRadius: "4px", background: "oklch(var(--sd-line))", animationDelay: "0.45s" }} />
        </div>
        <span style={{ position: "relative", alignSelf: "flex-start" }}>
          <span className="sd-bld" style={{ display: "inline-flex", padding: "9px 16px", borderRadius: "9px", background: "oklch(var(--sd-primary))", color: "oklch(var(--sd-on-primary))", fontSize: "12px", fontWeight: 600, animationDelay: "0.55s" }}>Prendre rendez-vous</span>
          <span className="sd-ripple" style={{ position: "absolute", left: "50%", top: "50%", width: "40px", height: "40px", margin: "-20px 0 0 -20px", borderRadius: "50%", background: "rgba(255,255,255,0.5)" }} />
          <svg className="sd-cursor" width="22" height="22" viewBox="0 0 24 24" style={{ position: "absolute", left: "58%", top: "55%" }}>
            <path d="M5 3l14 7-6 2-2 6z" fill="#FFFFFF" stroke="oklch(var(--sd-bg))" strokeWidth="1.2" strokeLinejoin="round" />
          </svg>
        </span>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px", marginTop: "6px" }}>
          <span className="sd-bld" style={{ height: "74px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", animationDelay: "0.65s" }} />
          <span className="sd-bld" style={{ height: "74px", borderRadius: "10px", background: "oklch(var(--sd-primary) / 0.1)", border: "1px solid oklch(var(--sd-primary) / 0.3)", animationDelay: "0.75s" }} />
          <span className="sd-bld" style={{ height: "74px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", animationDelay: "0.85s" }} />
        </div>
      </div>
    </div>
  );
}

export function MobileVisual() {
  return (
    <div className="sd-vin" style={{ position: "relative", width: "100%", maxWidth: "520px", height: "430px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "absolute", width: "190px", height: "380px", borderRadius: "32px", border: "1px solid rgba(255,255,255,0.1)", background: "oklch(var(--sd-panel))", transform: "translateX(-110px) rotate(-9deg)", opacity: 0.55, padding: "18px 14px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <span style={{ width: "60%", height: "10px", borderRadius: "4px", background: "oklch(var(--sd-line))" }} />
        <span style={{ height: "80px", borderRadius: "14px", background: "oklch(var(--sd-accent-hi) / 0.14)" }} />
        <span style={{ height: "40px", borderRadius: "10px", background: "rgba(255,255,255,0.04)" }} />
        <span style={{ height: "40px", borderRadius: "10px", background: "rgba(255,255,255,0.04)" }} />
      </div>
      <div style={{ position: "relative", width: "210px", height: "420px", borderRadius: "36px", border: "1px solid rgba(255,255,255,0.16)", background: "oklch(var(--sd-panel))", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.9)", padding: "14px", overflow: "hidden" }}>
        <span style={{ display: "block", width: "70px", height: "20px", margin: "0 auto 16px", borderRadius: "999px", background: "oklch(0.063 0.007 240)" }} />
        <div className="sd-notif" style={{ position: "absolute", left: "10px", right: "10px", top: "42px", zIndex: 2, padding: "10px 12px", borderRadius: "16px", background: "oklch(0.200 0.018 240 / 0.96)", border: "1px solid rgba(255,255,255,0.12)", display: "flex", alignItems: "center", gap: "10px", boxShadow: "0 14px 30px -10px rgba(0,0,0,0.7)" }}>
          <span style={{ width: "28px", height: "28px", flex: "none", borderRadius: "8px", background: "linear-gradient(135deg, oklch(var(--sd-primary)), oklch(var(--sd-accent)))", display: "flex", alignItems: "center", justifyContent: "center", color: "oklch(var(--sd-on-mark))" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8" />
              <path d="M10 20a2 2 0 0 0 4 0" />
            </svg>
          </span>
          <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "oklch(var(--sd-fg))" }}>Nouvelle commande</span>
            <span style={{ fontSize: "10px", color: "oklch(var(--sd-fg-3))" }}>À l&apos;instant</span>
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", paddingTop: "6px" }}>
          <span style={{ width: "50%", height: "9px", borderRadius: "4px", background: "oklch(var(--sd-line))" }} />
          <span style={{ width: "72%", height: "14px", borderRadius: "5px", background: "oklch(var(--sd-ink))" }} />
          <div style={{ height: "100px", borderRadius: "18px", background: "linear-gradient(135deg, oklch(var(--sd-primary) / 0.5), oklch(var(--sd-accent) / 0.4))", padding: "14px", display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: "6px" }}>
            <span style={{ width: "50%", height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.7)" }} />
            <span style={{ width: "30%", height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.45)" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
            <span style={{ width: "30px", height: "30px", borderRadius: "9px", background: "oklch(var(--sd-teal) / 0.2)" }} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ width: "70%", height: "6px", borderRadius: "3px", background: "oklch(var(--sd-line-hi))" }} />
              <span style={{ width: "45%", height: "6px", borderRadius: "3px", background: "oklch(var(--sd-line))" }} />
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px", borderRadius: "12px", background: "rgba(255,255,255,0.04)" }}>
            <span style={{ width: "30px", height: "30px", borderRadius: "9px", background: "oklch(var(--sd-accent-hi) / 0.2)" }} />
            <span style={{ flex: 1, display: "flex", flexDirection: "column", gap: "5px" }}>
              <span style={{ width: "60%", height: "6px", borderRadius: "3px", background: "oklch(var(--sd-line-hi))" }} />
              <span style={{ width: "40%", height: "6px", borderRadius: "3px", background: "oklch(var(--sd-line))" }} />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SoftwareVisual() {
  return (
    <div className="sd-vin" style={{ position: "relative", width: "100%", maxWidth: "560px" }}>
      <div style={{ borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)", background: "oklch(var(--sd-panel))", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.85)", overflow: "hidden" }}>
        <div style={{ height: "34px", display: "flex", alignItems: "center", gap: "10px", padding: "0 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "oklch(var(--sd-line))" }} />
          <span style={{ fontSize: "11.5px", color: "oklch(var(--sd-fg-3))" }}>Tableau de bord</span>
        </div>
        <div style={{ display: "flex" }}>
          <div style={{ width: "50px", flex: "none", borderRight: "1px solid rgba(255,255,255,0.06)", padding: "14px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
            <span style={{ width: "24px", height: "24px", borderRadius: "7px", background: "oklch(var(--sd-primary) / 0.2)" }} />
            <span style={{ width: "24px", height: "24px", borderRadius: "7px", background: "rgba(255,255,255,0.05)" }} />
            <span style={{ width: "24px", height: "24px", borderRadius: "7px", background: "rgba(255,255,255,0.05)" }} />
            <span style={{ width: "24px", height: "24px", borderRadius: "7px", background: "rgba(255,255,255,0.05)" }} />
          </div>
          <div style={{ flex: 1, minWidth: "0", padding: "18px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "10px" }}>
              <span className="sd-bld" style={{ height: "56px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }} />
              <span className="sd-bld" style={{ height: "56px", borderRadius: "10px", background: "oklch(var(--sd-primary) / 0.1)", border: "1px solid oklch(var(--sd-primary) / 0.28)", animationDelay: "0.1s" }} />
              <span className="sd-bld" style={{ height: "56px", borderRadius: "10px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", animationDelay: "0.2s" }} />
            </div>
            <div style={{ height: "130px", padding: "14px", borderRadius: "12px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "flex-end", gap: "8px" }}>
              <span className="sd-grow" style={{ flex: 1, height: "45%", borderRadius: "4px 4px 0 0", background: "linear-gradient(180deg, oklch(var(--sd-primary)), oklch(var(--sd-primary) / 0.2))" }} />
              <span className="sd-grow" style={{ flex: 1, height: "70%", borderRadius: "4px 4px 0 0", background: "linear-gradient(180deg, oklch(var(--sd-primary)), oklch(var(--sd-primary) / 0.2))", animationDelay: "0.2s" }} />
              <span className="sd-grow" style={{ flex: 1, height: "55%", borderRadius: "4px 4px 0 0", background: "linear-gradient(180deg, oklch(var(--sd-primary)), oklch(var(--sd-primary) / 0.2))", animationDelay: "0.4s" }} />
              <span className="sd-grow" style={{ flex: 1, height: "85%", borderRadius: "4px 4px 0 0", background: "linear-gradient(180deg, oklch(var(--sd-accent-hi)), oklch(var(--sd-accent-hi) / 0.2))", animationDelay: "0.6s" }} />
              <span className="sd-grow" style={{ flex: 1, height: "65%", borderRadius: "4px 4px 0 0", background: "linear-gradient(180deg, oklch(var(--sd-primary)), oklch(var(--sd-primary) / 0.2))", animationDelay: "0.8s" }} />
              <span className="sd-grow" style={{ flex: 1, height: "95%", borderRadius: "4px 4px 0 0", background: "linear-gradient(180deg, oklch(var(--sd-teal)), oklch(var(--sd-teal) / 0.2))", animationDelay: "1s" }} />
              <span className="sd-grow" style={{ flex: 1, height: "75%", borderRadius: "4px 4px 0 0", background: "linear-gradient(180deg, oklch(var(--sd-primary)), oklch(var(--sd-primary) / 0.2))", animationDelay: "1.2s" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="sd-bld" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "9px", background: "rgba(255,255,255,0.03)", animationDelay: "0.3s" }}>
                <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "rgba(61,214,140,0.2)", color: "#3DD68C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span style={{ flex: 1, height: "6px", borderRadius: "3px", background: "oklch(var(--sd-line))" }} />
              </div>
              <div className="sd-bld" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "9px 10px", borderRadius: "9px", background: "rgba(255,255,255,0.03)", animationDelay: "0.4s" }}>
                <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "rgba(61,214,140,0.2)", color: "#3DD68C", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 7.5" />
                  </svg>
                </span>
                <span style={{ flex: 1, height: "6px", borderRadius: "3px", background: "oklch(var(--sd-line))" }} />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="sd-float" style={{ position: "absolute", right: "-10px", top: "-18px", padding: "10px 14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.14)", background: "oklch(0.161 0.015 240 / 0.95)", boxShadow: "0 20px 40px -14px rgba(0,0,0,0.7)", display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px", color: "oklch(var(--sd-fg))" }}>
        <span style={{ width: "24px", height: "24px", borderRadius: "7px", background: "oklch(var(--sd-primary) / 0.16)", color: "oklch(var(--sd-primary-hi))", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 3 8l9 5 9-5z" />
            <path d="M3 13l9 5 9-5" />
          </svg>
        </span>
        Tout au même endroit
      </div>
    </div>
  );
}

export function AuditVisual() {
  return (
    <div className="sd-vin" style={{ position: "relative", width: "100%", maxWidth: "540px" }}>
      <div style={{ position: "relative", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.12)", background: "oklch(var(--sd-panel-deep))", boxShadow: "0 40px 80px -30px rgba(0,0,0,0.85)", overflow: "hidden" }}>
        <div style={{ height: "34px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 14px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <span style={{ fontSize: "11.5px", color: "oklch(var(--sd-fg-3))" }}>Analyse de votre application</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "oklch(var(--sd-primary-hi))" }}>
            <span className="sd-pulse" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "oklch(var(--sd-primary))" }} />
            En cours
          </span>
        </div>
        <div style={{ position: "relative", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "11px" }}>
          {CODE_LINES.map((line, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ width: "18px", fontFamily: FONT_MONO, fontSize: "10.5px", color: "oklch(0.455 0.018 240)", textAlign: "right" }}>{i + 1}</span>
              <span style={{ height: "7px", borderRadius: "4px", background: line.color, width: line.width }} />
              <span style={{ marginLeft: "auto", width: "8px", height: "8px", borderRadius: "50%", opacity: line.flagged ? 1 : 0, animationDelay: line.delay }} className="sd-mk" />
            </div>
          ))}
          <span className="sd-scanv" style={{ position: "absolute", left: "0", right: "0", height: "26px", marginTop: "-13px", background: "linear-gradient(180deg, transparent, oklch(var(--sd-primary) / 0.18), transparent)", borderBottom: "1px solid oklch(var(--sd-primary) / 0.6)" }} />
        </div>
      </div>
      <div className="sd-float" style={{ position: "absolute", left: "-12px", bottom: "-20px", padding: "10px 14px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.14)", background: "oklch(0.161 0.015 240 / 0.95)", boxShadow: "0 20px 40px -14px rgba(0,0,0,0.7)", display: "flex", alignItems: "center", gap: "10px", fontSize: "12.5px", color: "oklch(var(--sd-fg))" }}>
        <span style={{ width: "24px", height: "24px", borderRadius: "7px", background: "rgba(61,214,140,0.16)", color: "#3DD68C", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
          </svg>
        </span>
        Diagnostic et plan d&apos;action
      </div>
    </div>
  );
}
