"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEmployee, addContract, addPayslip, updateEmployee } from "@/lib/api/hr";
import type { EmployeeProfile } from "@/lib/api/types";

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/50 focus:outline-none";

export function EmployeeDetail({ id }: { id: string }) {
  const [employee, setEmployee] = useState<EmployeeProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {employee.user.first_name} {employee.user.last_name}
        </h1>
        <p className="text-sm text-muted-foreground">{employee.user.email}</p>
      </div>

      <SalaryForm employee={employee} onSaved={load} />
      <ContractsSection employee={employee} onSaved={load} />
      <PayslipsSection employee={employee} onSaved={load} />
    </div>
  );
}

function SalaryForm({ employee, onSaved }: { employee: EmployeeProfile; onSaved: () => void }) {
  const [position, setPosition] = useState(employee.position);
  const [salary, setSalary] = useState(employee.gross_monthly_salary ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await updateEmployee(employee.id, { position, gross_monthly_salary: String(salary) });
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
      <h2 className="text-sm font-semibold text-foreground">Poste & rémunération</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Poste</span>
          <input value={position} onChange={(e) => setPosition(e.target.value)} className={inputClass} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Salaire brut mensuel</span>
          <input
            type="number"
            value={salary}
            onChange={(e) => setSalary(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Coût horaire (calculé)</span>
          <input value={employee.base_hourly_cost ?? "—"} disabled className={`${inputClass} opacity-60`} />
        </label>
      </div>
      <Button type="submit" disabled={saving} className="rounded-full px-5">
        {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
      </Button>
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
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Contrats</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="size-3.5" /> Ajouter
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Type</span>
              <select value={contractType} onChange={(e) => setContractType(e.target.value)} className={inputClass}>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="STAGE">Stage</option>
                <option value="FREELANCE">Freelance</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Date de début</span>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Lien Drive (PDF)</span>
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
          <div key={c.id} className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-sm">
            <span>{c.contract_type} — depuis {c.start_date}</span>
            <span className="text-xs text-muted-foreground">{c.status}</span>
          </div>
        ))}
        {employee.contracts.length === 0 && <p className="text-sm text-muted-foreground">Aucun contrat.</p>}
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
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Fiches de paie</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <Plus className="size-3.5" /> Ajouter
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-4 space-y-4 rounded-xl border border-white/10 bg-white/[0.02] p-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Mois</span>
              <input type="number" min={1} max={12} value={month} onChange={(e) => setMonth(Number(e.target.value))} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Année</span>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs text-muted-foreground">Lien Drive (PDF)</span>
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
            className="flex items-center justify-between rounded-lg border border-white/10 px-4 py-3 text-sm hover:border-primary/40"
          >
            <span>{p.period_month}/{p.period_year}</span>
            <span className="text-xs text-primary">Voir le PDF</span>
          </a>
        ))}
        {employee.payslips.length === 0 && <p className="text-sm text-muted-foreground">Aucune fiche de paie.</p>}
      </div>
    </div>
  );
}
