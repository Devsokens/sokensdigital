import { apiFetch } from "@/lib/api/client";
import type {
  Account,
  AccountingPeriod,
  BankStatementImport,
  BankTransaction,
  DisbursementRequest,
  FinanceDashboard,
  Invoice,
  JournalEntry,
  Paginated,
  TaxDeclaration,
  TransactionLine,
  EncaissementsResponse,
  Payment,
  PaymentInput,
} from "@/lib/api/types";

const DISBURSEMENTS = "/api/v1/finance/disbursement-requests";

export function listDisbursementRequests() {
  return apiFetch<Paginated<DisbursementRequest>>(`${DISBURSEMENTS}/`);
}

/** Détail, avec les devis et leurs URLs signées (la liste n'en donne que le nombre). */
export function getDisbursementRequest(id: string) {
  return apiFetch<DisbursementRequest>(`${DISBURSEMENTS}/${id}/`);
}

export interface BesoinLineInput {
  label: string;
  quantity: string;
  unit_price: string;
}

export function createDisbursementRequest(data: {
  request_date: string;
  project_id: string | null;
  beneficiary_user_id: string | null;
  lines: BesoinLineInput[];
}) {
  return apiFetch<DisbursementRequest>(`${DISBURSEMENTS}/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

async function authHeaders(): Promise<Record<string, string>> {
  const { auth } = await import("@/lib/firebase/config");
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function errorDetail(response: Response, fallback: string) {
  try {
    const body = await response.json();
    if (body.detail) return String(body.detail);
  } catch {
    // pas de corps JSON
  }
  return fallback;
}

/** Multipart — pas apiFetch(), qui force Content-Type: application/json. */
export async function uploadDisbursementQuote(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${API_BASE}${DISBURSEMENTS}/${id}/quotes/`, {
    method: "POST",
    headers: await authHeaders(),
    body: formData,
  });
  if (!response.ok) throw new Error(await errorDetail(response, `Envoi du devis échoué (${response.status})`));
  return response.json();
}

export function deleteDisbursementQuote(id: string, quoteId: string) {
  return apiFetch<void>(`${DISBURSEMENTS}/${id}/quotes/${quoteId}/`, { method: "DELETE" });
}

/** Bon de demande en PDF, en Blob : le lien ne peut pas porter le jeton
 * Firebase, donc on le récupère nous-mêmes (même schéma que les pièces de
 * caisse, lib/api/treasury.ts). */
export async function fetchBesoinPdf(id: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}${DISBURSEMENTS}/${id}/pdf/`, { headers: await authHeaders() });
  if (!response.ok) throw new Error(await errorDetail(response, `PDF indisponible (${response.status})`));
  return response.blob();
}

/** Un devis stocké : son URL signée force le téléchargement, on le
 * récupère en Blob pour pouvoir aussi l'afficher dans la visionneuse. */
export async function fetchQuoteFile(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Devis indisponible (${response.status})`);
  return response.blob();
}

export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function approveDisbursementRequest(id: string, decision: "APPROUVE" | "REJETE", rejectionReason?: string) {
  return apiFetch<DisbursementRequest>(`/api/v1/finance/disbursement-requests/${id}/approve/`, {
    method: "POST",
    body: JSON.stringify({ decision, rejection_reason: rejectionReason }),
  });
}

export function executeDisbursementRequest(id: string) {
  return apiFetch<DisbursementRequest>(`/api/v1/finance/disbursement-requests/${id}/execute/`, {
    method: "POST",
  });
}

export function listAccountingPeriods() {
  return apiFetch<Paginated<AccountingPeriod>>("/api/v1/finance/accounting-periods/");
}

