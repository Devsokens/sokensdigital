import { apiFetch } from "@/lib/api/client";
import type { DisbursementRequest, Paginated } from "@/lib/api/types";

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
