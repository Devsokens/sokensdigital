"use client";

import type {
  ServiceProposal,
  ServiceProposalItem,
  EmploymentContractDocument,
  EmploymentContractClause,
} from "./types";
import { sendDocumentEmail } from "./marketing";

// Clés localStorage pour la persistance locale des modules
const PROPOSALS_STORAGE_KEY = "sokens_service_proposals";
const CONTRACTS_STORAGE_KEY = "sokens_employment_contracts";

const DEFAULT_PROPOSAL_ITEMS: ServiceProposalItem[] = [
  {
    title: "Phase 1 : Cadrage, Conception UX/UI & Architecture",
    deliverables: "Wireframes interactifs, charte graphique Figma, spécifications fonctionnelles et techniques.",
    duration: "2 semaines",
    price: "750 000 FCFA",
  },
  {
    title: "Phase 2 : Développement Fullstack & Intégration API",
    deliverables: "Application web responsive, dashboard d'administration, API sécurisée, tests unitaires.",
    duration: "4 semaines",
    price: "1 850 000 FCFA",
  },
  {
    title: "Phase 3 : Recette, Déploiement & Formation",
    deliverables: "Mise en production, configuration domaine et SSL, session de formation utilisateurs.",
    duration: "1 semaine",
    price: "400 000 FCFA",
  },
];

const DEFAULT_CONTRACT_CLAUSES: EmploymentContractClause[] = [
  {
    title: "Article 1 : Fonctions et missions",
    content:
      "Le Salarié est engagé en qualité de Collaborateur. Il exercera ses fonctions sous l'autorité et selon les directives de la Direction générale de SOKEN'S DIGITAL. Ses attributions comprennent la réalisation des projets techniques et stratégiques qui lui sont confiés.",
  },
  {
    title: "Article 2 : Horaires et lieu de travail",
    content:
      "La durée hebdomadaire de travail est fixée conformément aux dispositions légales en vigueur (40 heures par semaine). Les fonctions seront exercées dans les locaux de l'entreprise ou en formule hybride / télétravail après accord préalable de la Direction.",
  },
  {
    title: "Article 3 : Rémunération",
    content:
      "En contrepartie de ses fonctions, le Salarié percevra une rémunération brute mensuelle convenue, payée à la fin de chaque mois civil, sous déduction des cotisations sociales obligatoires.",
  },
  {
    title: "Article 4 : Confidentialité et secret professionnel",
    content:
      "Le Salarié s'engage expressément à observer la plus stricte discrétion sur toutes les informations, procédés, codes sources, méthodes et affaires dont il pourrait avoir connaissance au sein de SOKEN'S DIGITAL, tant pendant l'exécution du contrat qu'après sa rupture.",
  },
  {
    title: "Article 5 : Propriété intellectuelle",
    content:
      "Tous les droits d'auteur, inventions, développements logiciels et créations réalisés par le Salarié dans le cadre de ses fonctions sont la propriété exclusive de SOKEN'S DIGITAL.",
  },
];

const INITIAL_PROPOSALS: ServiceProposal[] = [
  {
    id: "prop-1",
    proposal_number: "PROP-2026-0001",
    client_name: "Africa Logistics & Transport",
    title: "Plateforme digitale de gestion de flotte et suivi en temps réel",
    subject: "Proposition d'accompagnement pour la modernisation du SI logistique",
    intro_message:
      "Dans le cadre de votre stratégie de digitalisation, Soken's Digital a le plaisir de vous soumettre cette offre de services pour la conception et le déploiement de votre nouvelle plateforme logistique.",
    context_objectives:
      "Optimiser la visibilité sur la flotte en temps réel, automatiser les rapports d'activité et réduire les délais de traitement des commandes de transport.",
    methodology:
      "Méthodologie Agile Scrum avec livraisons itératives bi-hebdomadaires, revues de sprint régulières et tests continus.",
    deliverables_summary:
      "Application web multi-rôles, application mobile chauffeurs, API REST et tableau de bord décisionnel.",
    items: DEFAULT_PROPOSAL_ITEMS,
    pricing_notes: "Modalités de règlement : 40% au démarrage, 40% à la livraison intermédiaire, 20% à la recette définitive.",
    terms_conditions:
      "La présente proposition est valable 30 jours à compter de sa date d'émission. Les prestations sont garanties 3 mois après mise en production.",
    valid_until: "2026-11-15",
    document_color: "#123f91",
    status: "ENVOYE",
    sent_at: "2026-10-05T14:30:00Z",
    created_at: "2026-10-04T10:00:00Z",
    updated_at: "2026-10-05T14:30:00Z",
  },
];