export function createAccountingPeriod(data: { label: string; start_date: string; end_date: string }) {
  return apiFetch<AccountingPeriod>("/api/v1/finance/accounting-periods/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function closeAccountingPeriod(id: string) {
  return apiFetch<AccountingPeriod>(`/api/v1/finance/accounting-periods/${id}/close/`, { method: "POST" });
}

export function reopenAccountingPeriod(id: string) {
  return apiFetch<AccountingPeriod>(`/api/v1/finance/accounting-periods/${id}/reopen/`, { method: "POST" });
}

export function listAccounts() {
  return apiFetch<Paginated<Account>>("/api/v1/finance/accounts/");
}

export function createAccount(data: { code: string; name: string; account_class: Account["account_class"] }) {
  return apiFetch<Account>("/api/v1/finance/accounts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listJournalEntries() {
  return apiFetch<Paginated<JournalEntry>>("/api/v1/finance/journal-entries/");
}

export interface JournalEntryInput {
  period: string;
  journal_code: JournalEntry["journal_code"];
  date: string;
  label: string;
  lines: Pick<TransactionLine, "account" | "label" | "debit" | "credit">[];
}

export function createJournalEntry(data: JournalEntryInput) {
  return apiFetch<JournalEntry>("/api/v1/finance/journal-entries/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listInvoices() {
  return apiFetch<Paginated<Invoice>>("/api/v1/finance/invoices/");
}

export interface InvoiceInput {
  client_name: string;
  issue_date: string;
  due_date?: string | null;
  amount_ht: string;
  vat_rate?: string;
}

export function createInvoice(data: InvoiceInput) {
  return apiFetch<Invoice>("/api/v1/finance/invoices/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function validateInvoice(id: string) {
  return apiFetch<Invoice>(`/api/v1/finance/invoices/${id}/validate/`, { method: "POST" });
}

export function listBankImports() {
  return apiFetch<Paginated<BankStatementImport>>("/api/v1/finance/bank-imports/");
}

export function importBankStatement(data: {
  filename: string;
  rows: { date: string; label: string; amount: string }[];
}) {
  return apiFetch<BankStatementImport>("/api/v1/finance/bank-imports/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getBankTransactionSuggestions(importId: string, transactionId: string) {
  return apiFetch<TransactionLine[]>(
    `/api/v1/finance/bank-imports/${importId}/transactions/${transactionId}/suggestions/`
  );
}

export function matchBankTransaction(importId: string, transactionId: string, lineId: string) {
  return apiFetch<BankTransaction>(
    `/api/v1/finance/bank-imports/${importId}/transactions/${transactionId}/match/`,
    { method: "POST", body: JSON.stringify({ line_id: lineId }) }
  );
}

export function listTaxDeclarations() {
  return apiFetch<Paginated<TaxDeclaration>>("/api/v1/finance/tax-declarations/");
}

export function generateTaxDeclaration(periodId: string) {
  return apiFetch<TaxDeclaration>("/api/v1/finance/tax-declarations/generate/", {
    method: "POST",
    body: JSON.stringify({ period_id: periodId }),
  });
}

export function validateTaxDeclaration(id: string) {
  return apiFetch<TaxDeclaration>(`/api/v1/finance/tax-declarations/${id}/validate/`, { method: "POST" });
}

/** The FEC endpoint returns a plain-text attachment and requires the same
 * Firebase Bearer auth as every other endpoint — a plain <a href> can't
 * carry that header, so this fetches it manually and triggers the download
 * client-side via a Blob URL. */
export async function downloadFecExport(periodId: string, periodLabel: string) {
  const { auth } = await import("@/lib/firebase/config");
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;

  const response = await fetch(`${base}/api/v1/finance/accounting-periods/${periodId}/fec-export/`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error(`Export FEC échoué (${response.status})`);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `FEC_${periodLabel}.txt`;
  link.click();
  URL.revokeObjectURL(url);
}

export function getFinanceDashboard() {
  return apiFetch<FinanceDashboard>("/api/v1/finance/dashboard/");
}

export function getEncaissements(params?: { date_from?: string; date_to?: string }) {
  const qs = new URLSearchParams();
  if (params?.date_from) qs.set("date_from", params.date_from);
  if (params?.date_to) qs.set("date_to", params.date_to);
  const suffix = qs.toString() ? `?${qs}` : "";
  return apiFetch<EncaissementsResponse>(`/api/v1/finance/encaissements/${suffix}`);
}

// --- Versements (paiements partiels d'une facture) ---

export function listPayments(invoiceId: string) {
  return apiFetch<Paginated<Payment>>(`/api/v1/finance/invoices/${invoiceId}/payments/`);
}

export function createPayment(invoiceId: string, data: PaymentInput) {
  return apiFetch<Payment>(`/api/v1/finance/invoices/${invoiceId}/payments/`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function receivePayment(invoiceId: string, paymentId: string) {
  return apiFetch<Payment>(
    `/api/v1/finance/invoices/${invoiceId}/payments/${paymentId}/receive/`,
    { method: "POST", body: JSON.stringify({}) },
  );
}
