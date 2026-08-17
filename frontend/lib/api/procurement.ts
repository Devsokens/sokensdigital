import { apiFetch } from "@/lib/api/client";
import type {
  Paginated,
  ProcurementRequest,
  Supplier,
  SupplierInvoice,
  SupplierQuote,
} from "@/lib/api/types";

export function listSuppliers() {
  return apiFetch<Paginated<Supplier>>("/api/v1/procurement/suppliers/");
}

export interface SupplierInput {
  name: string;
  email: string;
  phone: string;
  address: string;
  city?: string;
  postal_code?: string;
  country?: string;
  bank_account: string;
  bank_name?: string;
  contact_person: string;
  siret?: string | null;
}

export function createSupplier(data: SupplierInput) {
  return apiFetch<Supplier>("/api/v1/procurement/suppliers/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function listProcurementRequests() {
  return apiFetch<Paginated<ProcurementRequest>>("/api/v1/procurement/procurements/");
}

export interface ProcurementRequestInput {
  title: string;
  description: string;
  estimated_amount: string;
  department: string;
}

export function createProcurementRequest(data: ProcurementRequestInput) {
  return apiFetch<ProcurementRequest>("/api/v1/procurement/procurements/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function approveProcurementRcf(id: string) {
  return apiFetch<ProcurementRequest>(`/api/v1/procurement/procurements/${id}/approve_rcf/`, { method: "POST" });
}

export function rejectProcurementRcf(id: string, reason: string) {
  return apiFetch<ProcurementRequest>(`/api/v1/procurement/procurements/${id}/reject_rcf/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function approveProcurementManager(id: string) {
  return apiFetch<ProcurementRequest>(`/api/v1/procurement/procurements/${id}/approve_manager/`, { method: "POST" });
}

export function rejectProcurementManager(id: string, reason: string) {
  return apiFetch<ProcurementRequest>(`/api/v1/procurement/procurements/${id}/reject_manager/`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
}

export function listSupplierQuotes() {
  return apiFetch<Paginated<SupplierQuote>>("/api/v1/procurement/quotes/");
}

export interface SupplierQuoteInput {
  procurement: string;
  supplier: string;
  quote_date: string;
  amount_ht: string;
  vat_rate?: string;
}

export function createSupplierQuote(data: SupplierQuoteInput) {
  return apiFetch<SupplierQuote>("/api/v1/procurement/quotes/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function validateSupplierQuoteRcf(id: string) {
  return apiFetch<SupplierQuote>(`/api/v1/procurement/quotes/${id}/validate_rcf/`, { method: "POST" });
}

export function validateSupplierQuoteManager(id: string) {
  return apiFetch<SupplierQuote>(`/api/v1/procurement/quotes/${id}/validate_manager/`, { method: "POST" });
}

export function rejectSupplierQuote(id: string) {
  return apiFetch<SupplierQuote>(`/api/v1/procurement/quotes/${id}/reject/`, { method: "POST" });
}

export function listSupplierInvoices() {
  return apiFetch<Paginated<SupplierInvoice>>("/api/v1/procurement/invoices/");
}

export interface SupplierInvoiceInput {
  supplier: string;
  procurement: string;
  quote?: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date?: string | null;
  amount_ht: string;
  vat_rate?: string;
}

export function createSupplierInvoice(data: SupplierInvoiceInput) {
  return apiFetch<SupplierInvoice>("/api/v1/procurement/invoices/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function validateSupplierInvoice(id: string) {
  return apiFetch<SupplierInvoice>(`/api/v1/procurement/invoices/${id}/validate/`, { method: "POST" });
}