const INITIAL_CONTRACTS: EmploymentContractDocument[] = [
  {
    id: "ctr-1",
    contract_number: "CTR-2026-0001",
    employee_name: "Marcelle Kouassi",
    employee_email: "marcelle.kouassi@example.com",
    employee_phone: "+225 07 12 34 56 78",
    employee_address: "Cocody Angré 8ème Tranche, Abidjan",
    contract_type: "CDI",
    position: "Lead Développeuse Fullstack & Cloud",
    department: "Technique",
    start_date: "2026-11-01",
    trial_period: "3 mois renouvelable une fois",
    monthly_salary: "850 000 FCFA",
    benefits: "Assurance santé groupe (80%), prime de transport, forfait communication et équipement informatique MacBook Pro.",
    working_hours: "40 heures / semaine (lundi au vendredi, 8h30 - 17h30)",
    workplace: "Siège social Soken's Digital (Abidjan) avec 2 jours de télétravail hebdomadaires autorisés",
    clauses: DEFAULT_CONTRACT_CLAUSES,
    status: "ACTIF",
    document_color: "#0f766e",
    created_at: "2026-10-01T09:00:00Z",
    updated_at: "2026-10-02T11:00:00Z",
  },
];

// Helpers de stockage
function getStored<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function setStored<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error("Storage error:", e);
  }
}

// -------------------------------------------------------------
// SERVICES OFFRES DE SERVICE
// -------------------------------------------------------------

export function listServiceProposals(): Promise<ServiceProposal[]> {
  return Promise.resolve(getStored<ServiceProposal[]>(PROPOSALS_STORAGE_KEY, INITIAL_PROPOSALS));
}

export function getServiceProposal(id: string): Promise<ServiceProposal | null> {
  const all = getStored<ServiceProposal[]>(PROPOSALS_STORAGE_KEY, INITIAL_PROPOSALS);
  const found = all.find((p) => p.id === id) || null;
  return Promise.resolve(found);
}

export function saveServiceProposal(proposal: Partial<ServiceProposal>): Promise<ServiceProposal> {
  const all = getStored<ServiceProposal[]>(PROPOSALS_STORAGE_KEY, INITIAL_PROPOSALS);
  const now = new Date().toISOString();

  if (proposal.id) {
    const index = all.findIndex((p) => p.id === proposal.id);
    if (index >= 0) {
      const updated: ServiceProposal = {
        ...all[index],
        ...proposal,
        updated_at: now,
      } as ServiceProposal;
      all[index] = updated;
      setStored(PROPOSALS_STORAGE_KEY, all);
      return Promise.resolve(updated);
    }
  }

  // Création
  const year = new Date().getFullYear();
  const nextSeq = all.length + 1;
  const newProposal: ServiceProposal = {
    id: `prop-${Date.now()}`,
    proposal_number: `PROP-${year}-${String(nextSeq).padStart(4, "0")}`,
    client_name: proposal.client_name || "Nouveau client",
    lead_id: proposal.lead_id || null,
    client_id: proposal.client_id || null,
    title: proposal.title || "Nouvelle offre de services",
    subject: proposal.subject || "",
    intro_message: proposal.intro_message || "",
    context_objectives: proposal.context_objectives || "",
    methodology: proposal.methodology || "",
    deliverables_summary: proposal.deliverables_summary || "",
    items: proposal.items && proposal.items.length > 0 ? proposal.items : DEFAULT_PROPOSAL_ITEMS,
    pricing_notes: proposal.pricing_notes || "",
    terms_conditions: proposal.terms_conditions || "",
    valid_until: proposal.valid_until || "",
    document_color: proposal.document_color || "#123f91",
    status: proposal.status || "BROUILLON",
    created_at: now,
    updated_at: now,
  };

  const nextList = [newProposal, ...all];
  setStored(PROPOSALS_STORAGE_KEY, nextList);
  return Promise.resolve(newProposal);
}

export function deleteServiceProposal(id: string): Promise<void> {
  const all = getStored<ServiceProposal[]>(PROPOSALS_STORAGE_KEY, INITIAL_PROPOSALS);
  setStored(
    PROPOSALS_STORAGE_KEY,
    all.filter((p) => p.id !== id)
  );
  return Promise.resolve();
}

export async function sendServiceProposalByEmail(
  id: string,
  emails: string[],
  customMessage?: string
): Promise<ServiceProposal> {
  const all = getStored<ServiceProposal[]>(PROPOSALS_STORAGE_KEY, INITIAL_PROPOSALS);
  const found = all.find((p) => p.id === id);
  if (!found) throw new Error("Offre de service introuvable.");

  const now = new Date().toISOString();
  found.status = "ENVOYE";
  found.sent_at = now;
  found.updated_at = now;
  setStored(PROPOSALS_STORAGE_KEY, all);

  try {
    await sendDocumentEmail({
      recipient_emails: emails,
      subject: `Offre de service : ${found.title} (${found.proposal_number}) — Soken's Digital`,
      message:
        customMessage ||
        `Veuillez trouver les détails de notre offre de services "${found.title}" pour votre projet.`,
      document_title: found.title,
    });
  } catch (e) {
    console.warn("Mail dispatch handled:", e);
  }

  return found;
}

