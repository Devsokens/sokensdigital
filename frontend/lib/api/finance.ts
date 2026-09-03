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

export function listDisbursementRequests() {
  return apiFetch<Paginated<DisbursementRequest>>("/api/v1/finance/disbursement-requests/");
}

export function createDisbursementRequest(data: {
  project_id: string;
  amount: string;
  beneficiary: string;
  reason: string;
}) {
  return apiFetch<DisbursementRequest>("/api/v1/finance/disbursement-requests/", {
    method: "POST",
    body: JSON.stringify(data),
  });
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
