"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import {
  Building2,
  Calendar,
  Check,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Plus,
  Trash2,
  Upload,
  User,
  Users,
  X,
  ExternalLink,
  Briefcase,
  Paperclip,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { formatFcfa } from "@/lib/format-currency";
import { uploadChatFile } from "@/lib/api/upload";
import { createLead, updateLead, type LeadInput } from "@/lib/api/marketing";
import type {
  Lead,
  LeadContactPerson,
  LeadDocumentItem,
  LeadSource,
  LeadStatus,
  UserBrief,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<LeadStatus, string> = {
  NOUVEAU: "Nouveau",
  QUALIFIE: "Qualifié",
  PROPOSITION_EN_COURS: "Proposition en cours",
  PERDU: "Perdu",
  CONVERTI: "Converti",
};

const STATUS_STYLES: Record<LeadStatus, string> = {
  NOUVEAU: "bg-blue-50 text-blue-700 border-blue-200",
  QUALIFIE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PROPOSITION_EN_COURS: "bg-amber-50 text-amber-700 border-amber-200",
  PERDU: "bg-neutral-100 text-neutral-600 border-neutral-200",
  CONVERTI: "bg-purple-50 text-purple-700 border-purple-200",
};

const SOURCE_LABELS: Record<LeadSource, string> = {
  FORMULAIRE_CONTACT: "Formulaire de contact",
  FORMULAIRE_DEVIS: "Formulaire de devis",
  APPEL_ENTRANT: "Appel entrant",
  SITE_WEB: "Site web",
  EVENEMENT: "Événement",
};

export interface LeadSlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null; // Si null => Mode création nouveau lead
  users: UserBrief[];
  onSaved: (savedLead: Lead) => void;
}

