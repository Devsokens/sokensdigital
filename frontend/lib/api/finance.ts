import { apiFetch } from "@/lib/api/client";
import type {
  InvoiceExtraTax,
  Account,
  AccountingPeriod,
  BankStatementImport,
  BankTransaction,
  DisbursementRequest,
  FinanceDashboard,
  Invoice,
  InvoiceLine,
  JournalEntry,
  Paginated,
  TaxDeclaration,
  TransactionLine,
  EncaissementsResponse,
  Payment,
  PaymentInput,
} from "@/lib/api/types";

const DISBURSEMENTS = "/api/v1/finance/disbursement-requests";

/** `scope: "department"` : interface Besoins d'un département (mes
 * demandes et celles de mon département) ; sans scope : tout ce que mon
 * rôle permet de voir (Finance : toutes les demandes). */
export function listDisbursementRequests(params?: { scope?: "department" }) {
  const qs = new URLSearchParams({ page_size: "500" });
  if (params?.scope) qs.set("scope", params.scope);
  return apiFetch<Paginated<DisbursementRequest>>(`${DISBURSEMENTS}/?${qs}`);
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

/** Approuver exige la signature manuscrite (PNG base64 du pad). */
export function approveDisbursementRequest(
  id: string,
  decision: "APPROUVE" | "REJETE",
  rejectionReason?: string,
  signature?: string,
) {
  return apiFetch<DisbursementRequest>(`/api/v1/finance/disbursement-requests/${id}/approve/`, {
    method: "POST",
    body: JSON.stringify({ decision, rejection_reason: rejectionReason, signature }),
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

/** Super-Admin uniquement ; `confirm` = libellé exact de la période. */
export function deleteAccountingPeriod(id: string, confirm: string) {
  return apiFetch<void>(`/api/v1/finance/accounting-periods/${id}/`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirm }),
  });
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
  /** Facultatif quand des lignes sont fournies (le HT en est la somme). */
  amount_ht?: string;
  vat_rate?: string;
  css_rate?: string;
  extra_taxes?: InvoiceExtraTax[];
  lines?: InvoiceLine[];
  discount_amount?: string;
  discount_reason?: string;
  document_color?: string;
  /** Devis d'origine, quand la facture en a repris les lignes. */
  quote?: string | null;
}

/** Données de l'éditeur : devis récupérables et coordonnées de la société. */
export interface InvoiceEditorContext {
  settings: {
    company_address: string;
    company_phone: string;
    company_email: string;
    company_rccm: string;
    company_nif: string;
    company_stamp_url: string;
    payment_methods: { label: string }[];
    /** Note de bas de page des factures (distincte de celle des devis). */
    invoice_footer_note?: string;
  };
  /** Taux par défaut des nouvelles factures (paramètres Finance). */
  tax_rates?: { vat_rate: string; css_rate: string; extra_taxes?: ExtraTaxSetting[] };
  quotes: {
    id: string;
    quote_number: string;
    client_name: string;
    status: string;
    document_color: string;
    lines: InvoiceLine[];
    /** Remise du devis, reprise comme réduction de la facture. */
    discount_amount: string;
    /** Total du devis (lignes − remise) : base des acomptes. */
    total: string;
    payment_terms: { label: string; percentage: number }[];
  }[];
}

/** Envoie la facture par e-mail : PDF de la facture, et celui du devis lié.
 * `email_warning` : envoi impossible vers certaines adresses. */
export function sendInvoice(id: string, options: { recipient_emails: string[]; message?: string }) {
  return apiFetch<Invoice & { email_warning?: string }>(`/api/v1/finance/invoices/${id}/send/`, {
    method: "POST",
    body: JSON.stringify(options),
  });
}

/** Enregistre le reste dû comme versement reçu (avec reçu). */
export function markInvoicePaid(id: string, paymentMethod?: string) {
  return apiFetch<Invoice>(`/api/v1/finance/invoices/${id}/mark-paid/`, {
    method: "POST",
    body: JSON.stringify(paymentMethod ? { payment_method: paymentMethod } : {}),
  });
}

/** Suppression propre (versements, reçus, écritures) ; 409 avec le motif
 * si la comptabilité ne peut pas être défaite sans la fausser. */
export function deleteInvoice(id: string) {
  return apiFetch<void>(`/api/v1/finance/invoices/${id}/`, { method: "DELETE" });
}

export function getInvoice(id: string) {
  return apiFetch<Invoice>(`/api/v1/finance/invoices/${id}/`);
}

export function updateInvoice(id: string, data: Partial<InvoiceInput>) {
  return apiFetch<Invoice>(`/api/v1/finance/invoices/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function getInvoiceFiscal(id: string) {
  return apiFetch<import("@/components/admin/finance/invoice-document").InvoiceFiscal>(`/api/v1/finance/invoices/${id}/fiscal/`);
}

export function getInvoiceEditorContext() {
  return apiFetch<InvoiceEditorContext>("/api/v1/finance/invoices/editor-context/");
}

/** Télécharge le PDF de la facture. */
export function downloadInvoicePdf(id: string, invoiceNumber: string) {
  return downloadPdf(`/api/v1/finance/invoices/${id}/pdf/`, `${invoiceNumber}.pdf`);
}

/** Télécharge le reçu d'un versement (une fois le versement marqué reçu). */
export function downloadPaymentReceipt(invoiceId: string, paymentId: string, receiptNumber: string) {
  return downloadPdf(`/api/v1/finance/invoices/${invoiceId}/payments/${paymentId}/receipt/`, `${receiptNumber}.pdf`);
}

/** fetch direct : apiFetch lit du JSON, ici la réponse est un fichier. */
async function downloadPdf(path: string, filename: string) {
  const { auth } = await import("@/lib/firebase/config");
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
  const response = await fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) {
    let detail = "";
    try {
      detail = (await response.json())?.detail ?? "";
    } catch {
      // réponse non JSON (page d'erreur)
    }
    throw new Error(detail || `Téléchargement du PDF impossible (erreur ${response.status}).`);
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
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


/** Autre taxe des paramètres Finance : enabled = appliquée d'office aux nouvelles factures. */
export interface ExtraTaxSetting {
  name: string;
  percent: string;
  enabled: boolean;
}

export interface TaxRates {
  vat_rate: string;
  css_rate: string;
  extra_taxes: ExtraTaxSetting[];
  updated_at?: string;
}

/** Taux de TVA et de CSS appliqués par défaut aux nouvelles factures. */
export function getTaxRates() {
  return apiFetch<TaxRates>("/api/v1/finance/settings/tax-rates/");
}

/** Comptable / Super-Admin uniquement (403 sinon). */
export function updateTaxRates(data: Partial<TaxRates>) {
  return apiFetch<TaxRates>("/api/v1/finance/settings/tax-rates/", { method: "PATCH", body: JSON.stringify(data) });
}
