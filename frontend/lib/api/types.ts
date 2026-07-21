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

export type SitePage = "ACCUEIL" | "EXPERTISE" | "SUIVI_PROJET";

export type SectionKey =
  | "hero"
  | "services"
  | "recent_projects"
  | "testimonials"
  | "team"
  | "partner_logos"
  | "blog_insights"
  | "cta"
  | "expertise_hero"
  | "strategic_advantages"
  | "process_timeline"
  | "tech_stack"
  | "featured_case_study"
  | "tracking_hero"
  | "tracking_features";

export interface PageSection {
  id: string;
  page: SitePage;
  section_key: SectionKey;
  order: number;
  is_active: boolean;
  kicker: string;
  title: string;
  subtitle: string;
  cta_label: string;
  cta_link: string;
  cta_secondary_label: string;
  cta_secondary_link: string;
  items: Record<string, unknown>[];
  created_at: string;
}

export interface ShowcaseProjectStat {
  value: string;
  label: string;
}

export interface ShowcaseProject {
  /** Admin-only — absent from the public serializer's response. */
  id?: string;
  slug: string;
  category: string;
  sector: string;
  type: string;
  featured: boolean;
  /** Admin-only. */
  show_on_homepage?: boolean;
  /** Admin-only. */
  order?: number;
  /** Admin-only. */
  is_active?: boolean;
  status_tag: string;
  tag: string;
  title: string;
  description: string;
  visual_icon: string;
  /** The live/deployed product itself — not this site's own detail page. */
  project_url: string;
  video_src: string;
  images: string[];
  scene_variants: string[];
  client: string;
  technologies: string[];
  timeline: string;
  lead_name: string;
  lead_role: string;
  challenge: string;
  stats: ShowcaseProjectStat[];
  solution: string;
  solution_points: string[];
  /** Admin-only. */
  created_at?: string;
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

export interface LeadsOverTimePoint {
  date: string;
  count: number;
}

export interface MarketingDashboard {
  weighted_pipeline: string;
  total_leads: number;
  conversion_rate: string;
  leads_by_status: Record<string, number>;
  leads_by_source: Record<string, number>;
  leads_over_time: LeadsOverTimePoint[];
  social_posts_by_status: Record<string, number>;
  published_social_posts_by_platform: Record<string, number>;
}

export type ProjectStatus = "EN_COURS" | "EN_PAUSE" | "TERMINE" | "ANNULE";

export interface ProjectMember {
  id: string;
  user: UserBrief;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  lead_project_manager: UserBrief | null;
  members: ProjectMember[];
  start_date: string | null;
  end_date: string | null;
  budget: string | null;
  created_at: string;
}

export type TimesheetStatus = "SOUMIS" | "VALIDE" | "REJETE";

export interface Timesheet {
  id: string;
  project: string;
  user: UserBrief;
  date: string;
  hours: string;
  description: string;
  status: TimesheetStatus;
  created_at: string;
}

export type DisbursementStatus = "EN_ATTENTE_N1" | "EN_ATTENTE_N2" | "APPROUVE" | "REJETE" | "EXECUTE";

export interface DisbursementRequest {
  id: string;
  project: string | null;
  requested_by: UserBrief | null;
  amount: string;
  beneficiary: string;
  reason: string;
  status: DisbursementStatus;
  decided_by: UserBrief | null;
  decided_at: string | null;
  executed_by: UserBrief | null;
  executed_at: string | null;
  created_at: string;
}

export type AccountingPeriodStatus = "OUVERTE" | "CLOTUREE";

export interface AccountingPeriod {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  status: AccountingPeriodStatus;
  closed_by: UserBrief | null;
  closed_at: string | null;
  created_at: string;
}

export type AccountClass = "ACTIF" | "PASSIF" | "CHARGE" | "PRODUIT" | "TVA";

export interface Account {
  id: string;
  code: string;
  name: string;
  account_class: AccountClass;
}

export interface TransactionLine {
  id: string;
  account: string;
  account_code: string;
  account_name: string;
  label: string;
  debit: string;
  credit: string;
  lettrage_code: string;
}

export type JournalCode = "VE" | "AC" | "BQ" | "OD";

export interface JournalEntry {
  id: string;
  period: string;
  journal_code: JournalCode;
  date: string;
  label: string;
  created_by: UserBrief | null;
  source_invoice: string | null;
  is_locked: boolean;
  lines: TransactionLine[];
  created_at: string;
}

export type InvoiceStatus = "BROUILLON" | "VALIDEE";

export interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  issue_date: string;
  due_date: string | null;
  amount_ht: string;
  vat_rate: string;
  amount_ttc: string;
  status: InvoiceStatus;
  created_by: UserBrief | null;
  validated_by: UserBrief | null;
  validated_at: string | null;
  created_at: string;
}

export type BankTransactionStatus = "NON_LETTRE" | "LETTRE";

export interface BankTransaction {
  id: string;
  date: string;
  label: string;
  amount: string;
  matched_line: string | null;
  status: BankTransactionStatus;
}

export interface BankStatementImport {
  id: string;
  filename: string;
  imported_by: UserBrief | null;
  transactions: BankTransaction[];
  created_at: string;
}

export type TaxDeclarationStatus = "BROUILLON" | "VALIDEE";

export interface TaxDeclaration {
  id: string;
  period: string;
  period_label: string;
  status: TaxDeclarationStatus;
  collected_vat: string;
  deductible_vat: string;
  net_vat: string;
  generated_by: UserBrief | null;
  validated_by: UserBrief | null;
  validated_at: string | null;
  created_at: string;
}

export interface FinanceDashboard {
  cash_balance: string;
  gross_result: string;
  dso_days: number | null;
  executed_disbursements_by_project: Record<string, string>;
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
