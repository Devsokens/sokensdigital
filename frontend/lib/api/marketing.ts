import { apiFetch } from "@/lib/api/client";
import type { BlogPost, Lead, MarketingDashboard, PageSection, Paginated, Quote, ShowcaseProject, SitePage, SiteSettings, SocialPost } from "@/lib/api/types";

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
  cover_image: string;
  content: string;
  status: string;
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

export interface ShowcaseProjectInput {
  slug?: string;
  category: string;
  sector: string;
  type: string;
  featured?: boolean;
  show_on_homepage?: boolean;
  order?: number;
  is_active?: boolean;
  status_tag?: string;
  tag?: string;
  title: string;
  description?: string;
  visual_icon?: string;
  project_url?: string;
  video_src?: string;
  images?: string[];
  scene_variants?: string[];
  client?: string;
  technologies?: string[];
  timeline?: string;
  lead_name?: string;
  lead_role?: string;
  challenge?: string;
  stats?: { value: string; label: string }[];
  solution?: string;
  solution_points?: string[];
}

export function listShowcaseProjects() {
  return apiFetch<Paginated<ShowcaseProject>>("/api/v1/marketing/cms/showcase-projects/");
}

export function createShowcaseProject(data: ShowcaseProjectInput) {
  return apiFetch<ShowcaseProject>("/api/v1/marketing/cms/showcase-projects/", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateShowcaseProject(id: string, data: Partial<ShowcaseProjectInput>) {
  return apiFetch<ShowcaseProject>(`/api/v1/marketing/cms/showcase-projects/${id}/`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function deleteShowcaseProject(id: string) {
  return apiFetch<void>(`/api/v1/marketing/cms/showcase-projects/${id}/`, { method: "DELETE" });
}

export function getSiteSettingsAdmin() {
  return apiFetch<SiteSettings>("/api/v1/marketing/cms/site-settings/");
}

export function updateSiteSettings(data: Partial<SiteSettings>) {
  return apiFetch<SiteSettings>("/api/v1/marketing/cms/site-settings/", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
