import { apiFetch } from "@/lib/api/client";
import type {
  BankEntry,
  CapitalContribution,
  CashEntry,
  Paginated,
} from "@/lib/api/types";

export function listCashEntries() {
  return apiFetch<Paginated<CashEntry>>("/api/v1/treasury/cash-entries/");
}

export interface CashEntryInput {
  type: CashEntry["type"];
  source: CashEntry["source"];
  amount: string;
  date: string;
  reference?: string;
  description?: string;
}

export function createCashEntry(data: CashEntryInput) {
  return apiFetch<CashEntry>("/api/v1/treasury/cash-entries/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function reconcileCashEntry(id: string) {
  return apiFetch<CashEntry>(`/api/v1/treasury/cash-entries/${id}/reconcile/`, { method: "POST" });
}

/** Retourne une URL Blob (voir downloadFecExport pour le même schéma
 * d'auth manuelle) — l'appelant doit déclencher le download et
 * révoquer l'URL. */
async function fetchAuthedBlob(path: string) {
  const { auth } = await import("@/lib/firebase/config");
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const response = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Téléchargement échoué (${response.status})`);
  return response.blob();
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function downloadCashVoucherPdf(entry: CashEntry) {
  const blob = await fetchAuthedBlob(`/api/v1/treasury/cash-entries/${entry.id}/export_pdf/`);
  triggerDownload(blob, `${entry.voucher_number}.pdf`);
}

export async function downloadMonthlyCashStatement(year: number, month: number, cashierName?: string) {
  const params = new URLSearchParams({ year: String(year), month: String(month) });
  if (cashierName) params.set("cashier_name", cashierName);
  const blob = await fetchAuthedBlob(`/api/v1/treasury/cash-entries/export_monthly_statement/?${params}`);
  triggerDownload(blob, `EtatCaisse_${year}${String(month).padStart(2, "0")}.pdf`);
}

export function listBankEntries() {
  return apiFetch<Paginated<BankEntry>>("/api/v1/treasury/bank-entries/");
}

export interface BankEntryInput {
  type: BankEntry["type"];
  source: BankEntry["source"];
  amount: string;
  date: string;
  reference: string;
  description?: string;
}

export function createBankEntry(data: BankEntryInput) {
  return apiFetch<BankEntry>("/api/v1/treasury/bank-entries/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function reconcileBankEntry(id: string) {
  return apiFetch<BankEntry>(`/api/v1/treasury/bank-entries/${id}/reconcile/`, { method: "POST" });
}

export function listCapitalContributions() {
  return apiFetch<Paginated<CapitalContribution>>("/api/v1/treasury/capital-contributions/");
}

export interface CapitalContributionInput {
  amount: string;
  contribution_date: string;
}

export function createCapitalContribution(data: CapitalContributionInput) {
  return apiFetch<CapitalContribution>("/api/v1/treasury/capital-contributions/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function validateCapitalContribution(id: string) {
  return apiFetch<CapitalContribution>(`/api/v1/treasury/capital-contributions/${id}/validate/`, { method: "POST" });
}

export function submitCapitalContributionForLegalRegistration(id: string) {
  return apiFetch<CapitalContribution>(
    `/api/v1/treasury/capital-contributions/${id}/submit_for_legal_registration/`,
    { method: "POST" }
  );
}

export function postCapitalContributionJournalEntry(id: string) {
  return apiFetch<{ status: string; contribution_id: string }>(
    `/api/v1/treasury/capital-contributions/${id}/post_journal_entry/`,
    { method: "POST" }
  );
}
