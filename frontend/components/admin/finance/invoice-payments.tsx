"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Check, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import { createPayment, listPayments, receivePayment } from "@/lib/api/finance";
import { formatFcfa } from "@/lib/format-currency";
import type { Invoice, Payment, PaymentMethod } from "@/lib/api/types";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "VIREMENT", label: "Virement" },
  { value: "CHEQUE", label: "Chèque" },
  { value: "ESPECES", label: "Espèces" },
  { value: "CARTE", label: "Carte bancaire" },
  { value: "AUTRE", label: "Autre" },
];

const STATUS_COLORS: Record<Payment["status"], string> = {
  EN_ATTENTE: "bg-amber-100 text-amber-700",
  RECU: "bg-emerald-100 text-emerald-700",
  ENREGISTRE: "bg-neutral-100 text-neutral-600",
};

/**
 * Versements partiels d'une facture.
 *
 * Le backend gère ce workflow depuis longtemps (acompte, solde, reçu émis à
 * l'encaissement), mais aucun écran ne l'exposait : les versements ne
 * pouvaient être saisis que par l'API.
 *
 * Le restant dû vient du serveur et non d'un calcul local — c'est lui qui
 * fait foi pour la comptabilité, et le recalculer ici ouvrirait la porte à
 * deux vérités qui divergent.
 */
export function InvoicePayments({ invoice }: { invoice: Invoice }) {
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const res = await listPayments(invoice.id);
      setPayments(res.results);
      setError(null);
    } catch {
      setError("Impossible de charger les versements.");
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  async function handleReceive(payment: Payment) {
    setBusyId(payment.id);
    setError(null);
    try {
      await receivePayment(invoice.id, payment.id);
      await load();
    } catch {
      setError("Impossible d'enregistrer la réception de ce versement.");
    } finally {
      setBusyId(null);
    }
  }

  if (!payments) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="size-5 animate-spin text-neutral-400" />
      </div>
    );
  }

  // Tous les versements portent le même cumul côté serveur ; à défaut (aucun
  // versement encore saisi) la totalité reste due.
  const remaining = payments.length > 0 ? payments[0].remaining : invoice.amount_ttc;
  const totalPaid = payments.length > 0 ? payments[0].total_paid : "0";
  const settled = Number(remaining) <= 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span className="text-neutral-500">
            Total facture{" "}
            <span className="font-medium text-neutral-900">{formatFcfa(invoice.amount_ttc)}</span>
          </span>
          <span className="text-neutral-500">
            Encaissé{" "}
            <span className="font-medium text-emerald-700">{formatFcfa(totalPaid)}</span>
          </span>
          <span className="text-neutral-500">
            Restant dû{" "}
            <span className={`font-medium ${settled ? "text-neutral-400" : "text-neutral-900"}`}>
              {formatFcfa(remaining)}
            </span>
          </span>
        </div>

        {!settled && (
          <Button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="gap-1.5 rounded-full px-4"
          >
            <Plus className="size-4" /> Nouveau versement
          </Button>
        )}
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      {showForm && (
        <NewPaymentForm
          invoiceId={invoice.id}
          remaining={remaining}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      <div className="overflow-x-auto rounded-xl border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Montant</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">Statut</th>
              <th className="px-4 py-3 font-medium">Reçu</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {payments.map((payment) => (
              <tr key={payment.id}>
                <td className="px-4 py-3 text-neutral-500">{payment.payment_date}</td>
                <td className="px-4 py-3 font-medium text-neutral-900">
                  {formatFcfa(payment.amount)}
                </td>
                <td className="px-4 py-3 text-neutral-500">{payment.payment_method_display}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_COLORS[payment.status]}`}>
                    {payment.status_display}
                  </span>
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {payment.receipt ? (
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="size-3.5 text-neutral-400" />
                      {payment.receipt.receipt_number}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {payment.status === "EN_ATTENTE" && (
                    <button
                      type="button"
                      onClick={() => handleReceive(payment)}
                      disabled={busyId === payment.id}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary disabled:opacity-40"
                    >
                      {busyId === payment.id ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <Check className="size-3" />
                      )}
                      Marquer reçu
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-neutral-400">
                  Aucun versement enregistré sur cette facture.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewPaymentForm({
  invoiceId,
  remaining,
  onSaved,
}: {
  invoiceId: string;
  remaining: string;
  onSaved: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>("VIREMENT");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await createPayment(invoiceId, {
        amount,
        payment_date: paymentDate,
        payment_method: method,
        notes: notes || undefined,
      });
      onSaved();
    } catch (err) {
      // Le serveur refuse notamment un montant supérieur au restant dû : sa
      // formulation est plus utile qu'un message générique.
      const body = (err as { body?: { amount?: string[] } }).body;
      setError(body?.amount?.[0] ?? "Impossible d'enregistrer ce versement.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-5 space-y-4 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4"
    >
      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <label className="block">
          <span className={labelClass}>Montant (FCFA)</span>
          <input
            type="number"
            step="1"
            min="1"
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="block">
          <span className={labelClass}>Date du versement</span>
          <input
            type="date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="block">
          <span className={labelClass}>Mode de règlement</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
            className={inputClass}
          >
            {METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>Note (optionnel)</span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} />
      </label>
      <div className="flex justify-end">
        <Button type="submit" disabled={saving} className="rounded-full px-5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer le versement"}
        </Button>
      </div>
    </form>
  );
}
