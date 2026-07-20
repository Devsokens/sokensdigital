import { apiFetch } from "@/lib/api/client";
import type { BlogPost, Lead, MarketingDashboard, Paginated, SocialPost } from "@/lib/api/types";

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

export interface SocialPostInput {
  title: string;
  content: string;
  image_path?: string;
  additional_images?: string[];
  platform: string;
  scheduled_at?: string | null;
  notes?: string;
  tags?: string[];
}

export function listSocialPosts() {
  return apiFetch<Paginated<SocialPost>>("/api/v1/marketing/social-posts/");
}

export function createSocialPost(data: SocialPostInput) {
  return apiFetch<SocialPost>("/api/v1/marketing/social-posts/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateSocialPost(id: string, data: Partial<SocialPostInput>) {
  return apiFetch<SocialPost>(`/api/v1/marketing/social-posts/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteSocialPost(id: string) {
  return apiFetch<void>(`/api/v1/marketing/social-posts/${id}/`, { method: "DELETE" });
}

export function scheduleSocialPost(id: string) {
  return apiFetch<SocialPost>(`/api/v1/marketing/social-posts/${id}/schedule/`, { method: "POST" });
}

export function cancelSocialPost(id: string) {
  return apiFetch<SocialPost>(`/api/v1/marketing/social-posts/${id}/cancel/`, { method: "POST" });
}

export function getMarketingDashboard() {
  return apiFetch<MarketingDashboard>("/api/v1/marketing/dashboard/");
}
