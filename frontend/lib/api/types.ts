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
  avatar_url: string | null;
}

export interface Department {
  id: string;
  name: string;
  color: string | null;
  member_count?: number;
  members?: UserBrief[];
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
  /** Admin-only — absent from the public serializer's response. */
  id?: string;
  title: string;
  slug: string;
  /** Admin shape: UserBrief. Public shape: a plain "First Last" string (or null). */
  author: UserBrief | string | null;
  cover_image: string;
  /** HTML from the admin's rich text editor. */
  content: string;
  /** Admin-only. */
  status?: BlogPostStatus;
  published_at: string | null;
  /** Admin-only. */
  created_at?: string;
}

export type SitePage = "ACCUEIL" | "EXPERTISE" | "SUIVI_PROJET" | "DEMARRER_PROJET";

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
  | "tracking_features"
  | "start_project_objectifs"
  | "start_project_solutions"
  | "start_project_delais"
  | "start_project_canaux";

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

export interface SiteNavLink {
  label: string;
  href: string;
}

export interface SiteServiceLink {
  label: string;
}

export interface SiteSocialLink {
  icon: string;
  url: string;
}

export interface SiteSettings {
  logo_url: string;
  tagline: string;
  services_links: SiteServiceLink[];
  legal_links: SiteNavLink[];
  social_links: SiteSocialLink[];
  copyright_text: string;
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
  description: string;
  quantity: string;
  unit_price: string;
  total_line: string;
  amount_label: string;
}

export interface QuotePaymentTerm {
  label: string;
  percentage: number;
}

export interface Quote {
  id: string;
  quote_number: string;
  lead: string | null;
  created_by: UserBrief | null;
  client_name: string;
  intro_message: string;
  subject: string;
  description: string;
  project_duration: string;
  payment_terms: QuotePaymentTerm[];
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

export interface QuoteSettings {
  company_address: string;
  company_phone: string;
  company_email: string;
  payment_methods: { label: string }[];
  default_payment_terms: QuotePaymentTerm[];
  footer_note: string;
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
export type ProjectPriority = "BASSE" | "MOYENNE" | "HAUTE";

export interface ProjectUserBrief {
  id: string;
  first_name: string;
  last_name: string;
  avatar_url: string | null;
}

export interface ProjectMember {
  id: string;
  user: ProjectUserBrief;
  created_at: string;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  category: string;
  lead_project_manager: ProjectUserBrief | null;
  members: ProjectMember[];
  start_date: string | null;
  end_date: string | null;
  budget: string | null;
  created_at: string;
  is_archived: boolean;
  is_locked: boolean;
  is_pinned: boolean;
  tasks_total: number;
  tasks_done: number;
}

export type ProjectTaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE";

export interface ProjectTask {
  id: string;
  title: string;
  status: ProjectTaskStatus;
  due_date: string | null;
  progress: number;
  assignees: ProjectUserBrief[];
  comments_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectTaskComment {
  id: string;
  body: string;
  author: ProjectUserBrief | null;
  created_at: string;
}

export type TimesheetStatus = "SOUMIS" | "VALIDE" | "REJETE";

export interface Timesheet {
  id: string;
  project: string;
  project_name: string;
  task_title: string | null;
  user: ProjectUserBrief;
  date: string;
  hours: string;
  description: string;
  status: TimesheetStatus;
  created_at: string;
}

export type TeamTimesheetDayStatus = "SOUMIS" | "VALIDE" | "REJETE" | null;
export type TeamTimesheetWeekStatus = "APPROVED" | "PARTIAL" | "REJECTED";

export interface TeamTimesheetTaskRow {
  project_name: string;
  task_title: string | null;
  daily_hours: Record<string, number>;
  total: number;
}

export interface TeamTimesheetMember {
  user: ProjectUserBrief;
  week_status: TeamTimesheetWeekStatus;
  daily_totals: Record<string, number>;
  daily_status: Record<string, TeamTimesheetDayStatus>;
  week_total: number;
  tasks: TeamTimesheetTaskRow[];
}

export interface TeamTimesheetResponse {
  week_start: string;
  days: string[];
  members: TeamTimesheetMember[];
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