// -------------------------------------------------------------
// SERVICES CONTRATS DE TRAVAIL
// -------------------------------------------------------------

export function listEmploymentContracts(): Promise<EmploymentContractDocument[]> {
  return Promise.resolve(getStored<EmploymentContractDocument[]>(CONTRACTS_STORAGE_KEY, INITIAL_CONTRACTS));
}

export function getEmploymentContract(id: string): Promise<EmploymentContractDocument | null> {
  const all = getStored<EmploymentContractDocument[]>(CONTRACTS_STORAGE_KEY, INITIAL_CONTRACTS);
  const found = all.find((c) => c.id === id) || null;
  return Promise.resolve(found);
}

export function saveEmploymentContract(
  contract: Partial<EmploymentContractDocument>
): Promise<EmploymentContractDocument> {
  const all = getStored<EmploymentContractDocument[]>(CONTRACTS_STORAGE_KEY, INITIAL_CONTRACTS);
  const now = new Date().toISOString();

  if (contract.id) {
    const index = all.findIndex((c) => c.id === contract.id);
    if (index >= 0) {
      const updated: EmploymentContractDocument = {
        ...all[index],
        ...contract,
        updated_at: now,
      } as EmploymentContractDocument;
      all[index] = updated;
      setStored(CONTRACTS_STORAGE_KEY, all);
      return Promise.resolve(updated);
    }
  }

  const year = new Date().getFullYear();
  const nextSeq = all.length + 1;
  const newContract: EmploymentContractDocument = {
    id: `ctr-${Date.now()}`,
    contract_number: `CTR-${year}-${String(nextSeq).padStart(4, "0")}`,
    employee_name: contract.employee_name || "Nouveau Collaborateur",
    employee_email: contract.employee_email || "",
    employee_phone: contract.employee_phone || "",
    employee_address: contract.employee_address || "",
    contract_type: contract.contract_type || "CDI",
    position: contract.position || "Collaborateur",
    department: contract.department || "Technique",
    start_date: contract.start_date || new Date().toISOString().split("T")[0],
    end_date: contract.end_date || "",
    trial_period: contract.trial_period || "3 mois",
    monthly_salary: contract.monthly_salary || "0 FCFA",
    benefits: contract.benefits || "",
    working_hours: contract.working_hours || "40h / semaine",
    workplace: contract.workplace || "Siège social Soken's Digital",
    clauses: contract.clauses && contract.clauses.length > 0 ? contract.clauses : DEFAULT_CONTRACT_CLAUSES,
    document_color: contract.document_color || "#0f766e",
    status: contract.status || "BROUILLON",
    created_at: now,
    updated_at: now,
  };

  const nextList = [newContract, ...all];
  setStored(CONTRACTS_STORAGE_KEY, nextList);
  return Promise.resolve(newContract);
}

export function deleteEmploymentContract(id: string): Promise<void> {
  const all = getStored<EmploymentContractDocument[]>(CONTRACTS_STORAGE_KEY, INITIAL_CONTRACTS);
  setStored(
    CONTRACTS_STORAGE_KEY,
    all.filter((c) => c.id !== id)
  );
  return Promise.resolve();
}

export async function sendEmploymentContractByEmail(
  id: string,
  emails: string[],
  customMessage?: string
): Promise<EmploymentContractDocument> {
  const all = getStored<EmploymentContractDocument[]>(CONTRACTS_STORAGE_KEY, INITIAL_CONTRACTS);
  const found = all.find((c) => c.id === id);
  if (!found) throw new Error("Contrat de travail introuvable.");

  const now = new Date().toISOString();
  found.status = "ENVOYE";
  found.sent_at = now;
  found.updated_at = now;
  setStored(CONTRACTS_STORAGE_KEY, all);

  try {
    await sendDocumentEmail({
      recipient_emails: emails,
      subject: `Contrat de travail : ${found.employee_name} (${found.contract_number}) — Soken's Digital`,
      message:
        customMessage ||
        `Veuillez trouver les dispositions relatives à votre contrat de travail au sein de Soken's Digital.`,
      document_title: `Contrat de travail ${found.employee_name}`,
    });
  } catch (e) {
    console.warn("Mail dispatch handled:", e);
  }

  return found;
}
