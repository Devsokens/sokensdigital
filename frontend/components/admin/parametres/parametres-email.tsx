"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cardClass, inputClass, labelClass } from "@/components/admin/form-styles";
import { RichTextEditor } from "@/components/admin/marketing/rich-text-editor";
import { listEmailTemplates, resetEmailTemplate, saveEmailTemplate } from "@/lib/api/email-templates";
import type { EmailTemplateEntry } from "@/lib/api/types";

function TemplateEditor({
  template,
  onSaved,
}: {
  template: EmailTemplateEntry;
  onSaved: (updated: EmailTemplateEntry) => void;
}) {
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body_html);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleSave() {
    setState("saving");
    try {
      onSaved(await saveEmailTemplate(template.key, { subject, body_html: body }));
      setState("saved");
    } catch {
      setState("error");
    }
  }

  async function handleReset() {
    setState("saving");
    try {
      const fresh = await resetEmailTemplate(template.key);
      onSaved(fresh);
      setSubject(fresh.subject);
      setBody(fresh.body_html);
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className={cardClass}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-900">{template.label}</p>
          <p className="text-xs text-neutral-500">{template.description}</p>
        </div>
        {template.is_customized && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="size-3.5" /> Personnalisé
          </span>
        )}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {Object.entries(template.variables).map(([name, description]) => (
          <span
            key={name}
            title={description}
            className="rounded-full bg-neutral-100 px-2.5 py-1 font-mono text-xs text-neutral-600"
          >
            {`{{${name}}}`}
          </span>
        ))}
      </div>

      <label className={labelClass} htmlFor={`subject-${template.key}`}>Objet</label>
      <input
        id={`subject-${template.key}`}
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        className={`${inputClass} mb-3`}
      />

      <label className={labelClass}>Corps</label>
      <div className="rounded-lg border border-neutral-200">
        <RichTextEditor key={template.key} value={body} onChange={setBody} />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={handleSave} disabled={state === "saving"} className="rounded-full px-5">
          {state === "saving" ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
        </Button>
        {template.is_customized && (
          <button
            type="button"
            onClick={handleReset}
            disabled={state === "saving"}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-800"
          >
            <RotateCcw className="size-3.5" /> Revenir au texte par défaut
          </button>
        )}
        {state === "saved" && <span className="text-xs text-emerald-600">Enregistré.</span>}
        {state === "error" && <span className="text-xs text-destructive">Échec de l&apos;enregistrement.</span>}
      </div>
    </div>
  );
}

export function ParametresEmail() {
  const [templates, setTemplates] = useState<EmailTemplateEntry[] | null>(null);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listEmailTemplates()
      .then((data) => {
        setTemplates(data);
        setSelectedKey(data[0]?.key ?? null);
      })
      .catch(() => setError("Impossible de charger les gabarits."));
  }, []);

  function handleSaved(updated: EmailTemplateEntry) {
    setTemplates((prev) => prev?.map((t) => (t.key === updated.key ? updated : t)) ?? prev);
  }

  const selected = templates?.find((t) => t.key === selectedKey) ?? null;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold text-neutral-900">E-mail</h1>
      <p className="mb-6 text-sm text-neutral-500">
        Texte des e-mails envoyés automatiquement par la plateforme. Les variables entre accolades sont
        remplacées à l&apos;envoi ; sans personnalisation, le texte par défaut s&apos;applique.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!error && !templates && (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      )}

      {templates && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
          <div className="space-y-1.5">
            {templates.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setSelectedKey(t.key)}
                className={`flex w-full items-center justify-between rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors ${
                  t.key === selectedKey
                    ? "border-primary/40 bg-primary/5 text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                }`}
              >
                <span>{t.label}</span>
                {t.is_customized && <span className="size-2 shrink-0 rounded-full bg-emerald-500" />}
              </button>
            ))}
          </div>
          {selected && <TemplateEditor key={selected.key} template={selected} onSaved={handleSaved} />}
        </div>
      )}
    </div>
  );
}
