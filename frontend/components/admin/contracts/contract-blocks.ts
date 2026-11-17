import type { ContractDocumentSettings, ServiceContractFields } from "@/lib/api/contracts";

/* Texte du contrat de prestation de services, d'après le modèle de Soken's
 * Digital, découpé en blocs. Copie de backend/marketing/contract_document.py
 * (qui produit le PDF) : modifier les deux ensemble.
 *
 * Dans le texte, **gras** marque les passages en gras ; une donnée manquante
 * s'affiche entre crochets, comme dans le modèle. */

export type ContractBlock =
  | { t: "title" | "section" | "article" | "sub" | "p" | "li" | "closing"; text: string }
  | { t: "annex"; text: string; break?: boolean }
  | { t: "signatures"; left_label: string; right_label: string; client: string; provider: string }
  | {
      t: "schedule";
      rows: { label: string; percentage: string; amount: string }[];
      total_percentage: string;
      total: string;
    };

const MONTHS = [
  "janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août",
  "septembre", "octobre", "novembre", "décembre",
];
const UNITS = [
  "zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix",
  "onze", "douze", "treize", "quatorze", "quinze", "seize",
];
const TENS: Record<number, string> = { 2: "vingt", 3: "trente", 4: "quarante", 5: "cinquante", 6: "soixante" };

function below100(n: number, final: boolean): string {
  if (n < 17) return UNITS[n];
  if (n < 20) return `dix-${UNITS[n - 10]}`;
  const tens = Math.floor(n / 10);
  const unit = n % 10;
  if (tens === 7) return unit === 1 ? "soixante et onze" : `soixante-${below100(10 + unit, final)}`;
  if (tens === 9) return `quatre-vingt-${below100(10 + unit, final)}`;
  if (tens === 8) {
    if (unit === 0) return final ? "quatre-vingts" : "quatre-vingt";
    return `quatre-vingt-${UNITS[unit]}`;
  }
  const word = TENS[tens];
  if (unit === 0) return word;
  if (unit === 1) return `${word} et un`;
  return `${word}-${UNITS[unit]}`;
}

function below1000(n: number, final: boolean): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(hundreds === 1 ? "cent" : `${UNITS[hundreds]} cent${rest === 0 && final ? "s" : ""}`);
  if (rest) parts.push(below100(rest, final));
  return parts.join(" ");
}

/** 2 500 000 → « deux millions cinq cent mille ». */
export function amountInWords(value: number): string {
  let n = Math.round(value || 0);
  if (n === 0) return "zéro";
  const parts: string[] = [];
  for (const [size, name] of [[1e9, "milliard"], [1e6, "million"]] as const) {
    const count = Math.floor(n / size);
    n %= size;
    if (count) parts.push(`${below1000(count, true)} ${name}${count > 1 ? "s" : ""}`);
  }
  const thousands = Math.floor(n / 1000);
  n %= 1000;
  if (thousands) parts.push(thousands === 1 ? "mille" : `${below1000(thousands, false)} mille`);
  if (n) parts.push(below1000(n, true));
  return parts.join(" ");
}

export function fcfa(value: number) {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(Math.round(value || 0));
}

