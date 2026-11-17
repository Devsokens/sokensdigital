"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

type Result =
  | { valid: false }
  | {
      valid: true;
      invoice_number: string;
      issue_date: string;
      supplier: string;
      supplier_nif: string;
      supplier_rccm: string;
      client: string;
      client_nif: string;
      amount_ht: string;
      vat_rate: string;
      vat_amount: string;
      css_rate: string;
      css_amount: string;
      amount_ttc: string;
      status: string;
    };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

function fcfa(value: string) {
  return `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(value)))} FCFA`;
}

function pct(rate: string) {
  return `${Math.round(Number(rate) * 1000) / 10} %`;
}

/** Résultat du scan du QR code fiscal : la signature est vérifiée par le
 * serveur, qui ne renvoie les données que si la facture est authentique et
 * n'a pas été modifiée depuis son émission. */
export function InvoiceVerification() {
  const params = useSearchParams();
  const number = params.get("n") ?? "";
  const signature = params.get("s") ?? "";
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!number || !signature) return;
    const qs = new URLSearchParams({ n: number, s: signature });
    fetch(`${API_BASE}/api/v1/public/invoices/verify/?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setResult)
      .catch(() => setFailed(true));
  }, [number, signature]);

  const card = "mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8";

  if (!number || !signature || (result && !result.valid)) {
    return (
      <div className={card}>
        <ShieldAlert className="size-10 text-destructive" />
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Facture non vérifiée</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ce QR code ne correspond à aucune facture authentique émise par Soken&apos;s Digital, ou la facture a été
          modifiée depuis son émission. Contactez-nous avant tout paiement.
        </p>
      </div>
    );
  }
  if (failed) {
    return <p className="text-center text-sm text-muted-foreground">Vérification momentanément indisponible. Réessayez dans un instant.</p>;
  }
  if (!result) {
    return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;
  }

  const rows: [string, string][] = [
    ["Numéro", result.invoice_number],
    ["Date d'émission", new Date(result.issue_date).toLocaleDateString("fr-FR")],
    ["Émetteur", `${result.supplier} — NIF ${result.supplier_nif}${result.supplier_rccm ? ` · RCCM ${result.supplier_rccm}` : ""}`],
    ["Client", `${result.client}${result.client_nif ? ` — NIF ${result.client_nif}` : ""}`],
    ["Montant HT", fcfa(result.amount_ht)],
    [`TVA (${pct(result.vat_rate)})`, fcfa(result.vat_amount)],
    [`CSS (${pct(result.css_rate)})`, fcfa(result.css_amount)],
    ["Montant TTC", fcfa(result.amount_ttc)],
    ["Statut", result.status],
  ];

  return (
    <div className={card}>
      <CheckCircle2 className="size-10 text-emerald-400" />
      <h1 className="mt-4 text-2xl font-semibold text-foreground">Facture authentique</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Cette facture a bien été émise par Soken&apos;s Digital et ses montants n&apos;ont pas été modifiés.
        Comparez-les avec ceux du document.
      </p>
      <dl className="mt-6 divide-y divide-white/10 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex flex-wrap justify-between gap-2 py-2.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
