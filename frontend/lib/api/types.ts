export interface Paginated<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface UserBrief {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface Department {
  id: string;
  name: string;
  color: string | null;
}

export type ContractType = "CDI" | "CDD" | "STAGE" | "FREELANCE";
export type ContractStatus = "ACTIF" | "TERMINE";

export interface Contract {
  id: string;
  employee: string;
  contract_type: ContractType;
  start_date: string;
  end_date: string | null;
  signed_at: string | null;
  file_url: string | null;
  status: ContractStatus;
  created_at: string;
}

export interface Payslip {
  id: string;
  employee: string;
  period_month: number;
  period_year: number;
  file_url: string;
  created_at: string;
}

export type EmployeeStatus = "ACTIF" | "INACTIF";

export interface EmployeeProfile {
  id: string;
  user: UserBrief;
  position: string;
  hire_date: string | null;
  gross_monthly_salary: string | null;
  base_hourly_cost: string | null;
  status: EmployeeStatus;
  contracts: Contract[];
  payslips: Payslip[];
  created_at: string;
}

export type LeadSource = "FORMULAIRE_CONTACT" | "FORMULAIRE_DEVIS" | "APPEL_ENTRANT" | "SITE_WEB" | "EVENEMENT";
export type LeadStatus = "NOUVEAU" | "QUALIFIE" | "PROPOSITION_EN_COURS" | "PERDU" | "CONVERTI";

export interface Lead {
  id: string;
  first_name: string;
  last_name: string;
  company_name: string;
  email: string;
  phone: string;
  source: LeadSource;
  message: string;
  status: LeadStatus;
  assigned_to: UserBrief | null;
  qualification_score: number;
  estimated_value: string | null;
  created_at: string;
}

export type BlogPostStatus = "BROUILLON" | "PUBLIE";

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  author: UserBrief | null;
  excerpt: string;
  content: Record<string, unknown>[];
  visual_icon: string;
  visual_label: string;
  visual_sublabel: string;
  tags: string[];
  status: BlogPostStatus;
  published_at: string | null;
  meta_description: string;
  created_at: string;
}

export type SocialPlatform = "LINKEDIN" | "TWITTER" | "FACEBOOK" | "INSTAGRAM" | "YOUTUBE";
export type SocialPostStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "FAILED" | "CANCELLED";

export interface SocialPost {
  id: string;
  title: string;
  content: string;
  image_path: string;
  additional_images: string[];
  platform: SocialPlatform;
  scheduled_at: string | null;
  status: SocialPostStatus;
  published_at: string | null;
  post_url: string;
  author: UserBrief | null;
  notes: string;
  tags: string[];
  created_at: string;
}

export type QuoteStatus = "BROUILLON" | "ENVOYE" | "ACCEPTE" | "REFUSE";

export interface QuoteLine {
  id: string;
  service_title: string;
  quantity: string;
  unit_price: string;
  total_line: string;
}

export interface Quote {
  id: string;
  quote_number: string;
  lead: string | null;
  created_by: UserBrief | null;
  issue_date: string;
  expiry_date: string | null;
  status: QuoteStatus;
  discount_amount: string;
  total_ht: string;
  total_ttc: string;
  tracking_token: string;
  opened_at: string | null;
  signed_at: string | null;
  parent_quote: string | null;
  version: number;
  lines: QuoteLine[];
  created_at: string;
}

export interface MarketingDashboard {
  weighted_pipeline: string;
  total_leads: number;
  leads_by_status: Record<string, number>;
  leads_by_source: Record<string, number>;
  social_posts_by_status: Record<string, number>;
  published_social_posts_by_platform: Record<string, number>;
}

export interface AuditLogEntry {
  id: string;
  user: UserBrief | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}
