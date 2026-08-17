"use client";

import { useState } from "react";
import { Loader2, Mail, Phone, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createLead } from "@/lib/api/public";
import type { SiteSettings } from "@/lib/api/types";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-primary/50";

export function ContactForm({ settings }: { settings: SiteSettings }) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await createLead({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        message,
        source: "FORMULAIRE_CONTACT",
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSending(false);
    }
  }

  const contactEmail = settings.social_links.find((s) => s.icon === "at-sign")?.url.replace("mailto:", "") || "contact@sokensdigital.com";

  if (sent) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-primary/40 bg-primary/[0.04] p-10 text-center">
          <CheckCircle2 className="size-10 text-primary" />
          <h3 className="text-lg font-semibold text-foreground">Message envoyé</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Merci pour votre message — notre équipe vous répondra dans les plus brefs délais.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
      <form onSubmit={handleSubmit} className="rounded-2xl border border-white/10 bg-card/60 p-6 sm:p-7">
        {error && (
          <p className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
            {error}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">Prénom</span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={`mt-2 ${inputClass}`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">Nom</span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={`mt-2 ${inputClass}`} />
          </label>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={`mt-2 ${inputClass}`} />
          </label>
          <label className="block">
            <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">Téléphone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`mt-2 ${inputClass}`} />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="text-xs font-semibold tracking-[0.1em] text-muted-foreground uppercase">Message</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} required className={`mt-2 ${inputClass}`} />
        </label>
        <Button type="submit" disabled={sending} className="mt-6 gap-1.5 rounded-full px-5">
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Envoyer le message
        </Button>
      </form>

      <aside className="space-y-4">
        <div className="rounded-2xl border border-white/10 bg-card/60 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="size-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Par email</h4>
              <a href={`mailto:${contactEmail}`} className="mt-1 block text-xs text-muted-foreground hover:text-primary">
                {contactEmail}
              </a>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-card/60 p-5">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Phone className="size-4" />
            </span>
            <div>
              <h4 className="text-sm font-semibold text-foreground">Assistance en direct</h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Utilisez la bulle de chat en bas de l&apos;écran pour parler directement avec notre équipe support.
              </p>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
