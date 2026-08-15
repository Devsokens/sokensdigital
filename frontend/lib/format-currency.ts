/** FCFA (XOF/XAF) has no minor unit in everyday use — always a whole
 * number, space as the thousands separator, "FCFA" suffix. Used across
 * the RH module (salary, hourly cost) instead of the Intl default (which
 * would format XOF with the € pattern the team explicitly moved away from). */
export function formatFcfa(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Math.round(Number(value));
  if (Number.isNaN(amount)) return "—";
  return `${amount.toLocaleString("fr-FR")} FCFA`;
}
