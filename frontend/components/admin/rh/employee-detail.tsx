"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEmployee, addContract, addPayslip, updateEmployee } from "@/lib/api/hr";
import type { EmployeeProfile } from "@/lib/api/types";
import { inputClass, labelClass, readOnlyInputClass, cardClass } from "@/components/admin/form-styles";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "poste", label: "Poste & rémunération" },
  { key: "contrats", label: "Contrats" },
  { key: "fiches", label: "Fiches de paie" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase() || "?";
}

export function EmployeeDetail({ id }: { id: string }) {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("poste");

  async function load() {
    try {
      setEmployee(await getEmployee(id));
    } catch {
      setError("Impossible de charger cet employé (accès refusé ou introuvable).");
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!employee) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  const isActive = employee.status === "ACTIF";
  const activeContract = employee.contracts.find((c) => c.status === "ACTIF");
  const recentPayslips = employee.payslips.slice(0, 3);

  return (
    <div>
      <Link
        href="/admin/rh"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="size-3.5" /> Employés
      </Link>

      <div className="flex items-center gap-5 rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xl font-semibold text-neutral-600">
          {initials(employee.user.first_name, employee.user.last_name)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-semibold text-neutral-900">
              {employee.user.first_name} {employee.user.last_name}
            </h1>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
                isActive ? "bg-primary/10 text-primary" : "bg-neutral-100 text-neutral-500"
              )}
            >
              <span className={cn("size-1.5 rounded-full", isActive ? "bg-primary" : "bg-neutral-300")} />
              {isActive ? "Actif" : "Inactif"}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-neutral-500">
            <span>{employee.user.email}</span>
            {employee.hire_date && <span>Depuis le {new Date(employee.hire_date).toLocaleDateString("fr-FR")}</span>}
            {employee.gross_monthly_salary && (
              <span>{Number(employee.gross_monthly_salary).toLocaleString("fr-FR")} € brut / mois</span>
            )}
          </div>
        </div>
        <Link href="/admin/messagerie">
          <Button variant="outline" className="gap-2 rounded-full px-4">
            <MessageSquare className="size-4" /> Écrire un message
          </Button>
        </Link>
      </div>

      <div className="mb-6 mt-7 flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "border-b-2 px-1 pb-2.5 mr-5 text-sm font-medium transition-colors",
              tab === t.key ? "border-primary text-neutral-900" : "border-transparent text-neutral-400 hover:text-neutral-700"
            )}
          >
            {t.label}
            {t.key === "contrats" && <span className="ml-1.5 text-neutral-300">{employee.contracts.length}</span>}
            {t.key === "fiches" && <span className="ml-1.5 text-neutral-300">{employee.payslips.length}</span>}
          </button>
        ))}
      </div>

      {tab === "poste" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
          <SalaryForm employee={employee} onSaved={load} />
          <div className="flex flex-col gap-4">
            <div className={cardClass}>
              <h2 className="mb-3.5 text-sm font-semibold text-neutral-900">Contrat en cours</h2>
              {activeContract ? (
                <div className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3">
                  <span>
                    <span className="block text-sm font-semibold text-neutral-900">{activeContract.contract_type}</span>
                    <span className="block text-xs text-neutral-400">
                      Depuis le {new Date(activeContract.start_date).toLocaleDateString("fr-FR")}
                    </span>
                  </span>
                  <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">Actif</span>
                </div>
              ) : (
                <p className="text-xs text-neutral-400">Aucun contrat actif.</p>
              )}
            </div>
            <div className={cardClass}>
              <h2 className="mb-3.5 text-sm font-semibold text-neutral-900">Dernières fiches de paie</h2>
              <div className="space-y-2">
                {recentPayslips.map((p) => (
                  <a
                    key={p.id}
                    href={p.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-2.5 text-sm text-neutral-900 hover:border-primary/40"
                  >
                    <span>{p.period_month}/{p.period_year}</span>
                    <span className="text-xs font-semibold text-primary">PDF</span>
                  </a>
                ))}
                {recentPayslips.length === 0 && <p className="text-xs text-neutral-400">Aucune fiche de paie.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "contrats" && <ContractsSection employee={employee} onSaved={load} />}
      {tab === "fiches" && <PayslipsSection employee={employee} onSaved={load} />}
    </div>
  );
}