export function longDate(value: string | null | undefined) {
  if (!value) return "";
  const [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "";
  return `${d === 1 ? "1er" : d} ${MONTHS[m - 1]} ${y}`;
}

function num(value: number | string | null | undefined) {
  const n = Number(value || 0);
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

function or(value: string | null | undefined, placeholder: string) {
  const v = (value ?? "").trim();
  return v || `[${placeholder}]`;
}

function paragraphs(text: string | null | undefined) {
  return (text ?? "").split("\n\n").map((b) => b.trim()).filter(Boolean);
}

function textBlocks(text: string | null | undefined): ContractBlock[] {
  const blocks: ContractBlock[] = [];
  for (const para of paragraphs(text)) {
    const lines = para.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length && lines.every((l) => l.startsWith("- ") || l.startsWith("• "))) {
      for (const line of lines) blocks.push({ t: "li", text: line.slice(2).trim() });
    } else {
      blocks.push({ t: "p", text: lines.join("\n") });
    }
  }
  return blocks;
}

/** Espaces insécables de la typographie française. */
export function typography(text: string) {
  return text
    .replaceAll("« ", "« ")
    .replaceAll(" »", " »")
    .replaceAll(" :", " :")
    .replaceAll(" ;", " ;")
    .replaceAll(" %", " %");
}

export function contractBlocks(c: ServiceContractFields, settings: ContractDocumentSettings): ContractBlock[] {
  const city = settings.city || "Libreville";
  const ht = c.amount_basis !== "TTC";
  const amount = Number(c.amount) || 0;
  const schedule = (c.payment_schedule ?? []).filter((t) => t && typeof t === "object");

  const clientText =
    `${or(c.client_name, "Dénomination sociale ou nom et prénom")}, ${or(c.client_legal_form, "forme juridique, capital social en FCFA")}` +
    `, dont le siège est situé à ${or(c.client_address, "adresse complète, Gabon")}` +
    `, immatriculé(e) au RCCM sous le n° ${or(c.client_rccm, "numéro")}` +
    `, NIF n° ${or(c.client_nif, "numéro")}` +
    `, représenté(e) par ${or(c.client_representative, "nom, prénom et qualité du signataire")}` +
    ", dûment habilité(e) à cet effet.";

  const b: ContractBlock[] = [
    { t: "title", text: "CONTRAT DE PRESTATION DE SERVICES" },
    { t: "section", text: "ENTRE LES SOUSSIGNÉS" },
    { t: "p", text: settings.provider_identity || "" },
    { t: "p", text: "Ci-après désigné « **le Prestataire** »," },
    { t: "p", text: "**ET**" },
    { t: "p", text: clientText },
    { t: "p", text: "Ci-après désigné « **le Client** »," },
    { t: "p", text: "Le Prestataire et le Client sont désignés ensemble « les Parties » et individuellement « une Partie »." },
    { t: "section", text: "PRÉAMBULE" },
    ...paragraphs(c.preamble).map((p): ContractBlock => ({ t: "p", text: p })),
    { t: "p", text: "Les Parties se sont rapprochées et ont convenu ce qui suit." },
    { t: "article", text: "Article 1 – Objet" },
    { t: "p", text: "Le présent contrat a pour objet de définir les conditions dans lesquelles le Prestataire réalise, au profit du Client, les prestations décrites à l’article 3 et à l’Annexe 1." },
    { t: "article", text: "Article 2 – Nature du contrat" },
    { t: "p", text: "Le présent contrat est un contrat de louage d’ouvrage et d’industrie (contrat d’entreprise) régi par le Code civil gabonais. Il ne constitue ni un contrat de travail, ni un mandat, ni un contrat de société." },
    { t: "p", text: "Le Prestataire exécute les prestations en toute indépendance, avec ses propres moyens, et organise librement son travail. Il n’existe aucun lien de subordination entre les Parties. Le Prestataire reste seul responsable de ses obligations sociales, fiscales et déclaratives, ainsi que de celles de son personnel éventuel." },
    { t: "article", text: "Article 3 – Description des prestations" },
  ];
  const services = textBlocks(c.services_description);
  if (services.length) {
    b.push({ t: "p", text: "Le Prestataire s’engage à réaliser les prestations suivantes :" }, ...services, { t: "p", text: "Le détail figure en Annexe 1." });
  } else {
    b.push({ t: "p", text: "Le Prestataire s’engage à réaliser les prestations suivantes : [description précise des tâches, livrables, normes de qualité attendues et critères de réception]. Le détail figure en Annexe 1." });
  }
  b.push({ t: "p", text: "Tout ajout ou modification de prestations fait l’objet d’un avenant écrit signé par les deux Parties." });

  const start = or(longDate(c.start_date), "date");
  const duration = (c.duration ?? "").trim();
  const term = duration ? `pour une durée de ${duration}` : "jusqu’à la réalisation complète des prestations";
  const renewal =
    c.renewal === "RENOUVELABLE"
      ? `Il est renouvelable par accord écrit des Parties, au plus tard ${c.renewal_notice_days || 30} jours avant l’échéance.`
      : "Il prend fin de plein droit à son terme.";
  b.push(
    { t: "article", text: "Article 4 – Durée" },
    { t: "p", text: `Le contrat prend effet le ${start} ${term}. ${renewal}` },
    { t: "section", text: "OBLIGATIONS" },
    { t: "article", text: "Article 5 – Obligations du Prestataire" },
    { t: "p", text: "Le Prestataire s’engage à :" },
    { t: "li", text: "Exécuter les prestations avec diligence, professionnalisme et dans les délais convenus ;" },
    { t: "li", text: "Informer le Client de toute difficulté pouvant affecter l’exécution du contrat ;" },
    { t: "li", text: "Respecter la réglementation gabonaise applicable à son activité, notamment en matière fiscale, sociale et professionnelle ;" },
    { t: "li", text: "Remettre au Client les livrables conformes au cahier des charges." },
    { t: "article", text: "Article 6 – Obligations du Client" },
    { t: "p", text: "Le Client s’engage à :" },
    { t: "li", text: "Fournir au Prestataire les informations, documents et accès nécessaires à l’exécution des prestations ;" },
    { t: "li", text: "Collaborer de bonne foi et répondre dans un délai raisonnable aux demandes du Prestataire ;" },
    { t: "li", text: "Procéder à la réception des livrables et payer le prix dans les conditions de l’article 7." },
  );

  const price = amount > 0 ? `${fcfa(amount)} (${amountInWords(amount)}) francs CFA (FCFA)` : "[montant en chiffres et en lettres] francs CFA (FCFA)";
  const basis = ht ? "hors taxes" : "toutes taxes comprises";
  const firstDays = c.first_payment_days || 30;
  let scheduleText: string;
  if (schedule.length) {
    const steps = schedule
      .map((t) => {
        const label = (t.label ?? "").trim();
        return `${num(t.percentage)} % ${label.slice(0, 1).toLowerCase()}${label.slice(1)}`;
      })
      .join(" ; ");
    scheduleText =
      `Le règlement intégral du Prestataire est échelonné de la manière suivante : ${steps}. ` +
      `Le premier paiement, égal à ${num(schedule[0].percentage)} % du montant à payer, intervient dans un délai de ${firstDays} jours à compter de la réception de la facture`;
  } else {
    scheduleText = `Le règlement intervient dans un délai de ${firstDays} jours à compter de la réception de la facture`;
  }
  const methods = (c.payment_methods ?? "").trim();
  scheduleText += methods ? `, ${methods}.` : ".";
  const taxes = ht ? "Les montants s’entendent hors taxes, la TVA au taux en vigueur s’ajoutant au prix." : "Les montants s’entendent toutes taxes comprises.";
  b.push(
    { t: "article", text: "Article 7 – Prix et modalités de paiement" },
    { t: "p", text: `**7.1 Prix.** En contrepartie des prestations, le Client verse au Prestataire la somme de ${price} ${basis}, selon l’échéancier de l’article 7.3, détaillé en Annexe 2.` },
    { t: "p", text: `**7.2 Taxes.** ${taxes} Chaque Partie supporte les impôts et taxes qui lui incombent selon la législation fiscale gabonaise. Si le Client est tenu d’opérer une retenue à la source, il la déduit du paiement et en remet justificatif au Prestataire.` },
    { t: "p", text: `**7.3 Facturation et paiement.** Le Prestataire émet une facture mentionnant son identité, son NIF et son numéro RCCM, la désignation des prestations, le montant hors taxes, la TVA et le montant total. ${scheduleText}` },
    { t: "p", text: `**7.4 Retard de paiement.** Tout retard de paiement entraîne de plein droit, après mise en demeure restée sans effet pendant 8 jours, des pénalités de retard au taux de ${num(c.late_penalty_rate || 2)} % par mois, sans préjudice de tous autres droits du Prestataire.` },
  );

  let expenses: string;
  if (c.expenses_covered) {
    expenses = "Les frais de déplacement, d’hébergement et autres débours engagés pour l’exécution des prestations sont pris en charge par le Client, sur présentation de justificatifs";
    const threshold = Number(c.expenses_threshold) || 0;
    expenses += threshold > 0 ? ` et après accord écrit préalable pour tout montant supérieur à ${fcfa(threshold)} FCFA.` : ".";
  } else {
    expenses = "Les frais de déplacement, d’hébergement et autres débours engagés pour l’exécution des prestations ne sont pas pris en charge par le Client.";
  }
  const liability = (c.liability_cap ?? "").trim() || "au montant total du prix du contrat";
  const insurance = (c.insurance ?? "").trim();
  let responsibility =
    "Le Prestataire répond des dommages directs causés au Client par sa faute dans l’exécution des prestations. " +
    `Sauf faute lourde ou dolosive, sa responsabilité est limitée ${liability} et ne couvre pas les dommages indirects.`;
  if (insurance) responsibility += ` Le Prestataire déclare avoir souscrit ${insurance} et en fournit l’attestation sur demande.`;
  b.push(
    { t: "article", text: "Article 8 – Frais et débours" },
    { t: "p", text: expenses },
    { t: "article", text: "Article 9 – Confidentialité" },
    { t: "p", text: `Chaque Partie s’engage à garder strictement confidentielles les informations de toute nature (techniques, commerciales, financières, personnelles) dont elle a connaissance du fait du contrat, et à ne les utiliser que pour son exécution. Cette obligation s’applique pendant toute la durée du contrat et pendant ${c.confidentiality_years || 5} ans après son terme. Elle ne s’applique pas aux informations tombées dans le domaine public sans faute de la Partie qui les détient, ni à celles dont la loi ou une décision de justice impose la divulgation.` },
    { t: "sub", text: "Protection des données à caractère personnel" },
    { t: "p", text: "Lorsque l’exécution du contrat implique le traitement de données à caractère personnel, chaque Partie s’engage à respecter la législation gabonaise en vigueur sur la protection de ces données, à ne les traiter que sur instruction documentée du Client et pour les finalités du contrat, à en assurer la sécurité et à les restituer ou les détruire à la fin du contrat." },
    { t: "article", text: "Article 10 – Responsabilité et assurance" },
    { t: "p", text: responsibility },
    { t: "article", text: "Article 11 – Force majeure" },
    { t: "p", text: "Aucune Partie n’est responsable de l’inexécution de ses obligations lorsqu’elle résulte d’un événement imprévisible, irrésistible et extérieur à sa volonté. La Partie concernée informe l’autre sans délai. Si l’événement dure plus de 30 jours, chaque Partie peut résilier le contrat par lettre recommandée, sans indemnité." },
    { t: "article", text: "Article 12 – Résiliation" },
    { t: "p", text: "**12.1 Pour manquement.** En cas de manquement grave d’une Partie à ses obligations, non réparé dans un délai de 15 jours après mise en demeure par lettre recommandée avec accusé de réception ou par acte extrajudiciaire, l’autre Partie peut résilier le contrat de plein droit, sans préjudice de dommages et intérêts." },
    { t: "p", text: "**12.2 Pour convenance.** Chaque Partie peut mettre fin au contrat, sans motif, moyennant un préavis écrit de 30 jours. Les prestations déjà réalisées sont alors payées au prorata de leur avancement." },
    { t: "article", text: "Article 13 – Sous-traitance et cession" },
    { t: "p", text: "Le Prestataire ne peut sous-traiter tout ou partie des prestations, ni céder le contrat, sans l’accord écrit préalable du Client. Il reste, dans tous les cas, seul responsable envers le Client." },
    { t: "article", text: "Article 14 – Intégralité et modification" },
    { t: "p", text: "Le contrat et ses annexes expriment l’intégralité de l’accord des Parties et remplacent tout accord antérieur sur le même objet. Toute modification doit faire l’objet d’un avenant écrit signé des deux Parties." },
  );

  const clientContact = [c.client_address, c.client_email].map((x) => (x ?? "").trim()).filter(Boolean).join(", ");
  const companyAddress = (settings.company_address ?? "").split("\n").map((l) => l.trim()).filter(Boolean).join(", ");
  const providerContact = [companyAddress, (settings.company_email ?? "").trim()].filter(Boolean).join(", ");
  b.push(
    { t: "article", text: "Article 15 – Notifications" },
    { t: "p", text: `Toute notification est faite par écrit, par lettre recommandée avec accusé de réception, par remise en main propre contre décharge ou par courriel avec accusé de réception, aux adresses suivantes : Client : ${or(clientContact, "adresse, courriel")} ; Prestataire : ${or(providerContact, "adresse, courriel")}. Tout changement d’adresse est notifié à l’autre Partie.` },
    { t: "article", text: "Article 16 – Loi applicable et règlement des litiges" },
    { t: "p", text: `Le contrat est soumis au droit gabonais. Les Parties s’efforcent de régler à l’amiable tout différend relatif à sa formation, son interprétation ou son exécution, dans un délai de 30 jours à compter de la notification du différend. À défaut, le litige est soumis aux juridictions compétentes de ${city}.` },
    { t: "article", text: "Article 17 – Élection de domicile" },
    { t: "p", text: "Pour l’exécution du contrat, les Parties font élection de domicile en leurs sièges ou adresses respectifs indiqués en tête des présentes." },
    { t: "closing", text: `Fait à ${city}, le ${or(longDate(c.signing_date), "date")}, en deux exemplaires originaux, un pour chaque Partie.` },
    {
      t: "signatures",
      left_label: "Pour le Client",
      right_label: "Pour le Prestataire",
      client: (c.client_signatory ?? "").trim(),
      provider: (c.provider_signatory ?? "").trim() || settings.provider_signatory || "",
    },
  );

  b.push({ t: "annex", text: "ANNEXE 1 – Cahier des charges", break: true });
  const specs = textBlocks(c.annex_specifications);
  b.push(...(specs.length ? specs : [{ t: "p", text: "[Description détaillée des prestations, livrables, délais, critères de réception.]" } as ContractBlock]));

  b.push({ t: "annex", text: "ANNEXE 2 – Tarifs et calendrier de paiement" });
  const hasTable = schedule.length > 0 && amount > 0;
  if (hasTable) {
    const share = schedule.reduce((sum, t) => sum + (Number(t.percentage) || 0), 0);
    b.push({
      t: "schedule",
      rows: schedule.map((t) => ({
        label: (t.label ?? "").trim(),
        percentage: `${num(t.percentage)} %`,
        amount: `${fcfa((amount * (Number(t.percentage) || 0)) / 100)} FCFA`,
      })),
      total_percentage: `${num(share)} %`,
      total: `${fcfa((amount * share) / 100)} FCFA ${ht ? "HT" : "TTC"}`,
    });
  }
  const pricing = textBlocks(c.annex_pricing);
  if (pricing.length) b.push(...pricing);
  else if (!hasTable) b.push({ t: "p", text: "[Grille tarifaire, échéancier, jalons.]" });

  return b.map((block) => ("text" in block ? { ...block, text: typography(block.text) } : block)) as ContractBlock[];
}

/* --- Contrat de partenariat ---------------------------------------------
 * Modèle à part (copie de partnership_blocks dans contract_document.py) :
 * engagements réciproques, dispositions financières, exclusivité. */

export const DEFAULT_PARTNERSHIP_PREAMBLE =
  "Soken’s Digital est une entreprise spécialisée dans la conception de solutions digitales. Le Partenaire souhaite s’associer à Soken’s Digital afin de mener des actions communes. Les Parties ont souhaité formaliser les conditions de leur collaboration.";
export const DEFAULT_PROVIDER_COMMITMENTS = [
  "- Mettre à disposition son expertise en conception de solutions digitales pour les actions communes ;",
  "- Affecter au partenariat les ressources humaines et techniques convenues entre les Parties ;",
  "- Informer le Partenaire de l’avancement des actions et de toute difficulté rencontrée ;",
  "- Mentionner le Partenaire dans ses communications relatives aux actions communes.",
].join("\n");
export const DEFAULT_PARTNER_COMMITMENTS = [
  "- Contribuer aux actions communes selon les moyens convenus entre les Parties ;",
  "- Faire connaître l’offre de Soken’s Digital auprès de son réseau et de ses bénéficiaires ;",
  "- Fournir en temps utile les informations, contenus et accès nécessaires ;",
  "- Mentionner Soken’s Digital dans ses communications relatives aux actions communes.",
].join("\n");
export const DEFAULT_FINANCIAL_TERMS =
  "Sauf stipulation contraire, chaque Partie supporte les coûts liés à l’exécution de ses propres engagements. Toute contribution financière, toute rémunération ou tout partage de recettes lié au partenariat fait l’objet d’un accord écrit préalable des Parties, annexé au présent contrat.";

function partyText(c: ServiceContractFields) {
  return (
    `${or(c.client_name, "Dénomination sociale ou nom et prénom")}, ${or(c.client_legal_form, "forme juridique, capital social en FCFA")}` +
    `, dont le siège est situé à ${or(c.client_address, "adresse complète, Gabon")}` +
    `, immatriculé(e) au RCCM sous le n° ${or(c.client_rccm, "numéro")}` +
    `, NIF n° ${or(c.client_nif, "numéro")}` +
    `, représenté(e) par ${or(c.client_representative, "nom, prénom et qualité du signataire")}` +
    ", dûment habilité(e) à cet effet."
  );
}

export function partnershipBlocks(c: ServiceContractFields, settings: ContractDocumentSettings): ContractBlock[] {
  const city = settings.city || "Libreville";
  const b: ContractBlock[] = [
    { t: "title", text: "CONTRAT DE PARTENARIAT" },
    { t: "section", text: "ENTRE LES SOUSSIGNÉS" },
    { t: "p", text: settings.provider_identity || "" },
    { t: "p", text: "Ci-après désignée « **Soken’s Digital** »," },
    { t: "p", text: "**ET**" },
    { t: "p", text: partyText(c) },
    { t: "p", text: "Ci-après désigné « **le Partenaire** »," },
    { t: "p", text: "Soken’s Digital et le Partenaire sont désignés ensemble « les Parties » et individuellement « une Partie »." },
    { t: "section", text: "PRÉAMBULE" },
    ...paragraphs(c.preamble).map((p): ContractBlock => ({ t: "p", text: p })),
    { t: "p", text: "Les Parties se sont rapprochées et ont convenu ce qui suit." },
    { t: "article", text: "Article 1 – Objet" },
  ];
  const purpose = textBlocks(c.partnership_purpose);
  if (purpose.length) {
    b.push({ t: "p", text: "Le présent contrat a pour objet de définir les conditions dans lesquelles les Parties collaborent en vue de :" }, ...purpose);
  } else {
    b.push({ t: "p", text: "Le présent contrat a pour objet de définir les conditions dans lesquelles les Parties collaborent en vue de : [objet précis du partenariat, actions communes, public visé]." });
  }
  b.push(
    { t: "article", text: "Article 2 – Nature du partenariat" },
    { t: "p", text: "Le présent contrat ne crée entre les Parties ni société, ni association, ni entreprise commune dotée de la personnalité morale, ni lien de subordination. Chaque Partie conserve son indépendance juridique, commerciale et financière, reste seule responsable de ses actes et ne peut engager l’autre Partie sans son accord écrit préalable." },
  );

  const start = or(longDate(c.start_date), "date");
  const duration = (c.duration ?? "").trim();
  let durationText: string;
  if (duration) {
    const end =
      c.renewal === "RENOUVELABLE"
        ? `Il est renouvelable par accord écrit des Parties, au plus tard ${c.renewal_notice_days || 30} jours avant l’échéance.`
        : "Il prend fin de plein droit à son terme.";
    durationText = `Le contrat prend effet le ${start} pour une durée de ${duration}. ${end}`;
  } else {
    durationText = `Le contrat prend effet le ${start} pour une durée indéterminée. Chaque Partie peut y mettre fin dans les conditions de l’article 14.`;
  }
  const provider = textBlocks(c.provider_commitments);
  const partner = textBlocks(c.partner_commitments);
  const financial = textBlocks(c.financial_terms);
  b.push(
    { t: "article", text: "Article 3 – Durée" },
    { t: "p", text: durationText },
    { t: "section", text: "ENGAGEMENTS DES PARTIES" },
    { t: "article", text: "Article 4 – Engagements de Soken’s Digital" },
    { t: "p", text: "Soken’s Digital s’engage à :" },
    ...(provider.length ? provider : [{ t: "li", text: "[engagements de Soken’s Digital]" } as ContractBlock]),
    { t: "article", text: "Article 5 – Engagements du Partenaire" },
    { t: "p", text: "Le Partenaire s’engage à :" },
    ...(partner.length ? partner : [{ t: "li", text: "[engagements du Partenaire]" } as ContractBlock]),
    { t: "article", text: "Article 6 – Engagements communs et suivi" },
    { t: "p", text: "Les Parties coopèrent de bonne foi et se tiennent mutuellement informées de toute information utile au partenariat. Elles désignent chacune un référent chargé de son suivi et font le point au moins une fois par trimestre sur l’avancement des actions communes." },
    { t: "article", text: "Article 7 – Dispositions financières" },
    ...(financial.length ? financial : [{ t: "p", text: DEFAULT_FINANCIAL_TERMS } as ContractBlock]),
  );

  const exclusivity = c.exclusivity
    ? "Pendant toute la durée du contrat, chaque Partie s’interdit de conclure un partenariat ayant le même objet avec un concurrent direct de l’autre Partie, sauf accord écrit préalable de celle-ci."
    : "Le présent partenariat est conclu sans exclusivité : chaque Partie reste libre de conclure d’autres partenariats, y compris dans le même domaine.";
  b.push(
    { t: "article", text: "Article 8 – Exclusivité" },
    { t: "p", text: exclusivity },
    { t: "article", text: "Article 9 – Communication et usage des marques" },
    { t: "p", text: "Chaque Partie autorise l’autre à utiliser sa dénomination, sa marque et son logo pour communiquer sur le partenariat, sur tout support, pendant la durée du contrat. Toute communication est soumise à l’accord préalable de l’autre Partie et respecte sa charte graphique. Cette autorisation prend fin avec le contrat." },
    { t: "article", text: "Article 10 – Propriété intellectuelle" },
    { t: "p", text: "Chaque Partie reste propriétaire de ses marques, logos, savoir-faire, outils et contenus préexistants. Les créations réalisées en commun dans le cadre du partenariat appartiennent conjointement aux Parties, sauf accord écrit contraire précisant leur répartition et leurs conditions d’exploitation." },
    { t: "article", text: "Article 11 – Confidentialité" },
    { t: "p", text: `Chaque Partie s’engage à garder strictement confidentielles les informations de toute nature (techniques, commerciales, financières, personnelles) dont elle a connaissance du fait du contrat, et à ne les utiliser que pour son exécution. Cette obligation s’applique pendant toute la durée du contrat et pendant ${c.confidentiality_years || 5} ans après son terme.` },
    { t: "sub", text: "Protection des données à caractère personnel" },
    { t: "p", text: "Lorsque le partenariat implique le traitement de données à caractère personnel, chaque Partie s’engage à respecter la législation gabonaise en vigueur sur la protection de ces données, à ne les traiter que pour les finalités du partenariat, à en assurer la sécurité et à les restituer ou les détruire à la fin du contrat." },
    { t: "article", text: "Article 12 – Responsabilité" },
    { t: "p", text: "Chaque Partie est seule responsable de l’exécution de ses propres engagements et des dommages qu’elle cause à l’autre Partie ou aux tiers. Aucune Partie ne répond des engagements pris par l’autre envers des tiers." },
    { t: "article", text: "Article 13 – Force majeure" },
    { t: "p", text: "Aucune Partie n’est responsable de l’inexécution de ses obligations lorsqu’elle résulte d’un événement imprévisible, irrésistible et extérieur à sa volonté. La Partie concernée informe l’autre sans délai. Si l’événement dure plus de 30 jours, chaque Partie peut résilier le contrat par lettre recommandée, sans indemnité." },
    { t: "article", text: "Article 14 – Résiliation" },
    { t: "p", text: "**14.1 Pour manquement.** En cas de manquement grave d’une Partie à ses obligations, non réparé dans un délai de 15 jours après mise en demeure par lettre recommandée avec accusé de réception, l’autre Partie peut résilier le contrat de plein droit, sans préjudice de dommages et intérêts." },
    { t: "p", text: "**14.2 Pour convenance.** Chaque Partie peut mettre fin au contrat, sans motif, moyennant un préavis écrit de 30 jours. Les actions engagées à la date de résiliation sont menées à leur terme, sauf accord contraire des Parties." },
    { t: "article", text: "Article 15 – Cession" },
    { t: "p", text: "Le présent contrat est conclu en considération de la personne des Parties. Il ne peut être cédé ou transféré, en tout ou partie, sans l’accord écrit préalable de l’autre Partie." },
    { t: "article", text: "Article 16 – Intégralité et modification" },
    { t: "p", text: "Le contrat et ses annexes expriment l’intégralité de l’accord des Parties et remplacent tout accord antérieur sur le même objet. Toute modification doit faire l’objet d’un avenant écrit signé des deux Parties." },
    { t: "article", text: "Article 17 – Loi applicable et règlement des litiges" },
    { t: "p", text: `Le contrat est soumis au droit gabonais. Les Parties s’efforcent de régler à l’amiable tout différend relatif à sa formation, son interprétation ou son exécution, dans un délai de 30 jours à compter de la notification du différend. À défaut, le litige est soumis aux juridictions compétentes de ${city}.` },
    { t: "article", text: "Article 18 – Élection de domicile" },
    { t: "p", text: "Pour l’exécution du contrat, les Parties font élection de domicile en leurs sièges ou adresses respectifs indiqués en tête des présentes." },
    { t: "closing", text: `Fait à ${city}, le ${or(longDate(c.signing_date), "date")}, en deux exemplaires originaux, un pour chaque Partie.` },
    {
      t: "signatures",
      left_label: "Pour le Partenaire",
      right_label: "Pour Soken’s Digital",
      client: (c.client_signatory ?? "").trim(),
      provider: (c.provider_signatory ?? "").trim() || settings.provider_signatory || "",
    },
  );
  const annex = textBlocks(c.annex_specifications);
  if (annex.length) b.push({ t: "annex", text: "ANNEXE – Plan d’actions", break: true }, ...annex);
  return b.map((block) => ("text" in block ? { ...block, text: typography(block.text) } : block)) as ContractBlock[];
}

/** Blocs du document selon le type de contrat. */
export function documentBlocks(c: ServiceContractFields, settings: ContractDocumentSettings): ContractBlock[] {
  return c.contract_type === "PARTENARIAT" ? partnershipBlocks(c, settings) : contractBlocks(c, settings);
}

export function documentTitle(type: ServiceContractFields["contract_type"]) {
  return type === "PARTENARIAT" ? "Contrat de partenariat" : "Contrat de prestation de services";
}
