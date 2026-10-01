"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Loader2, Mail, Phone, Plus, Star, Trash2, Upload } from "lucide-react";
import {
  getClient,
  listContacts,
  createContact,
  deleteContact,
  listInteractions,
  createInteraction,
  listClientDocuments,
  createClientDocument,
  deleteClientDocument,
} from "@/lib/api/administration";
import { listUsers } from "@/lib/api/hr";
import { listProjects } from "@/lib/api/projects";
import { listAppointments, listClientEmails } from "@/lib/api/administration";
import { MeetingSheet } from "@/components/admin/agenda/meeting-sheet";
import type { Appointment, Client, ClientContact, ClientDocumentEntry, ClientInteractionEntry, ClientStatus, Project, SentEmail, UserBrief } from "@/lib/api/types";
import { ClientFormModal } from "@/components/admin/rh/client-form-modal";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<ClientStatus, string> = {
  CLIENT_ACTIF: "Client actif",
  CLIENT_INACTIF: "Client inactif",
};

const INTERACTION_LABELS: Record<string, string> = {
  CALL: "Appel",
  EMAIL: "Email",
  MEETING: "Réunion",
  OTHER: "Autre",
};

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  CONTRAT: "Contrat",
  DEVIS: "Devis",
  FACTURE: "Facture",
  AUTRE_JURIDIQUE: "Autre juridique",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function ClientDetail({ id }: { id: string }) {
  const [client, setClient] = useState<Client | null>(null);
  const [contacts, setContacts] = useState<ClientContact[]>([]);
  const [interactions, setInteractions] = useState<ClientInteractionEntry[]>([]);
  const [documents, setDocuments] = useState<ClientDocumentEntry[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [meetings, setMeetings] = useState<Appointment[]>([]);
  const [openMeeting, setOpenMeeting] = useState<Appointment | null>(null);
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const [c, contactsRes, interactionsRes, docsRes, usersRes, projectsRes, meetingsRes, emailsRes] = await Promise.all([
        getClient(id),
        listContacts(id),
        listInteractions(id),
        listClientDocuments(id),
        listUsers(),
        listProjects({ client: id }),
        listAppointments({ client: id }).catch(() => ({ results: [] as Appointment[] })),
        listClientEmails(id).catch(() => [] as SentEmail[]),
      ]);
      setClient(c);
      setContacts(contactsRes.results);
      setInteractions(interactionsRes.results);
      setDocuments(docsRes.results);
      setUsers(usersRes.results);
      setProjects(projectsRes.results);
      setMeetings(meetingsRes.results);
      setEmails(emailsRes);
    } catch {
      setError("Impossible de charger ce client (accès refusé ou introuvable).");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!client) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const assignedUser = users.find((u) => u.id === client.assigned_to);

  return (
    <div>
      <Link
        href="/admin/rh/clients"
        className="group mb-5 inline-flex items-center gap-2 text-sm font-medium text-neutral-700 transition-colors hover:text-neutral-900"
      >
        <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" /> Retour aux clients
      </Link>

      <div className="mb-6 flex items-start justify-between gap-6 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-neutral-900">{client.company_name}</h1>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {STATUS_LABELS[client.status]}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-neutral-500">
            {client.sector || "Secteur non renseigné"} · {client.siret || "SIRET non renseigné"}
          </p>
          <div className="mt-2 flex items-center gap-4 text-xs text-neutral-500">
            {client.email && <span className="flex items-center gap-1"><Mail className="size-3.5" /> {client.email}</span>}
            {client.phone && <span className="flex items-center gap-1"><Phone className="size-3.5" /> {client.phone}</span>}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-neutral-500">
            {client.rating && (
              <span className="flex items-center gap-0.5">
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className={cn("size-3", i < client.rating! ? "fill-amber-400 text-amber-400" : "text-neutral-200")} />
                ))}
              </span>
            )}
            <span>Assigné à {assignedUser ? `${assignedUser.first_name} ${assignedUser.last_name}` : "personne"}</span>
          </div>
        </div>
        <ClientFormModal
          client={client}
          onSaved={load}
          trigger={<Button variant="outline" className="rounded-full px-4">Modifier</Button>}
        />
      </div>

      <Tabs defaultValue="infos">
        <TabsList>
          <TabsTab value="infos">Informations</TabsTab>
          <TabsTab value="contacts">Contacts ({contacts.length})</TabsTab>
          <TabsTab value="historique">Historique ({interactions.length})</TabsTab>
          <TabsTab value="documents">Documents ({documents.length})</TabsTab>
          <TabsTab value="projets">Projets ({projects.length})</TabsTab>
          <TabsTab value="reunions">Réunions ({meetings.length})</TabsTab>
          <TabsTab value="mails">Mails envoyés ({emails.length})</TabsTab>
          <TabsIndicator />
        </TabsList>

        <TabsPanel value="infos" className="pt-4">
          <div className="grid grid-cols-2 gap-4 rounded-xl border border-neutral-200 bg-white p-5 text-sm">
            <div><p className={labelClass}>Adresse</p><p className="text-neutral-700">{client.address || "—"}</p></div>
            <div><p className={labelClass}>Ville</p><p className="text-neutral-700">{[client.postal_code, client.city].filter(Boolean).join(" ") || "—"}</p></div>
            <div><p className={labelClass}>Pays</p><p className="text-neutral-700">{client.country || "—"}</p></div>
            <div><p className={labelClass}>Site web</p><p className="text-neutral-700">{client.website || "—"}</p></div>
            <div className="col-span-2"><p className={labelClass}>Notes</p><p className="whitespace-pre-wrap text-neutral-700">{client.notes || "—"}</p></div>
          </div>
        </TabsPanel>

        <TabsPanel value="contacts" className="pt-4">
          <ContactsPanel clientId={id} contacts={contacts} onChange={load} />
        </TabsPanel>

        <TabsPanel value="historique" className="pt-4">
          <InteractionsPanel clientId={id} interactions={interactions} contacts={contacts} onChange={load} />
        </TabsPanel>

        <TabsPanel value="documents" className="pt-4">
          <DocumentsPanel clientId={id} documents={documents} onChange={load} />
        </TabsPanel>

        <TabsPanel value="projets" className="pt-4">
          <ProjectsPanel projects={projects} />
        </TabsPanel>

        <TabsPanel value="reunions" className="pt-4">
          {meetings.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Aucun rendez-vous lié à ce client. Planifiez-en un depuis l&apos;Agenda en choisissant ce client.
            </p>
          ) : (
            <div className="space-y-2">
              {meetings.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setOpenMeeting(m)}
                  className="flex w-full items-center justify-between rounded-xl border border-neutral-200 bg-white px-4 py-3 text-left shadow-sm transition-colors hover:border-primary/40"
                >
                  <span>
                    <span className="block font-medium text-neutral-900">{m.title}</span>
                    <span className="block text-xs text-neutral-500">
                      {new Date(m.start_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                      {m.location ? ` · ${m.location}` : ""}
                    </span>
                  </span>
                  <span className="text-xs font-medium text-primary">Ouvrir la réunion</span>
                </button>
              ))}
            </div>
          )}
        </TabsPanel>

        <TabsPanel value="mails" className="pt-4">
          {emails.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Aucun e-mail envoyé par la plateforme à ce client ou à ses contacts.
            </p>
          ) : (
            <div className="space-y-2">
              {emails.map((mail) => (
                <div
                  key={mail.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-neutral-900">{mail.subject}</span>
                    <span className="block text-xs text-neutral-500">
                      À {mail.recipient} · {new Date(mail.created_at).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" })}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
                      mail.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                    )}
                  >
                    {mail.success ? "Envoyé" : "Échec"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </TabsPanel>
      </Tabs>

      <MeetingSheet appointment={openMeeting} onClose={() => setOpenMeeting(null)} />
    </div>
  );
}

function ContactsPanel({ clientId, contacts, onChange }: { clientId: string; contacts: ClientContact[]; onChange: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", phone: "", role: "", is_primary: false });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createContact(clientId, form);
      setForm({ first_name: "", last_name: "", email: "", phone: "", role: "", is_primary: false });
      setAdding(false);
      onChange();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {contacts.map((c) => (
        <div key={c.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
          <div>
            <p className="text-sm font-medium text-neutral-900">
              {c.first_name} {c.last_name} {c.is_primary && <span className="ml-1.5 rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">Principal</span>}
            </p>
            <p className="text-xs text-neutral-500">{c.role || "—"} · {c.email || "—"} · {c.phone || "—"}</p>
          </div>
          <ConfirmModal
            title="Retirer ce contact"
            description={`Retirer ${c.first_name} ${c.last_name} des contacts de ce client ?`}
            onConfirm={async () => { await deleteContact(clientId, c.id); onChange(); }}
            trigger={<button type="button" className="text-neutral-400 hover:text-destructive"><Trash2 className="size-4" /></button>}
          />
        </div>
      ))}
      {contacts.length === 0 && !adding && <p className="text-sm text-neutral-400">Aucun contact enregistré.</p>}

      {adding ? (
        <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} placeholder="Prénom" className={inputClass} required />
            <input value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} placeholder="Nom" className={inputClass} required />
            <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" type="email" className={inputClass} />
            <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Téléphone" className={inputClass} />
            <input value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} placeholder="Fonction" className={inputClass} />
            <label className="flex items-center gap-2 text-xs text-neutral-600">
              <input type="checkbox" checked={form.is_primary} onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))} />
              Contact principal
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="rounded-full px-4">{saving ? <Loader2 className="size-4 animate-spin" /> : "Ajouter"}</Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)} className="rounded-full px-4">Annuler</Button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          <Plus className="size-3.5" /> Ajouter un contact
        </button>
      )}
    </div>
  );
}

