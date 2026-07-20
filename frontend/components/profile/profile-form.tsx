"use client";

import { useEffect, useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";
import { updateOwnProfile } from "@/lib/firebase/profile";
import type { AppRole } from "@/lib/firebase/types";

const ROLE_LABELS: Record<AppRole, string> = {
  SUPER_ADMIN: "Super-Administrateur",
  RESPONSABLE_MARKETING: "Responsable Marketing",
  RESPONSABLE_RH: "Responsable RH",
  COMMERCIAL: "Commercial",
  CHEF_DE_PROJET: "Chef de Projet",
  DEVELOPPEUR: "Développeur",
  COMPTABLE: "Comptable",
  DIRECTEUR_FINANCIER: "Directeur Financier",
  AUTRE: "Autre",
};

const inputClass =
  "w-full rounded-lg border border-white/10 bg-white/[0.02] px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/70 transition-colors focus:border-primary/50 focus:outline-none";

const readOnlyClass =
  "w-full rounded-lg border border-white/5 bg-white/[0.01] px-3.5 py-2.5 text-sm text-muted-foreground";

export function ProfileForm() {
  const { user, profile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.firstName ?? "");
  const [lastName, setLastName] = useState(profile?.lastName ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFirstName(profile?.firstName ?? "");
    setLastName(profile?.lastName ?? "");
  }, [profile]);

  if (!user || !profile) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      await updateOwnProfile(user!.uid, { firstName, lastName });
      setSaved(true);
    } catch {
      setError("Impossible d'enregistrer les modifications. Réessayez.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-lg space-y-5">
      <h1 className="text-2xl font-semibold text-foreground">Mon profil</h1>

      {error && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Prénom</span>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs text-muted-foreground">Nom</span>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
            required
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1.5 block text-xs text-muted-foreground">Email</span>
        <input value={profile.email} disabled className={readOnlyClass} />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-xs text-muted-foreground">Rôle</span>
        <input value={ROLE_LABELS[profile.role]} disabled className={readOnlyClass} />
      </label>

      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={saving} className="rounded-full px-6">
          {saving ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
        </Button>
        {saved && (
          <span className="flex items-center gap-1.5 text-xs text-primary">
            <Check className="size-3.5" /> Enregistré
          </span>
        )}
      </div>
    </form>
  );
}
