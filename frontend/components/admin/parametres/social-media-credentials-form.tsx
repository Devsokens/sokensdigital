"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardClass, inputClass, labelClass } from "@/components/admin/form-styles";
import { getSocialMediaCredentials, updateSocialMediaCredentials } from "@/lib/api/marketing";
import type { SocialMediaCredentials } from "@/lib/api/types";
import { ApiError } from "@/lib/api/client";

function StatusBadge({ configured }: { configured: boolean }) {
  return configured ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
      <CheckCircle2 className="size-3.5" /> Connecté
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-500">
      <XCircle className="size-3.5" /> Non connecté
    </span>
  );
}

export function SocialMediaCredentialsForm() {
  const [credentials, setCredentials] = useState<SocialMediaCredentials | null>(null);
  const [facebookPageId, setFacebookPageId] = useState("");
  const [facebookToken, setFacebookToken] = useState("");
  const [instagramAccountId, setInstagramAccountId] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSocialMediaCredentials()
      .then((data) => {
        setCredentials(data);
        setFacebookPageId(data.facebook_page_id);
        setInstagramAccountId(data.instagram_business_account_id);
      })
      .catch(() => setError("Impossible de charger les identifiants."))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const payload: Partial<SocialMediaCredentials> = {
        facebook_page_id: facebookPageId,
        instagram_business_account_id: instagramAccountId,
      };
      // Blank means "leave the stored token untouched" — re-typing it on
      // every save would defeat the point of not echoing it back on GET.
      if (facebookToken.trim()) payload.facebook_access_token = facebookToken.trim();
      const updated = await updateSocialMediaCredentials(payload);
      setCredentials(updated);
      setFacebookToken("");
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Impossible d'enregistrer les identifiants.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className={cardClass}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Facebook</h3>
          {credentials && <StatusBadge configured={credentials.facebook_configured} />}
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>ID de la Page Facebook</label>
            <input
              value={facebookPageId}
              onChange={(e) => setFacebookPageId(e.target.value)}
              placeholder="1234567890123456"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Token d&apos;accès Page (longue durée)</label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={facebookToken}
                onChange={(e) => setFacebookToken(e.target.value)}
                placeholder={credentials?.facebook_configured ? "•••••••••••••••• (laisser vide pour ne pas changer)" : "Coller le token d'accès"}
                className={`${inputClass} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowToken((v) => !v)}
                aria-label={showToken ? "Masquer le token" : "Afficher le token"}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
              >
                {showToken ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-neutral-400">
              Généré depuis Meta for Developers (permissions pages_manage_posts, pages_read_engagement). Jamais réaffiché après enregistrement.
            </p>
          </div>
        </div>
      </div>

      <div className={cardClass}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Instagram</h3>
          {credentials && <StatusBadge configured={credentials.instagram_configured} />}
        </div>
        <div>
          <label className={labelClass}>ID du compte Instagram Business</label>
          <input
            value={instagramAccountId}
            onChange={(e) => setInstagramAccountId(e.target.value)}
            placeholder="17841400000000000"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-neutral-400">
            Réutilise le token de la Page Facebook ci-dessus — un compte Instagram Business est toujours lié à une Page Facebook côté Meta.
          </p>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-600">Identifiants enregistrés.</p>}

      <Button onClick={handleSave} disabled={saving}>
        {saving ? <Loader2 className="size-4 animate-spin" /> : null}
        Enregistrer
      </Button>
    </div>
  );
}
