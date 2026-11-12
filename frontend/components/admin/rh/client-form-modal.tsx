"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Building2, Check, FileText, Loader2, Plus, Trash2, Upload, User, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  createClient,
  createClientDocument,
  deleteClientDocument,
  getClient,
  listClientDocuments,
  listContacts,
  updateClient,
  type ClientInput,
} from "@/lib/api/administration";
import { listUsers } from "@/lib/api/hr";
import type { Client, ClientDocumentEntry, LeadSource, UserBrief } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/* Formulaire client = formulaire lead (components/admin/marketing/
 * lead-slide-over.tsx), même présentation en panneau coulissant et mêmes
 * champs : on triera ce qu'on garde au fur et à mesure. Source, score et
 * valeur estimée sont portés par le lead converti du client ; le statut
 * commercial d'un client est toujours « Converti ». */

const SOURCE_LABELS: Record<LeadSource, string> = {
  FORMULAIRE_CONTACT: "Formulaire de contact",
  FORMULAIRE_DEVIS: "Formulaire de devis",
  APPEL_ENTRANT: "Appel entrant",
  SITE_WEB: "Site web",
  EVENEMENT: "Événement",
  CREATION_CLIENT: "Client créé directement",
};

interface ContactRow {
  key: string;
  /** Contact déjà enregistré pour ce client ; absent pour une ligne neuve. */
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
}

function emptyContact(role = ""): ContactRow {
  return { key: `new-${Date.now()}-${Math.random()}`, first_name: "", last_name: "", email: "", phone: "", role };
}