export function LeadSlideOver({
  open,
  onOpenChange,
  lead,
  users,
  onSaved,
}: LeadSlideOverProps) {
  // Mode : si lead existant => par défaut "view", sinon "edit"
  const [isEditing, setIsEditing] = useState<boolean>(!lead);
  const [activeTab, setActiveTab] = useState<"info" | "contacts" | "documents">("info");

  // Champs de l'entreprise / organisation
  const [companyName, setCompanyName] = useState("");
  const [source, setSource] = useState<LeadSource>("SITE_WEB");
  const [status, setStatus] = useState<LeadStatus>("NOUVEAU");
  const [score, setScore] = useState("0");
  const [assignedTo, setAssignedTo] = useState("");
  const [estimatedValue, setEstimatedValue] = useState("");
  const [message, setMessage] = useState("");

  // Contacts en bloc
  const [contacts, setContacts] = useState<LeadContactPerson[]>([]);

  // Documents
  const [documents, setDocuments] = useState<LeadDocumentItem[]>([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const directDocInputRef = useRef<HTMLInputElement>(null);

  // Synchronisation lors de l'ouverture ou du changement de lead
  useEffect(() => {
    if (lead) {
      setIsEditing(false);
      setActiveTab("info");
      setCompanyName(lead.company_name || "");
      setSource(lead.source || "SITE_WEB");
      setStatus(lead.status || "NOUVEAU");
      setScore(String(lead.qualification_score ?? 0));
      setAssignedTo(lead.assigned_to?.id || "");
      setEstimatedValue(lead.estimated_value ? String(lead.estimated_value) : "");
      setMessage(lead.message || "");

      // Initialisation des contacts
      if (lead.contacts && lead.contacts.length > 0) {
        setContacts(lead.contacts);
      } else {
        // Rétrocompatibilité : utiliser les champs principaux
        setContacts([
          {
            id: "c-1",
            first_name: lead.first_name || "",
            last_name: lead.last_name || "",
            email: lead.email || "",
            phone: lead.phone || "",
            role: "Contact principal",
            is_primary: true,
          },
        ]);
      }

      // Initialisation des documents
      const docs: LeadDocumentItem[] = lead.documents ? [...lead.documents] : [];
      if (lead.attachment_url && !docs.some((d) => d.url === lead.attachment_url)) {
        docs.push({
          id: "att-1",
          name: lead.attachment_name || "Document joint",
          url: lead.attachment_url,
          uploaded_at: lead.created_at,
        });
      }
      setDocuments(docs);
    } else {
      // Nouveau lead
      setIsEditing(true);
      setActiveTab("info");
      setCompanyName("");
      setSource("SITE_WEB");
      setStatus("NOUVEAU");
      setScore("20");
      setAssignedTo("");
      setEstimatedValue("");
      setMessage("");
      setContacts([
        {
          id: `c-${Date.now()}`,
          first_name: "",
          last_name: "",
          email: "",
          phone: "",
          role: "Directeur de projet",
          is_primary: true,
        },
      ]);
      setDocuments([]);
    }
    setError(null);
  }, [lead, open]);

  // Gestion des contacts en bloc
  function handleAddContact() {
    setContacts((prev) => [
      ...prev,
      {
        id: `c-${Date.now()}`,
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        role: "",
        is_primary: false,
      },
    ]);
  }

  function handleUpdateContact(index: number, patch: Partial<LeadContactPerson>) {
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...patch } : c))
    );
  }

  function handleRemoveContact(index: number) {
    if (contacts.length <= 1) return;
    setContacts((prev) => prev.filter((_, i) => i !== index));
  }

  // Upload d'un document
  async function handleFileUpload(file: File, autoSave = false) {
    setUploadingDoc(true);
    setError(null);
    try {
      let fileUrl = "";
      try {
        fileUrl = await uploadChatFile(file);
      } catch {
        // Fallback local blob URL
        fileUrl = URL.createObjectURL(file);
      }

      const newDoc: LeadDocumentItem = {
        id: `doc-${Date.now()}`,
        name: file.name,
        url: fileUrl,
        size: file.size,
        uploaded_at: new Date().toISOString(),
      };

      const updatedDocs = [...documents, newDoc];
      setDocuments(updatedDocs);

      // Si on est en mode vue (détail) et qu'on ajoute directement un doc
      if (autoSave && lead) {
        const saved = await updateLead(lead.id, {
          documents: updatedDocs,
        });
        onSaved(saved);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload du document.");
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (directDocInputRef.current) directDocInputRef.current.value = "";
    }
  }

  function handleRemoveDoc(docId?: string) {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
  }

  // Validation et soumission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validation des contacts
    const validContacts = contacts.filter(
      (c) => c.first_name.trim() || c.last_name.trim() || c.email.trim()
    );

    if (validContacts.length === 0) {
      setError("Veuillez renseigner au moins un contact (Nom, Prénom et E-mail).");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    for (const c of validContacts) {
      if (!c.first_name.trim() || !c.last_name.trim()) {
        setError("Le nom et prénom de chaque contact sont obligatoires.");
        return;
      }
      if (!c.email.trim() || !emailRegex.test(c.email.trim())) {
        setError(`L'adresse e-mail de ${c.first_name} ${c.last_name} est invalide.`);
        return;
      }
    }

    const primaryContact = validContacts[0];

    const payload: LeadInput = {
      first_name: primaryContact.first_name.trim(),
      last_name: primaryContact.last_name.trim(),
      company_name: companyName.trim(),
      email: primaryContact.email.trim(),
      phone: primaryContact.phone.trim(),
      source,
      message: message.trim(),
      status,
      qualification_score: Number(score) || 0,
      assigned_to_id: assignedTo || null,
      estimated_value: estimatedValue ? String(estimatedValue) : null,
      contacts: validContacts,
      documents,
    };

    setSaving(true);
    try {
      const saved = lead ? await updateLead(lead.id, payload) : await createLead(payload);
      onSaved(saved);
      if (!lead) {
        onOpenChange(false);
      } else {
        setIsEditing(false);
      }
    } catch {
      setError(lead ? "Impossible de modifier ce lead." : "Impossible de créer ce lead.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Backdrop avec fondu */}
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          )}
        />

        {/* Panneau coulissant depuis la droite */}
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-white shadow-2xl",
            "transition-transform duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full"
          )}
        >
          {/* En-tête du slide-over */}
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-6 py-4 bg-white">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <Dialog.Title className="text-lg font-bold text-neutral-900 leading-tight">
                  {lead
                    ? lead.company_name || `${lead.first_name} ${lead.last_name}`
                    : "Nouveau lead commercial"}
                </Dialog.Title>
                <div className="flex items-center gap-2 mt-0.5">
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[0.7rem] font-medium",
                      STATUS_STYLES[status]
                    )}
                  >
                    {STATUS_LABELS[status]}
                  </span>
                  <span className="text-xs text-neutral-400">•</span>
                  <span className="text-xs text-neutral-500">{SOURCE_LABELS[source]}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {lead && !isEditing && (
                <Button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="gap-1.5 rounded-full px-3.5 text-xs shadow-sm"
                >
                  <Pencil className="size-3.5" /> Modifier
                </Button>
              )}
              {lead && isEditing && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="rounded-full px-3.5 text-xs"
                >
                  Annuler
                </Button>
              )}
              <Dialog.Close
                aria-label="Fermer"
                className="rounded-full p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
              >
                <X className="size-5" />
              </Dialog.Close>
            </div>
          </div>

          {/* Navigation par 3 Onglets (mode vue uniquement) */}
          {lead && !isEditing && (
            <div className="flex border-b border-neutral-200 bg-neutral-50/60 px-6">
              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className={cn(
                  "flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors",
                  activeTab === "info"
                    ? "border-primary text-primary"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                )}
              >
                <Building2 className="size-4" /> Informations
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("contacts")}
                className={cn(
                  "flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors",
                  activeTab === "contacts"
                    ? "border-primary text-primary"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                )}
              >
                <Users className="size-4" /> Contacts
                <span className="rounded-full bg-neutral-200 px-1.5 py-0.2 text-[0.65rem] text-neutral-700">
                  {contacts.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("documents")}
                className={cn(
                  "flex items-center gap-2 border-b-2 py-3 px-3 text-xs font-semibold transition-colors",
                  activeTab === "documents"
                    ? "border-primary text-primary"
                    : "border-transparent text-neutral-500 hover:text-neutral-900"
                )}
              >
                <FileText className="size-4" /> Documents
                <span className="rounded-full bg-neutral-200 px-1.5 py-0.2 text-[0.65rem] text-neutral-700">
                  {documents.length}
                </span>
              </button>
            </div>
          )}

          {/* Corps défilable */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-xs text-destructive">
                {error}
              </p>
            )}

            {/* VUE CONSULTATION DÉTAILLÉE (3 ONGLETS) */}
            {lead && !isEditing ? (
              <div>
                {/* ONGLET 1 : INFORMATIONS */}
                {activeTab === "info" && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4 rounded-xl border border-neutral-100 bg-neutral-50/70 p-4">
                      <div>
                        <span className="text-[0.7rem] uppercase font-bold text-neutral-400">Entreprise / Organisation</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">
                          {lead.company_name || "Non spécifié"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[0.7rem] uppercase font-bold text-neutral-400">Statut commercial</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">
                          {STATUS_LABELS[lead.status]}
                        </p>
                      </div>
                      <div>
                        <span className="text-[0.7rem] uppercase font-bold text-neutral-400">Source</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">
                          {SOURCE_LABELS[lead.source]}
                        </p>
                      </div>
                      <div>
                        <span className="text-[0.7rem] uppercase font-bold text-neutral-400">Score de qualification</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="h-2 w-24 rounded-full bg-neutral-200 overflow-hidden">
                            <div
                              className="h-full bg-primary"
                              style={{ width: `${Math.min(100, lead.qualification_score)}%` }}
                            />
                          </div>
                          <span className="text-xs font-mono font-bold text-neutral-800">
                            {lead.qualification_score} / 100
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[0.7rem] uppercase font-bold text-neutral-400">Budget estimé</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5">
                          {lead.estimated_value ? formatFcfa(lead.estimated_value) : "Non renseigné"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[0.7rem] uppercase font-bold text-neutral-400">Assigné à</span>
                        <p className="text-sm font-semibold text-neutral-900 mt-0.5 flex items-center gap-1.5">
                          <User className="size-3.5 text-neutral-500" />
                          {lead.assigned_to
                            ? `${lead.assigned_to.first_name} ${lead.assigned_to.last_name}`
                            : "Non assigné"}
                        </p>
                      </div>
                    </div>

                    {lead.message && (
                      <div className="rounded-xl border border-neutral-200 bg-white p-4">
                        <span className="text-xs font-bold text-neutral-700">Message / Description du besoin</span>
                        <p className="mt-1.5 text-xs text-neutral-600 whitespace-pre-wrap leading-relaxed">
                          {lead.message}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center gap-4 text-xs text-neutral-400 pt-2 border-t border-neutral-100">
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" /> Créé le {new Date(lead.created_at).toLocaleDateString("fr-FR")}
                      </span>
                    </div>
                  </div>
                )}

                {/* ONGLET 2 : CONTACTS */}
                {activeTab === "contacts" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-neutral-500">
                        {contacts.length} contact(s) rattaché(s) à ce lead.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsEditing(true)}
                        className="gap-1 rounded-full text-xs"
                      >
                        <Plus className="size-3" /> Ajouter un contact
                      </Button>
                    </div>

                    <div className="grid gap-3">
                      {contacts.map((contact, i) => (
                        <div
                          key={contact.id || i}
                          className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm hover:border-neutral-300 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2.5">
                              <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 font-bold text-primary text-xs">
                                {contact.first_name?.[0]}
                                {contact.last_name?.[0]}
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-neutral-900">
                                  {contact.first_name} {contact.last_name}
                                </h4>
                                <p className="text-xs text-neutral-500 flex items-center gap-1">
                                  <Briefcase className="size-3" />
                                  {contact.role || "Rôle non précisé"}
                                </p>
                              </div>
                            </div>
                            {contact.is_primary && (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-bold text-primary">
                                Principal
                              </span>
                            )}
                          </div>

                          <div className="mt-3.5 grid grid-cols-2 gap-2 border-t border-neutral-100 pt-3 text-xs">
                            <a
                              href={`mailto:${contact.email}`}
                              className="flex items-center gap-1.5 text-neutral-700 hover:text-primary transition-colors truncate"
                            >
                              <Mail className="size-3.5 text-neutral-400 shrink-0" />
                              <span className="truncate">{contact.email || "—"}</span>
                            </a>
                            <a
                              href={`tel:${contact.phone}`}
                              className="flex items-center gap-1.5 text-neutral-700 hover:text-primary transition-colors truncate"
                            >
                              <Phone className="size-3.5 text-neutral-400 shrink-0" />
                              <span className="truncate">{contact.phone || "—"}</span>
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ONGLET 3 : DOCUMENTS */}
                {activeTab === "documents" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-neutral-500">
                        Documents et pièces jointes rattachés au lead.
                      </p>
                      <div>
                        <input
                          type="file"
                          ref={directDocInputRef}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleFileUpload(f, true);
                          }}
                          className="hidden"
                        />
                        <Button
                          type="button"
                          disabled={uploadingDoc}
                          onClick={() => directDocInputRef.current?.click()}
                          className="gap-1.5 rounded-full text-xs"
                        >
                          {uploadingDoc ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Upload className="size-3.5" />
                          )}
                          Uploader un document
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      {documents.map((doc, i) => (
                        <div
                          key={doc.id || i}
                          className="flex items-center justify-between rounded-xl border border-neutral-200 bg-white p-3.5 shadow-sm"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex size-9 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
                              <FileText className="size-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-neutral-900 max-w-sm truncate">
                                {doc.name}
                              </p>
                              <p className="text-[0.65rem] text-neutral-400">
                                {doc.uploaded_at
                                  ? new Date(doc.uploaded_at).toLocaleDateString("fr-FR")
                                  : "Fichier joint"}
                                {doc.size ? ` • ${(doc.size / 1024).toFixed(0)} Ko` : ""}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <a
                              href={doc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 rounded-lg border border-neutral-200 px-2.5 py-1 text-xs text-neutral-700 hover:bg-neutral-50"
                            >
                              <ExternalLink className="size-3" /> Consulter
                            </a>
                          </div>
                        </div>
                      ))}

                      {documents.length === 0 && (
                        <div className="rounded-xl border border-dashed border-neutral-200 p-8 text-center">
                          <Paperclip className="mx-auto size-8 text-neutral-300" />
                          <p className="mt-2 text-xs font-medium text-neutral-600">
                            Aucun document joint pour le moment
                          </p>
                          <p className="text-[0.7rem] text-neutral-400">
                            Ajoutez des cahiers des charges, devis ou spécifications.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* FORMULAIRE COMPLET D'ÉDITION / CRÉATION */
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* SECTION 1 : ORGANISATION / ENTREPRISE */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
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
                      <select
                        value={status}
                        onChange={(e) => setStatus(e.target.value as LeadStatus)}
                        className={inputClass}
                      >
                        {Object.entries(STATUS_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className={labelClass}>Source du lead</span>
                      <select
                        value={source}
                        onChange={(e) => setSource(e.target.value as LeadSource)}
                        className={inputClass}
                      >
                        {Object.entries(SOURCE_LABELS).map(([k, label]) => (
                          <option key={k} value={k}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className={labelClass}>Assigné à</span>
                      <select
                        value={assignedTo}
                        onChange={(e) => setAssignedTo(e.target.value)}
                        className={inputClass}
                      >
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
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={3}
                      placeholder="Contexte de la demande, besoins exprimés..."
                      className={inputClass}
                    />
                  </label>
                </div>

                {/* SECTION 2 : CONTACTS EN BLOC */}
                <div className="space-y-3 pt-4 border-t border-neutral-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        2. Contacts rattachés (en bloc)
                      </h3>
                      <p className="text-[0.7rem] text-neutral-400">
                        Ajoutez un ou plusieurs contacts pour cette organisation.
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddContact}
                      className="gap-1 rounded-full text-xs h-8"
                    >
                      <Plus className="size-3.5" /> Ajouter un contact
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {contacts.map((contact, i) => (
                      <div
                        key={contact.id || i}
                        className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4 space-y-3 relative group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                            <User className="size-3.5 text-primary" /> Contact #{i + 1}
                            {i === 0 && (
                              <span className="text-[0.65rem] font-medium text-primary bg-primary/10 rounded px-1.5 py-0.2">
                                Principal
                              </span>
                            )}
                          </span>

                          {contacts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveContact(i)}
                              className="text-neutral-400 hover:text-destructive p-1 rounded transition-colors"
                              title="Supprimer ce contact"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className={labelClass}>Prénom</span>
                            <input
                              value={contact.first_name}
                              onChange={(e) => handleUpdateContact(i, { first_name: e.target.value })}
                              placeholder="Prénom"
                              className={inputClass}
                              required
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Nom</span>
                            <input
                              value={contact.last_name}
                              onChange={(e) => handleUpdateContact(i, { last_name: e.target.value })}
                              placeholder="Nom de famille"
                              className={inputClass}
                              required
                            />
                          </label>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className={labelClass}>Adresse e-mail</span>
                            <input
                              type="email"
                              value={contact.email}
                              onChange={(e) => handleUpdateContact(i, { email: e.target.value })}
                              placeholder="contact@entreprise.com"
                              className={inputClass}
                              required
                            />
                          </label>
                          <label className="block">
                            <span className={labelClass}>Numéro de téléphone</span>
                            <input
                              type="tel"
                              value={contact.phone}
                              onChange={(e) => handleUpdateContact(i, { phone: e.target.value })}
                              placeholder="+225 01 02 03 04 05"
                              className={inputClass}
                            />
                          </label>
                        </div>

                        <label className="block">
                          <span className={labelClass}>Fonction / Intitulé de poste</span>
                          <input
                            value={contact.role}
                            onChange={(e) => handleUpdateContact(i, { role: e.target.value })}
                            placeholder="Ex: Directeur Marketing, Acheteur, Responsable SI..."
                            className={inputClass}
                          />
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* SECTION 3 : UPLOAD DE DOCUMENTS */}
                <div className="space-y-3 pt-4 border-t border-neutral-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">
                        3. Documents joints
                      </h3>
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
                          if (f) handleFileUpload(f, false);
                        }}
                        className="hidden"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        disabled={uploadingDoc}
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-1.5 rounded-full text-xs h-8"
                      >
                        {uploadingDoc ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Upload className="size-3.5" />
                        )}
                        Ajouter un document
                      </Button>
                    </div>
                  </div>

                  {documents.length > 0 && (
                    <div className="space-y-2">
                      {documents.map((doc, idx) => (
                        <div
                          key={doc.id || idx}
                          className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-2.5"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <FileText className="size-4 text-primary shrink-0" />
                            <span className="text-xs font-medium text-neutral-800 truncate">
                              {doc.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveDoc(doc.id)}
                            className="text-neutral-400 hover:text-destructive p-1 rounded"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* BOUTONS DE VALIDATION DU FORMULAIRE */}
                <div className="sticky bottom-0 bg-white border-t border-neutral-200 pt-4 flex items-center justify-between">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (lead) setIsEditing(false);
                      else onOpenChange(false);
                    }}
                    className="rounded-full px-5 text-xs"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={saving}
                    className="rounded-full px-6 text-xs shadow-sm"
                  >
                    {saving ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Check className="size-3.5" />
                    )}
                    {saving
                      ? "Enregistrement..."
                      : lead
                      ? "Enregistrer les modifications"
                      : "Créer le lead"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
