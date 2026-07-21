import { apiFetch } from "@/lib/api/client";
import type { BlogPost, Lead, MarketingDashboard, PageSection, Paginated, Quote, SitePage, SocialPost } from "@/lib/api/types";

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

export interface QuoteLineInput {
  service_title: string;
  quantity: string;
  unit_price: string;
}

export interface QuoteInput {
  lead?: string | null;
  expiry_date?: string | null;
  discount_amount?: string;
  lines: QuoteLineInput[];
}

export function listQuotes() {
  return apiFetch<Paginated<Quote>>("/api/v1/marketing/quotes/");
}

export function createQuote(data: QuoteInput) {
  return apiFetch<Quote>("/api/v1/marketing/quotes/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateQuote(id: string, data: Partial<QuoteInput>) {
  return apiFetch<Quote>(`/api/v1/marketing/quotes/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteQuote(id: string) {
  return apiFetch<void>(`/api/v1/marketing/quotes/${id}/`, { method: "DELETE" });
}

export function sendQuote(id: string) {
  return apiFetch<Quote>(`/api/v1/marketing/quotes/${id}/send/`, { method: "POST" });
}

export function cloneQuote(id: string) {
  return apiFetch<Quote>(`/api/v1/marketing/quotes/${id}/clone/`, { method: "POST" });
}

export function listPageSections(page: SitePage) {
  return apiFetch<PageSection[]>(`/api/v1/marketing/cms/page-sections/?page=${page}`);
}

export interface PageSectionInput {
  is_active?: boolean;
  kicker?: string;
  title?: string;
  subtitle?: string;
  cta_label?: string;
  cta_link?: string;
  cta_secondary_label?: string;
  cta_secondary_link?: string;
  items?: Record<string, unknown>[];
}

export function updatePageSection(id: string, data: PageSectionInput) {
  return apiFetch<PageSection>(`/api/v1/marketing/cms/page-sections/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
