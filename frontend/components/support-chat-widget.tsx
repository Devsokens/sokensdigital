"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  createSupportTicket,
  getSupportTicket,
  replySupportTicket,
  type PublicTicket,
} from "@/lib/api/public";

const STORAGE_KEY = "sd-support-ticket";
const POLL_INTERVAL_MS = 5000;

interface StoredTicket {
  id: string;
  access_token: string;
}

function readStoredTicket(): StoredTicket | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredTicket) : null;
  } catch {
    return null;
  }
}

export function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const [stored, setStored] = useState<StoredTicket | null>(null);
  const [ticket, setTicket] = useState<PublicTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [prechatMessage, setPrechatMessage] = useState("");
  const [starting, setStarting] = useState(false);

  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setStored(readStoredTicket());
  }, []);

  useEffect(() => {
    if (!open || !stored) return;
    let cancelled = false;

    async function poll() {
      try {
        const data = await getSupportTicket(stored!.access_token);
        if (!cancelled) setTicket(data);
      } catch {
        // conversation gone / token invalid — leave last known state
      }
    }

    setLoading(true);
    poll().finally(() => setLoading(false));
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [open, stored]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [ticket?.messages.length]);

  async function handleStartChat(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setStarting(true);
    try {
      const created = await createSupportTicket({
        visitor_name: name,
        visitor_email: email,
        message: prechatMessage,
      });
      const next = { id: created.id, access_token: created.access_token };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setStored(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setStarting(false);
    }
  }

  async function handleSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!stored || !reply.trim()) return;
    setSending(true);
    setError(null);
    try {
      await replySupportTicket(stored.access_token, reply);
      setReply("");
      const data = await getSupportTicket(stored.access_token);
      setTicket(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed right-5 bottom-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex h-[28rem] w-80 flex-col overflow-hidden rounded-2xl border border-white/10 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <span className="text-sm font-semibold text-foreground">Support Soken&apos;s Digital</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="text-muted-foreground hover:text-foreground">
              <X className="size-4" />
            </button>
          </div>

          {!stored ? (
            <form onSubmit={handleStartChat} className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
              <p className="text-xs text-muted-foreground">
                Laissez-nous un message, notre équipe vous répond rapidement.
              </p>
              {error && <p className="text-xs text-destructive">{error}</p>}
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Votre nom"
                required
                className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Votre email"
                required
                className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              />
              <textarea
                value={prechatMessage}
                onChange={(e) => setPrechatMessage(e.target.value)}
                placeholder="Votre message"
                rows={3}
                required
                className="flex-1 resize-none rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
              />
              <button
                type="submit"
                disabled={starting}
                className="flex items-center justify-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              >
                {starting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
                Envoyer
              </button>
            </form>
          ) : (
            <>
              <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto p-4">
                {loading && !ticket && (
                  <div className="flex justify-center py-6">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                )}
                {ticket?.messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.sender_type === "VISITEUR" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed",
                        m.sender_type === "VISITEUR" ? "bg-primary text-primary-foreground" : "bg-white/[0.04] text-foreground"
                      )}
                    >
                      {m.body}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={handleSendReply} className="flex items-center gap-2 border-t border-white/10 p-3">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Votre message..."
                  className="flex-1 rounded-full border border-white/10 bg-white/[0.02] px-3.5 py-2 text-sm text-foreground outline-none focus:border-primary/50"
                />
                <button
                  type="submit"
                  disabled={sending || !reply.trim()}
                  aria-label="Envoyer"
                  className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-60"
                >
                  {sending ? <Loader2 className="size-3.5 animate-spin" /> : <Send className="size-3.5" />}
                </button>
              </form>
              {error && <p className="border-t border-white/10 px-4 py-2 text-xs text-destructive">{error}</p>}
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Fermer le chat" : "Ouvrir le chat"}
        className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X className="size-5" /> : <MessageCircle className="size-5" />}
      </button>
    </div>
  );
}
