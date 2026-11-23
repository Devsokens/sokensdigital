"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";

type Result =
  | { valid: false }
  | {
      valid: true;
      kind: string;
      number: string;
      date: string;
      amount: string;
      issuer: string;
      direction?: string;
      status?: string;
      beneficiary?: string;
    };

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

/** Résultat du scan du QR code d'une pièce de caisse ou d'un bon de demande :
 * la signature est vérifiée par le serveur contre la pièce en base. */
export function DocumentVerification() {
  const params = useSearchParams();
  const kind = params.get("t") ?? "";
  const id = params.get("id") ?? "";
  const signature = params.get("s") ?? "";
  const [result, setResult] = useState<Result | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!kind || !id || !signature) return;
    const qs = new URLSearchParams({ t: kind, id, s: signature });
    fetch(`${API_BASE}/api/v1/public/documents/verify/?${qs}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setResult)
      .catch(() => setFailed(true));
  }, [kind, id, signature]);

  const card = "mx-auto max-w-xl rounded-2xl border border-white/10 bg-white/[0.03] p-6 sm:p-8";

  if (!kind || !id || !signature || (result && !result.valid)) {
    return (
      <div className={card}>
        <ShieldAlert className="size-10 text-destructive" />
        <h1 className="mt-4 text-2xl font-semibold text-foreground">Document non vérifié</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ce QR code ne correspond à aucun document authentique émis par Soken&apos;s Digital, ou le document a été
          modifié depuis son émission.
        </p>
      </div>
    );
  }
  if (failed) {
    return <p className="text-center text-sm text-muted-foreground">Vérification momentanément indisponible. Réessayez dans un instant.</p>;
  }
  if (!result) return <Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" />;

  const rows: [string, string][] = [
    ["Type", result.direction ? `${result.kind} — ${result.direction}` : result.kind],
    ["Numéro", result.number || "—"],
    ["Date", new Date(result.date).toLocaleDateString("fr-FR")],
    ["Montant", `${new Intl.NumberFormat("fr-FR").format(Math.round(Number(result.amount)))} FCFA`],
    ...(result.beneficiary ? [["Bénéficiaire", result.beneficiary] as [string, string]] : []),
    ...(result.status ? [["Statut actuel", result.status] as [string, string]] : []),
    ["Émetteur", result.issuer],
  ];

  return (
    <div className={card}>
      <CheckCircle2 className="size-10 text-emerald-400" />
      <h1 className="mt-4 text-2xl font-semibold text-foreground">Document authentique</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Ce document a bien été émis par Soken&apos;s Digital. Comparez ces informations avec celles du document.
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
