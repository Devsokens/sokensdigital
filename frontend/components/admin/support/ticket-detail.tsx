"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { cn } from "@/lib/utils";
import { getTicket, replyTicket, updateTicket } from "@/lib/api/support";
import { listUsers } from "@/lib/api/hr";
import type { SupportTicket, TicketStatus, UserBrief } from "@/lib/api/types";

const STATUS_LABELS: Record<TicketStatus, string> = {
  OUVERT: "Ouvert",
  EN_COURS: "En cours",
  FERME: "Fermé",
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function TicketDetail({ id }: { id: string }) {
  const [ticket, setTicket] = useState<SupportTicket | null>(null);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [updating, setUpdating] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const [ticketData, usersRes] = await Promise.all([
        getTicket(id),
        listUsers().catch(() => ({ results: [] as UserBrief[] })),
      ]);
      setTicket(ticketData);
      setUsers(usersRes.results);
    } catch {
      setError("Impossible de charger ce ticket.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [ticket?.messages.length]);

  async function handleReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await replyTicket(id, reply);
      setReply("");
      await load();
    } catch {
      setError("Impossible d'envoyer la réponse.");
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(status: TicketStatus) {
    setUpdating(true);
    try {
      const updated = await updateTicket(id, { status });
      setTicket(updated);
    } catch {
      setError("Impossible de mettre à jour le statut.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleAssign(userId: string) {
    setUpdating(true);
    try {
      const updated = await updateTicket(id, { assigned_to_id: userId || null });
      setTicket(updated);
    } catch {
      setError("Impossible de réassigner ce ticket.");
    } finally {
      setUpdating(false);
    }
  }

  if (error) return <p className="p-8 text-sm text-destructive">{error}</p>;
  if (!ticket) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/admin/support/tickets"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="size-3.5" /> Tickets
      </Link>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex h-[32rem] flex-col overflow-hidden rounded-xl border border-neutral-200 shadow-sm">
          <div className="border-b border-neutral-100 px-5 py-4">
            <h1 className="text-lg font-semibold text-neutral-900">{ticket.subject || "Conversation"}</h1>
            <p className="text-xs text-neutral-500">{ticket.visitor_name} — {ticket.visitor_email}</p>
          </div>

          <div ref={threadRef} className="flex-1 space-y-3 overflow-y-auto p-5">
            {ticket.messages.map((m) => (
              <div key={m.id} className={cn("flex", m.sender_type === "STAFF" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed",
                    m.sender_type === "STAFF" ? "bg-primary text-primary-foreground" : "bg-neutral-100 text-neutral-800"
                  )}
                >
                  {m.body}
                  <p className={cn("mt-1 text-[0.65rem]", m.sender_type === "STAFF" ? "text-primary-foreground/70" : "text-neutral-400")}>
                    {m.sender_type === "STAFF" ? m.author?.first_name ?? "Équipe" : ticket.visitor_name} · {formatDate(m.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleReply} className="flex items-center gap-2 border-t border-neutral-100 p-3">
            <input
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Répondre..."
              className={inputClass}
            />
            <Button type="submit" disabled={sending || !reply.trim()} className="shrink-0 gap-1.5 rounded-full px-4">
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-3.5" />}
              Envoyer
            </Button>
          </form>
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-neutral-200 p-4 shadow-sm">
            <span className={labelClass}>Statut</span>
            <select
              value={ticket.status}
              onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
              disabled={updating}
              className={`mt-1.5 ${inputClass}`}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4 shadow-sm">
            <span className={labelClass}>Assigné à</span>
            <select
              value={ticket.assigned_to?.id ?? ""}
              onChange={(e) => handleAssign(e.target.value)}
              disabled={updating}
              className={`mt-1.5 ${inputClass}`}
            >
              <option value="">Non assigné</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.first_name} {u.last_name}</option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-neutral-200 p-4 text-xs text-neutral-500 shadow-sm">
            Ouvert le {formatDate(ticket.created_at)}
          </div>
        </div>
      </div>
    </div>
  );
}
