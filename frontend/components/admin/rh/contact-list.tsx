"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  Link2,
  Link2Off,
  Loader2,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
} from "@/components/admin/context-menu";
import { ContactFormModal } from "@/components/admin/rh/contact-form-modal";
import {
  deleteDirectoryContact,
  listAllClients,
  listDirectoryContacts,
  updateDirectoryContact,
} from "@/lib/api/administration";
import { ApiError } from "@/lib/api/client";
import { usePermissions } from "@/lib/admin/permissions-context";
import type { Client, DirectoryContact } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type Tab = "tous" | "rattaches" | "sans-client";

const TABS: { value: Tab; label: string }[] = [
  { value: "tous", label: "Tous" },
  { value: "rattaches", label: "Rattachés" },
  { value: "sans-client", label: "Sans client" },
];

function initials(contact: DirectoryContact) {
  return `${contact.first_name?.[0] ?? ""}${contact.last_name?.[0] ?? ""}`.toUpperCase() || "?";
}

function fullName(contact: DirectoryContact) {
  return `${contact.first_name} ${contact.last_name}`.trim();
}

/** Annuaire des contacts — créés seuls ou depuis une fiche client, et
 * rattachables à un client à tout moment. */
export function ContactList() {
  const router = useRouter();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [contacts, setContacts] = useState<DirectoryContact[] | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("tous");
  const [clientFilter, setClientFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DirectoryContact | null>(null);
  const [toDelete, setToDelete] = useState<DirectoryContact | null>(null);

  useEffect(() => {
    Promise.all([
      listDirectoryContacts(),
      listAllClients().catch(() => ({ results: [] as Client[] })),
    ])
      .then(([contactsRes, clientsRes]) => {
        setContacts(contactsRes.results);
        setClients(clientsRes.results);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? `Erreur ${err.status}` : "Erreur de chargement");
      });
  }, []);

  const filtered = useMemo(() => {
    if (!contacts) return [];
    const q = search.trim().toLowerCase();
    return contacts.filter((c) => {
      if (tab === "rattaches" && !c.client) return false;
      if (tab === "sans-client" && c.client) return false;
      if (clientFilter && c.client !== clientFilter) return false;
      if (!q) return true;
      const haystack = `${c.first_name} ${c.last_name} ${c.email} ${c.phone} ${c.role} ${c.client_name ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [contacts, search, tab, clientFilter]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(contact: DirectoryContact) {
    setEditing(contact);
    setFormOpen(true);
  }

  function handleSaved(saved: DirectoryContact) {
    setContacts((prev) => {
      if (!prev) return prev;
      return prev.some((c) => c.id === saved.id)
        ? prev.map((c) => (c.id === saved.id ? saved : c))
        : [saved, ...prev];
    });
  }

  async function handleDetach(contact: DirectoryContact) {
    setActionError(null);
    try {
      handleSaved(await updateDirectoryContact(contact.id, { client: null, is_primary: false }));
    } catch {
      setActionError(`Impossible de détacher ${fullName(contact)} de son client.`);
    }
  }

  async function handleDelete(contact: DirectoryContact) {
    await deleteDirectoryContact(contact.id);
    setContacts((prev) => prev && prev.filter((c) => c.id !== contact.id));
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!contacts) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const allowEdit = canEdit("clients");
  const allowDelete = canDelete("clients");
  const unattachedCount = contacts.filter((c) => !c.client).length;

  function renderMenu(contact: DirectoryContact) {
    return (
      <>
        <ContextMenuLabel>{fullName(contact)}</ContextMenuLabel>
        {allowEdit && (
          <ContextMenuItem icon={Pencil} onClick={() => openEdit(contact)}>
            Modifier
          </ContextMenuItem>
        )}
        {allowEdit && (
          <ContextMenuItem icon={Link2} onClick={() => openEdit(contact)}>
            {contact.client ? "Changer de client…" : "Rattacher à un client…"}
          </ContextMenuItem>
        )}
        {contact.client && (
          <ContextMenuItem icon={Building2} onClick={() => router.push(`/admin/rh/clients/${contact.client}`)}>
            Voir la fiche client
          </ContextMenuItem>
        )}
        {contact.email && (
          <ContextMenuItem icon={Mail} onClick={() => window.open(`mailto:${contact.email}`)}>
            Envoyer un e-mail
          </ContextMenuItem>
        )}
        {contact.phone && (
          <ContextMenuItem icon={Phone} onClick={() => window.open(`tel:${contact.phone}`)}>
            Appeler
          </ContextMenuItem>
        )}
        {allowEdit && contact.client && (
          <ContextMenuItem icon={Link2Off} onClick={() => handleDetach(contact)}>
            Détacher du client
          </ContextMenuItem>
        )}
        {allowDelete && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem icon={Trash2} destructive onClick={() => setToDelete(contact)}>
              Supprimer
            </ContextMenuItem>
          </>
        )}
      </>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Contacts</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
            {unattachedCount > 0 && ` dont ${unattachedCount} sans client`} — clic droit sur une ligne pour les
            actions rapides.
          </p>
        </div>
        {canCreate("clients") && (
          <Button onClick={openCreate} className="gap-1.5 rounded-full px-4">
            <Plus className="size-4" /> Nouveau contact
          </Button>
        )}
      </div>

      {actionError && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {actionError}
        </p>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex max-w-[360px] min-w-56 flex-1 items-center gap-2.5 rounded-lg border border-neutral-200 bg-white px-3.5 py-2.5">
          <Search className="size-4 shrink-0 text-neutral-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un nom, e-mail, entreprise…"
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
        {clients.length > 0 && (
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700 outline-none"
          >
            <option value="">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.company_name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm">
        <table className="table-responsive w-full text-sm">
          <thead className="bg-neutral-50 text-left text-[11px] font-semibold tracking-wide text-neutral-500 uppercase">
            <tr>
              <th className="px-5 py-3">Contact</th>
              <th className="px-5 py-3">Entreprise</th>
              <th className="px-5 py-3">E-mail</th>
              <th className="px-5 py-3">Téléphone</th>
              <th className="w-11 px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {filtered.map((c) => (
              <ContextMenu
                key={c.id}
                render={<tr />}
                className="transition-colors hover:bg-neutral-50 data-[popup-open]:bg-primary/5"
                menu={renderMenu(c)}
              >
                <td className="px-5 py-3.5" data-label="Contact">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(c)}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-neutral-900">
                        {fullName(c)}
                        {c.is_primary && c.client && (
                          <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
                            Principal
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-neutral-400">{c.role || "Fonction non précisée"}</span>
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3.5" data-label="Entreprise">
                  {c.client ? (
                    <Link
                      href={`/admin/rh/clients/${c.client}`}
                      className="inline-flex items-center gap-1.5 font-medium text-neutral-800 hover:text-primary"
                    >
                      <Building2 className="size-3.5 text-neutral-400" />
                      {c.client_name}
                    </Link>
                  ) : allowEdit ? (
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="inline-flex items-center gap-1 rounded-full border border-dashed border-neutral-300 px-2.5 py-0.5 text-xs text-neutral-500 hover:border-primary hover:text-primary"
                    >
                      <Link2 className="size-3" /> Rattacher à un client
                    </button>
                  ) : (
                    <span className="text-xs text-neutral-400">Sans client</span>
                  )}
                </td>
                <td className="px-5 py-3.5 text-neutral-600" data-label="E-mail">
                  {c.email ? (
                    <a href={`mailto:${c.email}`} className="hover:text-primary">{c.email}</a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-5 py-3.5 text-neutral-600" data-label="Téléphone">{c.phone || "—"}</td>
                <td className="px-5 py-3.5">
                  <Popover>
                    <PopoverTrigger
                      render={
                        <button
                          type="button"
                          aria-label="Actions"
                          className="flex size-7 items-center justify-center rounded-lg text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      }
                    />
                    <PopoverContent className="w-48 p-1" align="end">
                      {allowEdit && (
                        <button
                          type="button"
                          onClick={() => openEdit(c)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                        >
                          <Pencil className="size-3.5" /> Modifier
                        </button>
                      )}
                      {allowEdit && c.client && (
                        <button
                          type="button"
                          onClick={() => handleDetach(c)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-neutral-700 hover:bg-neutral-50"
                        >
                          <Link2Off className="size-3.5" /> Détacher du client
                        </button>
                      )}
                      {allowDelete && (
                        <button
                          type="button"
                          onClick={() => setToDelete(c)}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs text-destructive hover:bg-destructive/5"
                        >
                          <Trash2 className="size-3.5" /> Supprimer
                        </button>
                      )}
                    </PopoverContent>
                  </Popover>
                </td>
              </ContextMenu>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-400">
                  {contacts.length === 0 ? "Aucun contact pour l'instant." : "Aucun résultat."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ContactFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editing}
        clients={clients}
        onSaved={handleSaved}
      />

      <ConfirmModal
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer le contact"
        description={toDelete ? `Supprimer définitivement ${fullName(toDelete)} ? Cette action est irréversible.` : ""}
        onConfirm={async () => {
          if (toDelete) await handleDelete(toDelete);
        }}
      />
    </div>
  );
}