function SalaryForm({ employee, onSaved }: { employee: EmployeeProfile; onSaved: () => void }) {
  const [position, setPosition] = useState(employee.position);
  const [salary, setSalary] = useState(employee.gross_monthly_salary ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await updateEmployee(employee.id, { position, gross_monthly_salary: String(salary) });
      onSaved();
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={`space-y-5 ${cardClass}`}>
      <h2 className="text-sm font-semibold text-neutral-900">Poste & rémunération</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>Poste</span>
          <input value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className={labelClass}>Salaire brut mensuel</span>
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className={`${inputClass} font-mono`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Coût horaire (calculé)</span>
          <input
            value={employee.base_hourly_cost ? `${Number(employee.base_hourly_cost).toFixed(2).replace(".", ",")} €` : "—"}
            disabled
            className={`${readOnlyInputClass} font-mono`}
          />
        </label>
      </div>
      <div className="flex items-center gap-3 border-t border-neutral-100 pt-4">
        <Button type="submit" disabled={saving} className="rounded-full px-6">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
        </Button>
        {saved && !saving && <span className="text-xs text-primary">Enregistré</span>}
      </div>
    </form>
  );
}

function ContractsSection({ employee, onSaved }: { employee: EmployeeProfile; onSaved: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [contractType, setContractType] = useState("CDI");
  const [startDate, setStartDate] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addContract(employee.id, {
        contract_type: contractType as "CDI" | "CDD" | "STAGE" | "FREELANCE",
        start_date: startDate,
        end_date: null,
        signed_at: null,
        file_url: fileUrl || null,
        status: "ACTIF",
      });
      setShowForm(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Contrats</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Plus className="size-3.5" /> Ajouter
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 space-y-4 rounded-xl border border-neutral-200 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Type</span>
              <select value={contractType} onChange={(e) => setContractType(e.target.value)} className={inputClass}>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="STAGE">Stage</option>
                <option value="FREELANCE">Freelance</option>
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Date de début</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} required />
            </label>
            <label className="block">
              <span className={labelClass}>Lien Drive (PDF)</span>
              <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} className={inputClass} placeholder="https://drive.google.com/..." />
            </label>
          </div>
          <Button type="submit" disabled={saving} className="rounded-full px-5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Ajouter le contrat"}
          </Button>
        </form>
      )}

      <div className="space-y-2">
        {employee.contracts.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3">
            <span className="flex items-center gap-3">
              <span className="rounded-md bg-neutral-100 px-2 py-0.5 text-xs font-semibold text-neutral-600">
                {c.contract_type}
              </span>
              <span className="text-sm text-neutral-700">depuis le {new Date(c.start_date).toLocaleDateString("fr-FR")}</span>
            </span>
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                c.status === "ACTIF" ? "bg-primary/10 text-primary" : "bg-neutral-100 text-neutral-500"
              )}
            >
              {c.status === "ACTIF" ? "Actif" : "Terminé"}
            </span>
          </div>
        ))}
        {employee.contracts.length === 0 && <p className="text-sm text-neutral-400">Aucun contrat.</p>}
      </div>
    </div>
  );
}

function PayslipsSection({ employee, onSaved }: { employee: EmployeeProfile; onSaved: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [fileUrl, setFileUrl] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await addPayslip(employee.id, { period_month: month, period_year: year, file_url: fileUrl });
      setShowForm(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-900">Fiches de paie</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
        >
          <Plus className="size-3.5" /> Ajouter
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-5 space-y-4 rounded-xl border border-neutral-200 p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className={labelClass}>Mois</span>
              <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Année</span>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputClass} />
            </label>
            <label className="block">
              <span className={labelClass}>Lien Drive (PDF)</span>
              <input value={fileUrl} onChange={(e) => setFileUrl(e.target.value)} className={inputClass} required placeholder="https://drive.google.com/..." />
            </label>
          </div>
          <Button type="submit" disabled={saving} className="rounded-full px-5">
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Ajouter la fiche"}
          </Button>
        </form>
      )}

      <div className="space-y-2">
        {employee.payslips.map((p) => (
          <a
            key={p.id}
            href={p.file_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-between rounded-xl border border-neutral-200 px-4 py-3 text-sm text-neutral-900 hover:border-primary/40"
          >
            <span>{p.period_month}/{p.period_year}</span>
            <span className="text-xs font-semibold text-primary">Voir le PDF</span>
          </a>
        ))}
        {employee.payslips.length === 0 && <p className="text-sm text-neutral-400">Aucune fiche de paie.</p>}
      </div>
    </div>
  );
}
