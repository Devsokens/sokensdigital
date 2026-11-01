"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalClose } from "@/components/ui/modal";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  createDirectoryContact,
  updateDirectoryContact,
  type DirectoryContactInput,
} from "@/lib/api/administration";
import type { Client, DirectoryContact } from "@/lib/api/types";

function initialForm(contact?: DirectoryContact | null, clientId?: string | null): DirectoryContactInput {
  return {
    first_name: contact?.first_name ?? "",
    last_name: contact?.last_name ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    role: contact?.role ?? "",
    is_primary: contact?.is_primary ?? false,
    notes: contact?.notes ?? "",
    client: contact ? contact.client : clientId ?? null,
  };
}

/** Création / modification d'un contact de l'annuaire. Le client est
 * facultatif : on peut l'enregistrer seul et le rattacher plus tard. */
export function ContactFormModal({
  open,
  onOpenChange,
  contact,
  clients,
  defaultClientId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Présent → modification. Absent → création. */
  contact?: DirectoryContact | null;
  clients: Client[];
  defaultClientId?: string | null;
  onSaved: (contact: DirectoryContact) => void;
}) {
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent title={contact ? "Modifier le contact" : "Nouveau contact"} className="max-w-lg">
        {/* Le contenu n'est monté que modal ouvert : chaque ouverture repart
         * d'un formulaire initialisé sur le contact courant. */}
        <ContactForm
          key={contact?.id ?? "new"}
          contact={contact}
          clients={clients}
          defaultClientId={defaultClientId}
          onSaved={(saved) => {
            onSaved(saved);
            onOpenChange(false);
          }}
        />
      </ModalContent>
    </Modal>
  );
}

function ContactForm({
  contact,
  clients,
  defaultClientId,
  onSaved,
}: {
  contact?: DirectoryContact | null;
  clients: Client[];
  defaultClientId?: string | null;
  onSaved: (contact: DirectoryContact) => void;
}) {
  const [form, setForm] = useState<DirectoryContactInput>(() => initialForm(contact, defaultClientId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set<K extends keyof DirectoryContactInput>(key: K, value: DirectoryContactInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      onSaved(contact ? await updateDirectoryContact(contact.id, form) : await createDirectoryContact(form));
    } catch {
      setError("Impossible d'enregistrer ce contact — vérifiez l'e-mail et vos droits sur le client choisi.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>Prénom</span>
          <input value={form.first_name ?? ""} onChange={(e) => set("first_name", e.target.value)} className={inputClass} required />
        </label>
        <label className="block">
          <span className={labelClass}>Nom</span>
          <input value={form.last_name ?? ""} onChange={(e) => set("last_name", e.target.value)} className={inputClass} required />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className={labelClass}>E-mail</span>
          <input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Téléphone</span>
          <input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} className={inputClass} />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Fonction</span>
        <input value={form.role ?? ""} onChange={(e) => set("role", e.target.value)} placeholder="Directeur général, DSI…" className={inputClass} />
      </label>

      <label className="block">
        <span className={labelClass}>Client (entreprise)</span>
        <select value={form.client ?? ""} onChange={(e) => set("client", e.target.value || null)} className={inputClass}>
          <option value="">— Aucun client pour l&apos;instant —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.company_name}</option>
          ))}
        </select>
      </label>

      {form.client && (
        <label className="flex items-center gap-2 text-xs text-neutral-600">
          <input type="checkbox" checked={Boolean(form.is_primary)} onChange={(e) => set("is_primary", e.target.checked)} />
          Contact principal de ce client
        </label>
      )}

      <label className="block">
        <span className={labelClass}>Notes</span>
        <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={3} className={`${inputClass} resize-none`} />
      </label>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving} className="rounded-full px-6">
          {saving ? <Loader2 className="size-4 animate-spin" /> : contact ? "Enregistrer" : "Créer"}
        </Button>
        <ModalClose render={<Button type="button" variant="outline" className="rounded-full px-5">Annuler</Button>} />
      </div>
    </form>
  );
}
