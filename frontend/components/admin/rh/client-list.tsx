"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, List as ListIcon, Loader2, MoreHorizontal, Search, Star } from "lucide-react";
import { listClients, archiveClient } from "@/lib/api/administration";
import { listUsers } from "@/lib/api/hr";
import type { Client, ClientStatus, UserBrief } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";
import { ClientFormModal } from "@/components/admin/rh/client-form-modal";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { usePermissions } from "@/lib/admin/permissions-context";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ClientStatus, string> = {
  CLIENT_ACTIF: "Client actif",
  CLIENT_INACTIF: "Client inactif",
};

const STATUS_COLORS: Record<ClientStatus, string> = {
  CLIENT_ACTIF: "bg-primary/10 text-primary",
  CLIENT_INACTIF: "bg-neutral-100 text-neutral-500",
};

const TABS: { value: ClientStatus | "tous"; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "CLIENT_ACTIF", label: "Actifs" },
  { value: "CLIENT_INACTIF", label: "Inactifs" },
];

function Rating({ value }: { value: number | null }) {
  if (!value) return <span className="text-xs text-neutral-300">—</span>;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={cn("size-3", i < value ? "fill-amber-400 text-amber-400" : "text-neutral-200")} />
      ))}
    </span>
  );
}

export function ClientList() {
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [clients, setClients] = useState<Client[] | null>(null);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<ClientStatus | "tous">("tous");
  // Même pattern que project-list.tsx (technique) — pill toggle, cartes par
  // défaut.
  const [view, setView] = useState<"card" | "list">("card");

  async function load() {
    try {
      const data = await listClients();
      setClients(data.results);
    } catch (err) {
      setError(err instanceof ApiError ? `Erreur ${err.status}` : "Erreur de chargement");
    }
  }

  useEffect(() => {
    load();
    listUsers().then((res) => setUsers(res.results)).catch(() => setUsers([]));
  }, []);

  const userName = useMemo(() => {
    const map = new Map(users.map((u) => [u.id, `${u.first_name} ${u.last_name}`]));
    return (id: string | null) => (id ? map.get(id) ?? "—" : "Non assigné");
  }, [users]);

  const filtered = useMemo(() => {
    if (!clients) return [];
    const q = search.trim().toLowerCase();
    return clients.filter((c) => {
      if (tab !== "tous" && c.status !== tab) return false;
      if (!q) return true;
      const haystack = `${c.company_name} ${c.siret ?? ""} ${c.email ?? ""} ${c.sector ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [clients, search, tab]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!clients) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Clients</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            {clients.length} client{clients.length !== 1 ? "s" : ""} — base de données clients (CRM).
          </p>
        </div>
        {canCreate("clients") && <ClientFormModal onSaved={load} />}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex max-w-[360px] min-w-48 flex-1 items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5">
          <Search className="size-4 shrink-0 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client, SIRET, secteur…"
            className="w-full min-w-0 border-0 bg-transparent text-sm text-neutral-700 outline-none placeholder:text-neutral-400"
          />
        </div>
        <div className="flex gap-1 rounded-lg border border-neutral-200 bg-white p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors",
                tab === t.value ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-50"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center rounded-full border border-neutral-200 bg-white p-0.5">
          <button
            type="button"
            onClick={() => setView("card")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              view === "card" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            <LayoutGrid className="size-3.5" /> Cartes
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              view === "list" ? "bg-neutral-900 text-white" : "text-neutral-500 hover:text-neutral-900"
            )}
          >
            <ListIcon className="size-3.5" /> Liste
          </button>
        </div>
      </div>

      {view === "card" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link
              key={c.id}
              href={`/admin/rh/clients/${c.id}`}
              className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-primary/40"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <span className="font-medium text-neutral-900">{c.company_name}</span>
                <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[c.status])}>
                  {STATUS_LABELS[c.status]}
                </span>
              </div>
              <p className="mb-3 text-xs text-neutral-400">{c.siret || c.email || "—"}</p>
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{c.sector || "Secteur non renseigné"}</span>
                <Rating value={c.rating} />
              </div>
              <p className="mt-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
                Assigné à <span className="font-medium text-neutral-700">{userName(c.assigned_to)}</span>
              </p>
            </Link>
          ))}
          {filtered.length === 0 && (
            <p className="col-span-full py-8 text-center text-sm text-neutral-400">
              {clients.length === 0 ? "Aucun client pour l'instant." : "Aucun résultat."}
            </p>
          )}
        </div>
      ) : (
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="table-responsive w-full text-sm">
          <thead className="bg-neutral-50 text-left text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
            <tr>
              <th className="px-5 py-3">Entreprise</th>
              <th className="px-5 py-3">Secteur</th>
              <th className="px-5 py-3">Statut</th>
              <th className="px-5 py-3">Notation</th>
              <th className="px-5 py-3">Assigné à</th>
              <th className="w-11 px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((c) => (
              <tr key={c.id} className="transition-colors hover:bg-neutral-50">
                <td className="px-5 py-3.5" data-label="Entreprise">
                  <Link href={`/admin/rh/clients/${c.id}`} className="block">
                    <span className="block font-medium text-neutral-900">{c.company_name}</span>
                    <span className="block text-xs text-neutral-400">{c.siret || c.email || "—"}</span>
                  </Link>
                </td>
                <td className="px-5 py-3.5 text-neutral-600" data-label="Secteur">{c.sector || "—"}</td>
                <td className="px-5 py-3.5" data-label="Statut">
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", STATUS_COLORS[c.status])}>
                    {STATUS_LABELS[c.status]}
                  </span>
                </td>
                <td className="px-5 py-3.5" data-label="Notation"><Rating value={c.rating} /></td>
                <td className="px-5 py-3.5 text-neutral-500" data-label="Assigné à">{userName(c.assigned_to)}</td>
                <td className="px-5 py-3.5">
                  <Popover>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      }
                    />
                    <PopoverContent className="w-44 p-1" align="end">
                      <Link
                        href={`/admin/rh/clients/${c.id}`}
                        className="block rounded-lg px-2.5 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                      >
                        Voir la fiche
                      </Link>
                      {canEdit("clients") && (
                        <ClientFormModal
                          client={c}
                          onSaved={load}
                          trigger={
                            <button type="button" className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50">
                              Modifier
                            </button>
                          }
                        />
                      )}
                      {canDelete("clients") && c.status !== "CLIENT_INACTIF" && (
                        <ConfirmModal
                          title="Marquer inactif"
                          description={`Marquer « ${c.company_name} » comme inactif ? Il restera consultable mais sortira des listes actives.`}
                          confirmLabel="Marquer inactif"
                          onConfirm={async () => { await archiveClient(c.id); load(); }}
                          trigger={
                            <button type="button" className="block w-full rounded-lg px-2.5 py-1.5 text-left text-xs text-destructive hover:bg-destructive/5">
                              Marquer inactif
                            </button>
                          }
                        />
                      )}
                    </PopoverContent>
                  </Popover>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  {clients.length === 0 ? "Aucun client pour l'instant." : "Aucun résultat."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
