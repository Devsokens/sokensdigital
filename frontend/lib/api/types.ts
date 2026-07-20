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
