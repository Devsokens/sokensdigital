import { apiFetch } from "@/lib/api/client";
import type { BlogPost, Lead, Paginated } from "@/lib/api/types";

export function listLeads() {
  return apiFetch<Paginated<Lead>>("/api/v1/marketing/leads/");
}

export function updateLead(id: string, data: Partial<{
  status: string;
  qualification_score: number;
  assigned_to_id: string | null;
}>) {
  return apiFetch<Lead>(`/api/v1/marketing/leads/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export interface BlogPostInput {
  title: string;
  excerpt: string;
  content: Record<string, unknown>[];
  visual_icon: string;
  visual_label: string;
  visual_sublabel: string;
  tags: string[];
  status: string;
  meta_description: string;
}

export function listBlogPosts() {
  return apiFetch<Paginated<BlogPost>>("/api/v1/marketing/cms/blog/");
}

export function createBlogPost(data: BlogPostInput) {
  return apiFetch<BlogPost>("/api/v1/marketing/cms/blog/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateBlogPost(id: string, data: Partial<BlogPostInput>) {
  return apiFetch<BlogPost>(`/api/v1/marketing/cms/blog/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteBlogPost(id: string) {
  return apiFetch<void>(`/api/v1/marketing/cms/blog/${id}/`, { method: "DELETE" });
}