function InteractionsPanel({
  clientId,
  interactions,
  contacts,
  onChange,
}: {
  clientId: string;
  interactions: ClientInteractionEntry[];
  contacts: ClientContact[];
  onChange: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ interaction_type: "CALL", subject: "", notes: "", contact: "", follow_up_date: "" });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createInteraction(clientId, {
        interaction_type: form.interaction_type,
        subject: form.subject,
        notes: form.notes,
        contact: form.contact || null,
        follow_up_date: form.follow_up_date || null,
      });
      setForm({ interaction_type: "CALL", subject: "", notes: "", contact: "", follow_up_date: "" });
      setAdding(false);
      onChange();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {interactions.map((it) => (
        <div key={it.id} className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
              {INTERACTION_LABELS[it.interaction_type] ?? it.interaction_type}
            </span>
            <span className="text-xs text-neutral-400">{formatDate(it.created_at)}</span>
          </div>
          <p className="mt-2 text-sm font-medium text-neutral-900">{it.subject}</p>
          <p className="mt-1 text-xs whitespace-pre-wrap text-neutral-600">{it.notes}</p>
          {it.follow_up_date && <p className="mt-1.5 text-xs text-amber-600">Relance prévue le {formatDate(it.follow_up_date)}</p>}
        </div>
      ))}
      {interactions.length === 0 && !adding && <p className="text-sm text-neutral-400">Aucune interaction enregistrée.</p>}

      {adding ? (
        <form onSubmit={handleAdd} className="space-y-3 rounded-xl border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-3">
            <select value={form.interaction_type} onChange={(e) => setForm((f) => ({ ...f, interaction_type: e.target.value }))} className={inputClass}>
              {Object.entries(INTERACTION_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} className={inputClass}>
              <option value="">Aucun contact spécifique</option>
              {contacts.map((c) => <option key={c.id} value={c.id}>{c.first_name} {c.last_name}</option>)}
            </select>
          </div>
          <input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="Sujet" className={inputClass} required />
          <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes" rows={3} className={`${inputClass} resize-none`} required />
          <label className="block">
            <span className={labelClass}>Relance prévue (optionnel)</span>
            <input type="date" value={form.follow_up_date} onChange={(e) => setForm((f) => ({ ...f, follow_up_date: e.target.value }))} className={inputClass} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="rounded-full px-4">{saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}</Button>
            <Button type="button" variant="outline" onClick={() => setAdding(false)} className="rounded-full px-4">Annuler</Button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
          <Plus className="size-3.5" /> Enregistrer une interaction
        </button>
      )}
    </div>
  );
}

