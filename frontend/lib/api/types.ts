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
  department_name: string | null;
  /** Présent seulement pour un Super-Admin (masqué aux autres par l'API). */
  is_gerant?: boolean;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  member_count?: number;
  members?: UserBrief[];
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, string[]>;
}

export type ClientStatus = "CLIENT_ACTIF" | "CLIENT_INACTIF";

/** CRM — cahier des charges §4.5. List endpoint returns a narrower shape
 * (ClientListSerializer, backend/administration/serializers.py:15-18);
 * retrieve/create/update return every field (ClientSerializer, `fields =
 * '__all__'`) — Client covers both since the narrower fields are a subset. */
export interface Client {
  id: string;
  company_name: string;
  siret: string | null;
  sector?: string;
  address?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  email?: string;
  phone?: string;
  website?: string;
  status: ClientStatus;
  rating: number | null;
  notes?: string;
  assigned_to: string | null;
  created_at: string;
}

export type ContactRole = string;

export interface ClientContact {
  id: string;
  client: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  is_primary: boolean;
}

/** Contact vu depuis l'annuaire — le client est facultatif. */
export interface DirectoryContact {
  id: string;
  client: string | null;
  client_name: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string;
  is_primary: boolean;
  notes: string;
  created_at: string;
}

export type InteractionType = "CALL" | "EMAIL" | "MEETING" | "OTHER";

export interface ClientInteractionEntry {
  id: string;
  client: string;
  contact: string | null;
  user: string | null;
  interaction_type: InteractionType;
  subject: string;
  notes: string;
  follow_up_date: string | null;
  is_locked: boolean;
  created_at: string;
  updated_at: string;
}

export type ClientDocumentType = "CONTRAT" | "DEVIS" | "FACTURE" | "AUTRE_JURIDIQUE";

export interface ClientDocumentEntry {
  id: string;
  client: string;
  name: string;
  url: string;
  file_type: ClientDocumentType;
  uploaded_by: string | null;
  is_sensitive: boolean;
  created_at: string;
  updated_at: string;
}

export interface Appointment {
  id: string;
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  location?: string;
  kind?: "RENDEZ_VOUS" | "REUNION";
  video_url?: string;
  client: string | null;
  client_name: string | null;
  attendees: string[];
  attendees_detail: UserBrief[];
  created_by: string | null;
  created_by_detail: UserBrief | null;
  created_at: string;
  updated_at: string;
}

export interface EmailTemplateEntry {
  key: string;
  label: string;
  description: string;
  variables: Record<string, string>;
  subject: string;
  body_html: string;
  is_customized: boolean;
  updated_at: string | null;
}

export interface SentEmail {
  id: string;
  recipient: string;
  subject: string;
  template_key: string;
  success: boolean;
  created_at: string;
}

export interface MeetingNote {
  id: string;
  author: string;
  author_name: string;
  body: string;
  updated_at: string;
}

