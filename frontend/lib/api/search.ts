import { apiFetch } from "@/lib/api/client";

export interface SearchResult {
  category: string;
  label: string;
  sublabel: string;
  href: string;
}

export function globalSearch(query: string) {
  return apiFetch<SearchResult[]>(`/api/v1/search/?q=${encodeURIComponent(query)}`);
}