function DocumentsPanel({ clientId, documents, onChange }: { clientId: string; documents: ClientDocumentEntry[]; onChange: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileType, setFileType] = useState("CONTRAT");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await createClientDocument(clientId, file, { name: file.name, file_type: fileType });
      onChange();
    } catch {
      setError("Échec de l'upload.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      {documents.map((doc) => (
        <div key={doc.id} className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-4">
          <a href={doc.url} target="_blank" rel="noreferrer" className="flex items-center gap-2.5 text-sm text-neutral-900 hover:text-primary">
            <FileText className="size-4 text-neutral-400" />
            <span>{doc.name}</span>
            <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">{DOCUMENT_TYPE_LABELS[doc.file_type] ?? doc.file_type}</span>
          </a>
          <ConfirmModal
            title="Supprimer le document"
            description={`Supprimer « ${doc.name} » ?`}
            onConfirm={async () => { await deleteClientDocument(clientId, doc.id); onChange(); }}
            trigger={<button type="button" className="text-neutral-400 hover:text-destructive"><Trash2 className="size-4" /></button>}
          />
        </div>
      ))}
      {documents.length === 0 && <p className="text-sm text-neutral-400">Aucun document.</p>}

      <div className="flex items-center gap-3">
        <select value={fileType} onChange={(e) => setFileType(e.target.value)} className={`${inputClass} w-auto`}>
          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          {uploading ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />} Téléverser un document
        </button>
        <input ref={inputRef} type="file" onChange={handleFile} className="hidden" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ProjectsPanel({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return <p className="text-sm text-neutral-400">Aucun projet rattaché à ce client.</p>;
  }
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {projects.map((p) => (
        <Link
          key={p.id}
          href={`/admin/technique/projets/${p.id}`}
          className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors hover:border-primary/40"
        >
          <p className="font-medium text-neutral-900">{p.name}</p>
          <p className="mt-1 text-xs text-neutral-500">
            {p.tasks_done}/{p.tasks_total} tâche{p.tasks_total !== 1 ? "s" : ""} terminée{p.tasks_done !== 1 ? "s" : ""}
          </p>
        </Link>
      ))}
    </div>
  );
}
