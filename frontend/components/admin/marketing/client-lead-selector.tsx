"use client";

import { useEffect, useState } from "react";
import { UserCheck, Target, Pencil, Building2 } from "lucide-react";
import { listClients } from "@/lib/api/administration";
import { listLeads } from "@/lib/api/marketing";
import type { Client, Lead } from "@/lib/api/types";
import { inputClass, labelClass } from "@/components/admin/form-styles";

export interface SelectedClientEntity {
  name: string;
  type: "client" | "lead" | "custom";
  id?: string;
  emails: string[];
}

export function ClientLeadSelector({
  value,
  onChange,
  onEntityChange,
  label = "Client ou Prospect",
  className,
}: {
  value: string;
  onChange: (name: string) => void;
  onEntityChange?: (entity: SelectedClientEntity) => void;
  label?: string;
  className?: string;
}) {
  const [clients, setClients] = useState<Client[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [mode, setMode] = useState<"select" | "custom">("select");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listClients().catch(() => ({ results: [] })),
      listLeads().catch(() => ({ results: [] })),
    ])
      .then(([clientsRes, leadsRes]) => {
        setClients(clientsRes.results || []);
        setLeads(leadsRes.results || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    if (val === "__custom__") {
      setMode("custom");
      return;
    }

    if (!val) {
      onChange("");
      if (onEntityChange) onEntityChange({ name: "", type: "custom", emails: [] });
      return;
    }

    const [type, id] = val.split(":");
    if (type === "client") {
      const c = clients.find((item) => item.id === id);
      if (c) {
        const name = c.company_name;
        onChange(name);
        if (onEntityChange) {
          const emails = c.email ? [c.email] : [];
          onEntityChange({ name, type: "client", id: c.id, emails });
        }
      }
    } else if (type === "lead") {
      const l = leads.find((item) => item.id === id);
      if (l) {
        const name = l.company_name || `${l.first_name} ${l.last_name}`;
        onChange(name);
        if (onEntityChange) {
          const emails: string[] = [];
          if (l.email) emails.push(l.email);
          if (l.contacts) {
            l.contacts.forEach((contact) => {
              if (contact.email && !emails.includes(contact.email)) emails.push(contact.email);
            });
          }
          onEntityChange({ name, type: "lead", id: l.id, emails });
        }
      }
    }
  }

  // Trouver si la valeur correspond à un client ou lead existant
  const matchedClient = clients.find((c) => c.company_name === value);
  const matchedLead = leads.find(
    (l) => l.company_name === value || `${l.first_name} ${l.last_name}` === value
  );

  const selectedKey = matchedClient
    ? `client:${matchedClient.id}`
    : matchedLead
    ? `lead:${matchedLead.id}`
    : mode === "custom"
    ? "__custom__"
    : "";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className={labelClass}>{label}</span>
        {mode === "select" ? (
          <button
            type="button"
            onClick={() => setMode("custom")}
            className="flex items-center gap-1 text-[0.7rem] text-primary hover:underline"
          >
            <Pencil className="size-3" /> Saisie manuelle libre
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setMode("select")}
            className="flex items-center gap-1 text-[0.7rem] text-primary hover:underline"
          >
            <Building2 className="size-3" /> Choisir dans la liste
          </button>
        )}
      </div>

      {mode === "select" ? (
        <select
          value={selectedKey}
          onChange={handleSelectChange}
          disabled={loading}
          className={inputClass}
        >
          <option value="">— Sélectionner un client ou prospect —</option>

          {clients.length > 0 && (
            <optgroup label="💼 Clients enregistrés">
              {clients.map((c) => (
                <option key={`client:${c.id}`} value={`client:${c.id}`}>
                  {c.company_name} {c.city ? `(${c.city})` : ""}
                </option>
              ))}
            </optgroup>
          )}

          {leads.length > 0 && (
            <optgroup label="🎯 Prospects (Leads)">
              {leads.map((l) => (
                <option key={`lead:${l.id}`} value={`lead:${l.id}`}>
                  {l.company_name ? `${l.company_name} — ` : ""}
                  {l.first_name} {l.last_name} ({l.status})
                </option>
              ))}
            </optgroup>
          )}

          <option value="__custom__">➕ Saisie libre personnalisée...</option>
        </select>
      ) : (
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              if (onEntityChange) {
                onEntityChange({ name: e.target.value, type: "custom", emails: [] });
              }
            }}
            placeholder="Nom de l'entreprise ou du client..."
            className={inputClass}
            autoFocus
          />
        </div>
      )}

      {value && (
        <p className="mt-1 flex items-center gap-1.5 text-[0.7rem] text-neutral-500">
          {matchedClient ? (
            <>
              <UserCheck className="size-3 text-emerald-600" />
              <span>Client identifié : {matchedClient.company_name}</span>
            </>
          ) : matchedLead ? (
            <>
              <Target className="size-3 text-primary" />
              <span>
                Prospect identifié : {matchedLead.first_name} {matchedLead.last_name}
                {matchedLead.email ? ` (${matchedLead.email})` : ""}
              </span>
            </>
          ) : (
            <span>Client libre : {value}</span>
          )}
        </p>
      )}
    </div>
  );
}