export function ClientFormModal({
  client,
  onSaved,
  trigger,
}: {
  /** Present → edit mode. Absent → create mode. */
  client?: Client;
  onSaved: () => void;
  trigger?: React.ReactElement;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = Boolean(client);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        render={
          trigger ?? (
            <Button className="gap-1.5 rounded-full px-4">
              <Plus className="size-4" /> Nouveau client
            </Button>
          )
        }
      />
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          )}
        />
        {/* Panneau coulissant depuis la droite, comme le formulaire lead */}
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full"
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <Dialog.Title className="text-lg leading-tight font-bold text-neutral-900">
                  {isEdit ? client?.company_name : "Nouveau client"}
                </Dialog.Title>
                <span className="mt-0.5 inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[0.7rem] font-medium text-purple-700">
                  Converti
                </span>
              </div>
            </div>
            <Dialog.Close
              aria-label="Fermer"
              className="rounded-full p-2 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="size-5" />
            </Dialog.Close>
          </div>

          {/* Monté seulement panneau ouvert : chaque ouverture repart d'un
           * formulaire rechargé depuis la fiche à jour. */}
          <ClientForm
            clientId={client?.id}
            onCancel={() => setOpen(false)}
            onSaved={() => {
              onSaved();
              setOpen(false);
            }}
          />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ClientForm({
  clientId,
  onCancel,
  onSaved,
}: {
  clientId?: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(Boolean(clientId));
  const [users, setUsers] = useState<UserBrief[]>([]);

  const [companyName, setCompanyName] = useState("");
  const [source, setSource] = useState<LeadSource>("CREATION_CLIENT");
  const [assignedTo, setAssignedTo] = useState("");
  const [score, setScore] = useState("100");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [notes, setNotes] = useState("");
  const [contacts, setContacts] = useState<ContactRow[]>(() => [emptyContact("Directeur de projet")]);

  // Documents déjà sur la fiche (modification) et fichiers à envoyer après
  // l'enregistrement — le client doit exister pour recevoir un document.
  const [existingDocs, setExistingDocs] = useState<ClientDocumentEntry[]>([]);
  const [removedDocIds, setRemovedDocIds] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Liste réservée à certains rôles côté serveur : sans elle, le champ
    // « Assigné à » reste vide (comme dans le tunnel commercial).
    listUsers()
      .then((res) => setUsers(res.results))
      .catch(() => setUsers([]));

    if (!clientId) return;
    Promise.all([getClient(clientId), listContacts(clientId), listClientDocuments(clientId)])
      .then(([c, contactsRes, docsRes]) => {
        setCompanyName(c.company_name);
        setAssignedTo(c.assigned_to ?? "");
        setNotes(c.notes ?? "");
        if (c.lead) {
          setSource(c.lead.source);
          setScore(String(c.lead.qualification_score));
          setEstimatedValue(c.lead.estimated_value ? String(Math.round(Number(c.lead.estimated_value))) : "");
        }
        const ordered = [...contactsRes.results].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
        setContacts(
          ordered.length > 0
            ? ordered.map((ct) => ({
                key: ct.id,
                id: ct.id,
                first_name: ct.first_name,
                last_name: ct.last_name,
                email: ct.email ?? "",
                phone: ct.phone ?? "",
                role: ct.role ?? "",
              }))
            : [emptyContact()]
        );
        setExistingDocs(docsRes.results);
      })
      .catch(() => setError("Impossible de charger ce client."))
      .finally(() => setLoading(false));
  }, [clientId]);

  function updateContact(index: number, patch: Partial<ContactRow>) {
    setContacts((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Lignes entièrement vides ignorées ; une ligne entamée doit avoir
    // nom et prénom, et un e-mail valide s'il est renseigné.
    const filled = contacts.filter(
      (c) => c.first_name.trim() || c.last_name.trim() || c.email.trim() || c.phone.trim()
    );
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const c of filled) {
      if (!c.first_name.trim() || !c.last_name.trim()) {
        setError("Le nom et prénom de chaque contact sont obligatoires.");
        return;
      }
      if (c.email.trim() && !emailRegex.test(c.email.trim())) {
        setError(`L'adresse e-mail de ${c.first_name} ${c.last_name} est invalide.`);
        return;
      }
    }

    const primary = filled[0];
    const payload: ClientInput = {
      company_name: companyName.trim(),
      assigned_to: assignedTo || null,
      notes: notes.trim(),
      lead_source: source,
      qualification_score: Math.min(100, Math.max(0, Number(score) || 0)),
      estimated_value: estimatedValue ? String(estimatedValue) : null,
      contacts: filled.map((c) => ({
        ...(c.id ? { id: c.id } : {}),
        first_name: c.first_name.trim(),
        last_name: c.last_name.trim(),
        email: c.email.trim(),
        phone: c.phone.trim(),
        role: c.role.trim(),
      })),
    };
    // Coordonnées de la fiche à la création : celles du contact principal.
    if (!clientId && primary) {
      payload.email = primary.email.trim();
      payload.phone = primary.phone.trim();
    }

    setSaving(true);
    try {
      const saved = clientId ? await updateClient(clientId, payload) : await createClient(payload);
      for (const docId of removedDocIds) await deleteClientDocument(saved.id, docId);
      for (const file of pendingFiles) {
        await createClientDocument(saved.id, file, { name: file.name, file_type: "AUTRE_JURIDIQUE" });
      }
      onSaved();
    } catch {
      setError(clientId ? "Impossible de modifier ce client." : "Impossible de créer ce client.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const visibleDocs = existingDocs.filter((d) => !removedDocIds.includes(d.id));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      {error && (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1 : ORGANISATION / ENTREPRISE */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold tracking-wider text-neutral-500 uppercase">
            1. Entreprise & Informations générales
          </h3>

          <label className="block">
            <span className={labelClass}>Nom de l&apos;entreprise ou organisation</span>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Ex: Groupe Atlantic SARL"
              className={inputClass}
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Statut commercial</span>
              <select value="CONVERTI" disabled className={cn(inputClass, "opacity-70")}>
                <option value="CONVERTI">Converti</option>
              </select>
              <span className="mt-1 block text-[0.7rem] text-neutral-400">Un client est toujours un lead converti.</span>
            </label>

            <label className="block">
              <span className={labelClass}>Source du client</span>
              <select value={source} onChange={(e) => setSource(e.target.value as LeadSource)} className={inputClass}>
                {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((k) => (
                  <option key={k} value={k}>
                    {SOURCE_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>Assigné à</span>
              <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className={inputClass}>
                <option value="">— Non assigné —</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.first_name} {u.last_name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className={labelClass}>Score de qualification (0 - 100)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>Valeur estimée du projet (FCFA)</span>
            <input
              type="number"
              min={0}
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
              placeholder="Ex: 5000000"
              className={inputClass}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Message ou note interne</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Contexte, besoins exprimés..."
              className={inputClass}
            />
          </label>
        </div>

        {/* SECTION 2 : CONTACTS EN BLOC */}
        <div className="space-y-3 border-t border-neutral-200 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold tracking-wider text-neutral-500 uppercase">
                2. Contacts rattachés (en bloc)
              </h3>
              <p className="text-[0.7rem] text-neutral-400">Ajoutez un ou plusieurs contacts pour cette organisation.</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setContacts((prev) => [...prev, emptyContact()])}
              className="h-8 gap-1 rounded-full text-xs"
            >
              <Plus className="size-3.5" /> Ajouter un contact
            </Button>
          </div>

          <div className="space-y-3">
            {contacts.map((contact, i) => (
              <div key={contact.key} className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-bold text-neutral-700">
                    <User className="size-3.5 text-primary" /> Contact #{i + 1}
                    {i === 0 && (
                      <span className="rounded bg-primary/10 px-1.5 text-[0.65rem] font-medium text-primary">Principal</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => setContacts((prev) => prev.filter((_, idx) => idx !== i))}
                    className="rounded p-1 text-neutral-400 transition-colors hover:text-destructive"
                    title="Retirer ce contact"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={labelClass}>Prénom</span>
                    <input
                      value={contact.first_name}
                      onChange={(e) => updateContact(i, { first_name: e.target.value })}
                      placeholder="Prénom"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Nom</span>
                    <input
                      value={contact.last_name}
                      onChange={(e) => updateContact(i, { last_name: e.target.value })}
                      placeholder="Nom de famille"
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className={labelClass}>Adresse e-mail</span>
                    <input
                      type="email"
                      value={contact.email}
                      onChange={(e) => updateContact(i, { email: e.target.value })}
                      placeholder="contact@entreprise.com"
                      className={inputClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Numéro de téléphone</span>
                    <input
                      type="tel"
                      value={contact.phone}
                      onChange={(e) => updateContact(i, { phone: e.target.value })}
                      placeholder="+241 01 02 03 04"
                      className={inputClass}
                    />
                  </label>
                </div>

                <label className="block">
                  <span className={labelClass}>Fonction / Intitulé de poste</span>
                  <input
                    value={contact.role}
                    onChange={(e) => updateContact(i, { role: e.target.value })}
                    placeholder="Ex: Directeur Marketing, Acheteur, Responsable SI..."
                    className={inputClass}
                  />
                </label>
              </div>
            ))}
            {contacts.length === 0 && <p className="text-xs text-neutral-400">Aucun contact.</p>}
          </div>
        </div>

        {/* SECTION 3 : DOCUMENTS */}
        <div className="space-y-3 border-t border-neutral-200 pt-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold tracking-wider text-neutral-500 uppercase">3. Documents joints</h3>
              <p className="text-[0.7rem] text-neutral-400">
                Uploadez des pièces justificatives, cahiers des charges ou présentations.
              </p>
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPendingFiles((prev) => [...prev, f]);
                  e.target.value = "";
                }}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 gap-1.5 rounded-full text-xs"
              >
                <Upload className="size-3.5" /> Ajouter un document
              </Button>
            </div>
          </div>

          {(visibleDocs.length > 0 || pendingFiles.length > 0) && (
            <div className="space-y-2">
              {visibleDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-2.5">
                  <a href={doc.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <span className="truncate text-xs font-medium text-neutral-800 hover:underline">{doc.name}</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setRemovedDocIds((prev) => [...prev, doc.id])}
                    className="rounded p-1 text-neutral-400 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
              {pendingFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-lg border border-dashed border-neutral-300 bg-white p-2.5">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="size-4 shrink-0 text-neutral-400" />
                    <span className="truncate text-xs font-medium text-neutral-800">{file.name}</span>
                    <span className="shrink-0 text-[0.65rem] text-neutral-400">envoyé à l&apos;enregistrement</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))}
                    className="rounded p-1 text-neutral-400 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOUTONS DE VALIDATION DU FORMULAIRE */}
        <div className="sticky bottom-0 flex items-center justify-between border-t border-neutral-200 bg-white pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="rounded-full px-5 text-xs">
            Annuler
          </Button>
          <Button type="submit" disabled={saving} className="rounded-full px-6 text-xs shadow-sm">
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
            {saving ? "Enregistrement..." : clientId ? "Enregistrer les modifications" : "Créer le client"}
          </Button>
        </div>
      </form>
    </div>
  );
}