export interface Meeting {
  id: string;
  appointment: string;
  title: string;
  /** Ordre du jour : un point par entrée. */
  agenda_items: string[];
  /** Ancien ordre du jour en HTML (réunions antérieures à la liste de points). */
  agenda: string;
  minutes_summary: string;
  notes: MeetingNote[];
  created_at: string;
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

export type LeadSource =
  | "FORMULAIRE_CONTACT"
  | "FORMULAIRE_DEVIS"
  | "APPEL_ENTRANT"
  | "SITE_WEB"
  | "EVENEMENT"
  /** Lead généré automatiquement par la création directe d'un client. */
  | "CREATION_CLIENT";
export type LeadStatus = "NOUVEAU" | "QUALIFIE" | "PROPOSITION_EN_COURS" | "PERDU" | "CONVERTI";

export interface LeadContactPerson {
  id?: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: string; // Ex: Directeur Marketing, Acheteur
  is_primary?: boolean;
}

export interface LeadDocumentItem {
  id?: string;
  name: string;
  url: string;
  size?: number;
  uploaded_at?: string;
}

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
  contacts?: LeadContactPerson[];
  documents?: LeadDocumentItem[];
  attachment_url?: string | null;
  attachment_name?: string | null;
  /** Client CRM issu de la conversion du lead (lecture seule). */
  client: string | null;
  client_name: string | null;
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

export type SitePage = "ACCUEIL" | "EXPERTISE" | "PROJETS" | "BLOG" | "CONTACT" | "SUIVI_PROJET" | "DEMARRER_PROJET";

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
  | "expertise_cta"
  | "projects_hero"
  | "projects_cta"
  | "blog_hero"
  | "blog_cta"
  | "contact_hero"
  | "contact_form"
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
  /** Valeurs propres à une section (voir PageSection.SectionKey côté backend),
   * ex. hero : { rotating_prefix, rotating_words }. */
  extra: Record<string, unknown>;
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

export interface SocialMediaCredentials {
  facebook_page_id: string;
  instagram_business_account_id: string;
  /** Never returned by the API — write-only. Present only so a PATCH
   * payload can type-check; GET responses never populate it. */
  facebook_access_token?: string;
  facebook_configured: boolean;
  instagram_configured: boolean;
  updated_by: UserBrief | null;
  updated_at: string;
}

export interface SiteSettings {
  logo_url: string;
  tagline: string;
  contact_email: string;
  contact_phone: string;
  services_links: SiteServiceLink[];
  legal_links: SiteNavLink[];
  social_links: SiteSocialLink[];
  copyright_text: string;
  cgu_text: string;
  cgv_text: string;
  mentions_legales_text: string;
  politique_confidentialite_text: string;
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
  /** Versions courtes pour les cartes du site vitrine. */
  summary: string;
  challenge_summary: string;
  solution_summary: string;
  /** Admin-only. */
  created_at?: string;
}

export type SocialPlatform = "FACEBOOK" | "INSTAGRAM";
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

/** What the public tracking/acceptance page gets — QuoteTrackSerializer,
 * no internal identifiers (created_by, tracking_token itself). */
export interface PublicQuote {
  quote_number: string;
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
  lines: QuoteLine[];
  signed_at: string | null;
  signature_url: string;
  company_stamp_url: string;
}

export interface Quote {
  id: string;
  quote_number: string;
  lead: string | Lead | null;
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
  sent_at: string | null;
  opened_at: string | null;
  signed_at: string | null;
  signature_url: string;
  parent_quote: string | null;
  version: number;
  document_color: string;
  lines: QuoteLine[];
  created_at: string;
  updated_at: string;
}

export type SpecType = "FONCTIONNEL" | "TECHNIQUE";
export type SpecStatus = "BROUILLON" | "FINALISE";

export interface SpecificationLine {
  id: string;
  interface_name: string;
  objective: string;
}

/** List endpoint returns SpecificationListSerializer (no lines) — the
 * shape is a strict subset of the full Specification below. */
export interface SpecificationListItem {
  id: string;
  spec_number: string;
  spec_type: SpecType;
  title: string;
  status: SpecStatus;
  created_by: UserBrief | null;
  created_at: string;
  updated_at: string;
}

export interface Specification extends SpecificationListItem {
  client_name: string;
  intro_message: string;
  description: string;
  document_color: string;
  lines: SpecificationLine[];
}

export interface QuoteSettings {
  company_address: string;
  company_phone: string;
  company_email: string;
  company_stamp_url: string;
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

/** GET /api/v1/dashboard/ — one flat snapshot per department, identical
 * for every authenticated role (no per-role filtering). See
 * backend/core/views.py::global_dashboard. */
export interface DashboardComparisonPoint {
  label: string;
  current: number;
  previous: number;
}

export interface GlobalDashboard {
  active_employees: number;
  new_hires_this_month: number;
  weighted_pipeline: string;
  total_leads: number;
  social_posts_published_this_month: number;
  cash_balance: string;
  gross_result: string;
  active_projects: number;
  pending_disbursements: number;
  open_tickets: number;
  /** Pourcentage de tickets fermés, null s'il n'y a encore aucun ticket. */
  ticket_resolution_rate: number | null;
  leads_this_month: number;
  leads_previous_month: number;
  projects_created_this_month: number;
  cash_balance_previous_month_end: string;
  avg_delivery_days: number | null;
  delivered_projects: number;
  /** Projets terminés / projets clos (terminés + annulés), en %. */
  delivery_rate: number | null;
  quotes: { signed: number; pending: number; refused: number };
  tasks: { done: number; pending: number };
  /** Séries des 12 derniers mois, mois courant en dernier. */
  trends: {
    months: string[];
    leads: number[];
    projects_created: number[];
    cash_balance: string[];
    avg_delivery_days: (number | null)[];
  };
  activity_weekly: DashboardComparisonPoint[];
  activity_monthly: DashboardComparisonPoint[];
  project_categories: { name: string; count: number; budget: string }[];
}

export type FAQAudience = "PUBLIC" | "INTERNE";

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  audience: FAQAudience;
  order: number;
  is_published: boolean;
  updated_at: string;
}

export type TicketSenderType = "VISITEUR" | "STAFF";
export type TicketStatus = "OUVERT" | "EN_COURS" | "FERME";

export interface TicketMessage {
  id: string;
  sender_type: TicketSenderType;
  author: UserBrief | null;
  body: string;
  created_at: string;
}

export interface SupportTicketListItem {
  id: string;
  visitor_name: string;
  visitor_email: string;
  subject: string;
  status: TicketStatus;
  assigned_to: UserBrief | null;
  created_at: string;
  updated_at: string;
}

export interface SupportTicket extends SupportTicketListItem {
  messages: TicketMessage[];
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

export interface ProjectDocument {
  id: string;
  original_filename: string;
  uploaded_by: ProjectUserBrief | null;
  url: string;
  created_at: string;
}

export interface ProjectClientBrief {
  id: string;
  company_name: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  cover_image_url: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  category: string;
  lead_project_manager: ProjectUserBrief | null;
  client: ProjectClientBrief | null;
  members: ProjectMember[];
  documents: ProjectDocument[];
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

/** Phase du projet (nom « Epic » conservé côté API). */
export interface Epic {
  id: string;
  title: string;
  color: string;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
}

export interface Sprint {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
}

export interface ProjectSubtask {
  id: string;
  title: string;
  is_done: boolean;
  order: number;
}

export interface ProjectTask {
  id: string;
  title: string;
  description: string;
  status: ProjectTaskStatus;
  priority: ProjectPriority | null;
  due_date: string | null;
  progress: number;
  assignees: ProjectUserBrief[];
  epic: string | null;
  sprint: string | null;
  labels: Label[];
  subtasks: ProjectSubtask[];
  comments_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectTaskComment {
  id: string;
  body: string;
  author: ProjectUserBrief | null;
  attachment_url: string | null;
  attachment_name: string;
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

export type DisbursementStatus = "EN_ATTENTE_RCF" | "EN_ATTENTE_GERANT" | "APPROUVE" | "REJETE" | "EXECUTE";

export interface DisbursementLine {
  id: string;
  label: string;
  quantity: string;
  unit_price: string;
  total: string;
}

export interface DisbursementQuote {
  id: string;
  original_filename: string;
  /** URL signée, valable quelques minutes — à utiliser aussitôt. */
  url: string;
  created_at: string;
}

/** Besoin (anciennement « demande de décaissement »). La liste renvoie
 * `quotes_count` ; le détail renvoie `quotes` avec leurs URLs. */
export interface DisbursementRequest {
  id: string;
  department_name?: string | null;
  rcf_signature_url?: string;
  gerant_signature_url?: string;
  reference: string | null;
  request_date: string;
  project: string | null;
  project_name: string | null;
  requested_by: UserBrief | null;
  amount: string;
  beneficiary: string;
  beneficiary_user: UserBrief | null;
  reason: string;
  lines: DisbursementLine[];
  quotes?: DisbursementQuote[];
  quotes_count?: number;
  status: DisbursementStatus;
  rejection_reason: string;
  rcf_decided_by: UserBrief | null;
  rcf_decided_at: string | null;
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

// --- Opérations d'achats (procurement) ---------------------------------

export interface Supplier {
  id: string;
  name: string;
  siret: string | null;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
  country: string;
  bank_account: string;
  bank_name: string;
  contact_person: string;
  is_active: boolean;
  created_at: string;
}

export type ProcurementRequestStatus =
  | "BROUILLON" | "EN_ATTENTE_RCF" | "EN_ATTENTE_MANAGER" | "APPROUVEE" | "REJETEE" | "EN_COURS" | "TERMINEE";

export interface ProcurementRequest {
  id: string;
  title: string;
  description: string;
  estimated_amount: string;
  department: string;
  department_name: string;
  requested_by: string | null;
  requested_by_name: string;
  status: ProcurementRequestStatus;
  status_display: string;
  rejection_reason: string;
  rcf_approved_at: string | null;
  rcf_approved_by: string | null;
  rcf_approved_by_name: string;
  manager_approved_at: string | null;
  manager_approved_by: string | null;
  manager_approved_by_name: string;
  created_at: string;
}

export type SupplierQuoteStatus = "BROUILLON" | "EN_ATTENTE" | "VALIDE" | "REJETE";

export interface SupplierQuote {
  id: string;
  procurement: string;
  supplier: string;
  supplier_name: string;
  quote_number: string;
  quote_date: string;
  amount_ht: string;
  vat_rate: string;
  vat_amount: string;
  amount_ttc: string;
  status: SupplierQuoteStatus;
  status_display: string;
  rcf_validated_at: string | null;
  rcf_validated_by: string | null;
  manager_validated_at: string | null;
  manager_validated_by: string | null;
  created_at: string;
}

export type SupplierInvoiceStatus = "RECUE" | "VALIDEE" | "PAYEE";

export interface SupplierInvoice {
  id: string;
  supplier: string;
  supplier_name: string;
  procurement: string;
  quote: string | null;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  amount_ht: string;
  vat_rate: string;
  vat_amount: string;
  amount_ttc: string;
  status: SupplierInvoiceStatus;
  status_display: string;
  cash_entry: string | null;
  received_by: string | null;
  received_by_name: string;
  received_at: string;
  validated_by: string | null;
  validated_by_name: string;
  validated_at: string | null;
  created_at: string;
}

// --- Trésorerie (caisse, banque, capital) -------------------------------

export type CashEntryType = "ENTREE" | "SORTIE";
export type CashEntrySource =
  | "CLIENT_ESPECES" | "RETRAIT_BANQUE" | "DEPOT_BANQUE" | "DEPENSE_OPERATIONNELLE" | "FOURNISSEUR_ESPECES";

export interface CashEntry {
  id: string;
  voucher_number: string;
  type: CashEntryType;
  type_display: string;
  source: CashEntrySource;
  source_display: string;
  amount: string;
  date: string;
  reference: string;
  description: string;
  payment: string | null;
  disbursement: string | null;
  supplier_invoice: string | null;
  created_by: string | null;
  created_by_name: string;
  reconciled_by: string | null;
  reconciled_by_name: string;
  reconciled_at: string | null;
  created_at: string;
}

export type BankEntryType = "ENTREE" | "SORTIE";
export type BankEntrySource =
  | "APPORT_CAPITAL" | "CLIENT_CHEQUE" | "CLIENT_VIREMENT" | "CAISSE_DEPOT"
  | "FOURNISSEUR_CHEQUE" | "FOURNISSEUR_VIREMENT" | "RETRAIT_ESPECES" | "AUTRE";

export interface BankEntry {
  id: string;
  type: BankEntryType;
  type_display: string;
  source: BankEntrySource;
  source_display: string;
  amount: string;
  date: string;
  reference: string;
  description: string;
  payment: string | null;
  capital_contribution: string | null;
  disbursement: string | null;
  cash_entry: string | null;
  bank_transaction: string | null;
  created_by: string | null;
  created_by_name: string;
  reconciled_by: string | null;
  reconciled_by_name: string;
  reconciled_at: string | null;
  created_at: string;
}

export type CapitalContributionStatus = "BROUILLON" | "DOCUMENTS_TRANSMIS" | "VALIDEE" | "ENREGISTREE" | "COMPTABILISEE";

export interface CapitalContribution {
  id: string;
  amount: string;
  status: CapitalContributionStatus;
  status_display: string;
  contribution_date: string;
  bank_entry: string | null;
  validated_by: string | null;
  validated_by_name: string;
  validated_at: string | null;
  posted_by: string | null;
  posted_by_name: string;
  posted_at: string | null;
  created_at: string;
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

// --- Encaissements consolidés (caisse + banque + versements) -------------

export type EncaissementOrigin = "CAISSE" | "BANQUE" | "VERSEMENT";

export interface EncaissementRow {
  id: string;
  origin: EncaissementOrigin;
  origin_label: string;
  reference: string;
  label: string;
  description: string;
  amount: string;
  date: string;
  reconciled: boolean;
}

export interface EncaissementsResponse {
  results: EncaissementRow[];
  count: number;
  totals_by_origin: Partial<Record<EncaissementOrigin, string>>;
  total: string;
  /** "caisse" quand l'utilisateur est Caissier sans rôle Finance — il ne
   * voit alors que les entrées de caisse, pas la banque ni les versements. */
  scope: "caisse" | "complet";
}

// --- Maintenance (technique) ---------------------------------------------

export type MaintainedAppType = "SITE_WEB" | "APP_WEB" | "APP_MOBILE" | "API" | "AUTRE";
export type MaintenanceFrequency = "TROIS_PAR_SEMAINE" | "HEBDOMADAIRE" | "BIMENSUELLE" | "MENSUELLE";
export type MaintenanceReportStatus = "OK" | "DEGRADE" | "INCIDENT";

/** Compte de service SANS identifiants — ce que renvoie la liste. */
export interface MaintenanceServiceAccountPublic {
  id: string;
  service_name: string;
  url: string;
}

/** Compte de service AVEC identifiants — uniquement via l'action `secrets`. */
export interface MaintenanceServiceAccount extends MaintenanceServiceAccountPublic {
  app: string;
  username: string;
  password: string;
  notes: string;
  updated_at: string;
}

export interface MaintainedApp {
  id: string;
  name: string;
  app_type: MaintainedAppType;
  url: string;
  description: string;
  client: string | null;
  client_name: string | null;
  project: string | null;
  project_name: string | null;
  tech_stack: string;
  hosting_provider: string;
  repository_url: string;
  admin_url: string;
  assigned_to: string | null;
  assigned_to_name: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  maintenance_frequency: MaintenanceFrequency;
  expected_reports_per_week: number;
  is_active: boolean;
  service_accounts: MaintenanceServiceAccountPublic[];
  last_report_at: string | null;
  last_report_status: MaintenanceReportStatus | null;
  reports_last_7_days: number;
  created_at: string;
  updated_at: string;
}

/** Identifiants de production — jamais dans une liste, obtenus à la demande
 * et journalisés côté serveur (AuditLog action=READ_SECRETS). */
export interface MaintainedAppSecrets {
  id: string;
  admin_url: string;
  admin_username: string;
  admin_password: string;
  access_notes: string;
  service_accounts: MaintenanceServiceAccount[];
}

export interface MaintenanceReport {
  id: string;
  app: string;
  app_name: string;
  performed_by: string | null;
  performed_by_name: string | null;
  performed_at: string;
  status: MaintenanceReportStatus;
  site_reachable: boolean;
  backups_verified: boolean;
  updates_applied: boolean;
  ssl_valid: boolean;
  summary: string;
  next_actions: string;
  created_at: string;
}

export type PaymentStatus = "EN_ATTENTE" | "RECU" | "ENREGISTRE";
export type PaymentMethod = "CHEQUE" | "VIREMENT" | "ESPECES" | "CARTE" | "AUTRE";

export interface PaymentReceipt {
  id: string;
  receipt_number: string;
  issued_at: string;
}

export interface Payment {
  id: string;
  invoice: string;
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  payment_method_display: string;
  status: PaymentStatus;
  status_display: string;
  received_by: UserBrief | null;
  received_at: string | null;
  notes: string;
  receipt: PaymentReceipt | null;
  /** Cumul encaissé sur la facture, tous versements confondus. */
  total_paid: string;
  /** Restant dû après ce cumul. */
  remaining: string;
  created_at: string;
}

export interface PaymentInput {
  amount: string;
  payment_date: string;
  payment_method: PaymentMethod;
  notes?: string;
}

// -------------------------------------------------------------
// MODULES OFFRES DE SERVICE & CONTRATS DE TRAVAIL
// -------------------------------------------------------------

export type ServiceProposalStatus = "BROUILLON" | "ENVOYE" | "ACCEPTE" | "REFUSE";

export interface ServiceProposalItem {
  id?: string;
  title: string;
  deliverables: string;
  duration?: string;
  price?: string;
}

export interface ServiceProposal {
  id: string;
  proposal_number: string;
  client_name: string;
  lead_id?: string | null;
  client_id?: string | null;
  title: string;
  subject?: string;
  intro_message?: string;
  context_objectives?: string;
  methodology?: string;
  deliverables_summary?: string;
  items: ServiceProposalItem[];
  pricing_notes?: string;
  terms_conditions?: string;
  valid_until?: string;
  document_color?: string;
  status: ServiceProposalStatus;
  sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

/** SALARIE : contrat de travail avec un collaborateur. CLIENT : contrat
 * commercial avec un client du CRM. Absent sur les contrats créés avant
 * l'ajout des contrats clients — à lire comme SALARIE. */
export type ContractPartyType = "SALARIE" | "CLIENT";

export type EmploymentContractType =
  | "CDI"
  | "CDD"
  | "STAGE"
  | "PRESTATION_FREELANCE"
  // Contrats clients
  | "PRESTATION_SERVICES"
  | "MAINTENANCE"
  | "CONFIDENTIALITE";
export type EmploymentContractStatus = "BROUILLON" | "ACTIF" | "TERMINE" | "ENVOYE";

export interface EmploymentContractClause {
  id?: string;
  title: string;
  content: string;
}

export interface EmploymentContractDocument {
  id: string;
  contract_number: string;
  party_type?: ContractPartyType;
  /** Contrat client : client CRM sélectionné et ses coordonnées au moment
   * de la rédaction (copiées, le document ne doit pas changer si la fiche
   * client est modifiée ensuite). */
  client_id?: string | null;
  client_name?: string;
  client_address?: string;
  client_email?: string;
  client_phone?: string;
  /** Signataire côté client. */
  client_representative?: string;
  /** Objet de la prestation. */
  service_description?: string;
  contract_amount?: string;
  payment_terms?: string;
  /** Contrat salarié : nom du salarié. Contrat client : raison sociale du
   * client, pour que listes et e-mails aient toujours un nom à afficher. */
  employee_name: string;
  employee_email?: string;
  employee_phone?: string;
  employee_address?: string;
  contract_type: EmploymentContractType;
  position: string;
  department?: string;
  start_date: string;
  end_date?: string;
  trial_period?: string;
  monthly_salary: string;
  benefits?: string;
  working_hours?: string;
  workplace?: string;
  clauses: EmploymentContractClause[];
  status: EmploymentContractStatus;
  document_color?: string;
  sent_at?: string | null;
  created_at: string;
  updated_at: string;
}

