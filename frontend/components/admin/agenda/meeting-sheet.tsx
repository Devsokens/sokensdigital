"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Building2, CalendarDays, Loader2, MapPin, Pencil, Plus, Trash2, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/admin/marketing/rich-text-editor";
import { getMeeting, updateMeeting, getMyMeetingNote, updateMyMeetingNote } from "@/lib/api/administration";
import { cn } from "@/lib/utils";
import type { Appointment, Meeting, MeetingNote } from "@/lib/api/types";

function SaveButton({ onSave }: { onSave: () => Promise<void> }) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function handleClick() {
    setState("saving");
    try {
      await onSave();
      setState("saved");
    } catch {
      setState("error");
    }
  }

  return (
    <div className="mt-3 flex items-center gap-3">
      <Button type="button" onClick={handleClick} disabled={state === "saving"} className="rounded-full px-5">
        {state === "saving" ? <Loader2 className="size-4 animate-spin" /> : "Enregistrer"}
      </Button>
      {state === "saved" && <span className="text-xs text-emerald-600">Enregistré.</span>}
      {state === "error" && <span className="text-xs text-destructive">Échec de l&apos;enregistrement.</span>}
    </div>
  );
}

function formatRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const time = (d: Date) => d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  return `${day} · ${time(start)} – ${time(end)}`;
}

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

/** Ordre du jour : des points ajoutés un par un (« + »), enregistrés à
 * chaque ajout/retrait. */
function AgendaItems({ meeting, appointmentId, onSaved }: { meeting: Meeting; appointmentId: string; onSaved: (m: Meeting) => void }) {
  const [items, setItems] = useState<string[]>(meeting.agenda_items);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function persist(next: string[]) {
    const previous = items;
    setItems(next);
    setSaving(true);
    setError(null);
    try {
      onSaved(await updateMeeting(appointmentId, { agenda_items: next }));
    } catch {
      setItems(previous);
      setError("Impossible d'enregistrer l'ordre du jour.");
    } finally {
      setSaving(false);
    }
  }

  function addItem() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    persist([...items, text]);
  }

  return (
    <div>
      <ol className="space-y-2">
        {items.map((item, index) => (
          <li key={`${index}-${item}`} className="group flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {index + 1}
            </span>
            <span className="flex-1 pt-0.5 text-sm text-neutral-800">{item}</span>
            <button
              type="button"
              onClick={() => persist(items.filter((_, j) => j !== index))}
              disabled={saving}
              className="shrink-0 pt-0.5 text-neutral-300 opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus:opacity-100"
              aria-label={`Retirer le point ${index + 1}`}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ol>

      <div className="mt-2 flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 focus-within:border-primary/50">
        {saving ? <Loader2 className="size-4 shrink-0 animate-spin text-neutral-400" /> : <Plus className="size-4 shrink-0 text-neutral-400" />}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addItem();
            }
          }}
          placeholder={items.length === 0 ? "Ajouter un premier point, puis Entrée…" : "Ajouter un point…"}
          className="w-full bg-transparent py-1 text-sm text-neutral-800 outline-none placeholder:text-neutral-400"
        />
        <button
          type="button"
          onClick={addItem}
          disabled={!draft.trim() || saving}
          className="shrink-0 rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-30"
        >
          Ajouter
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      {meeting.agenda && (
        <div className="mt-6">
          <p className="mb-1.5 text-xs font-semibold tracking-wide text-neutral-400 uppercase">Ancien ordre du jour</p>
          <div
            className="prose-sm max-w-none rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-700 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: meeting.agenda }}
          />
        </div>
      )}
    </div>
  );
}

/** Réunion rattachée à un rendez-vous, en panneau qui glisse depuis la
 * droite : ordre du jour (liste de points), notes personnelles (les siennes
 * éditables, celles des autres en lecture seule) et compte rendu.
 * `open` est séparé d'`appointment` pour garder le contenu affiché pendant
 * que le panneau se referme. */
export function MeetingSheet({
  open,
  appointment,
  onClose,
  onEdit,
}: {
  open: boolean;
  appointment: Appointment | null;
  onClose: () => void;
  /** Ouvre le formulaire du rendez-vous (bouton « Modifier »). */
  onEdit?: (appointment: Appointment) => void;
}) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [myNote, setMyNote] = useState<MeetingNote | null>(null);
  const [minutes, setMinutes] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !appointment) return;
    setMeeting(null);
    setMyNote(null);
    setError(null);
    Promise.all([getMeeting(appointment.id), getMyMeetingNote(appointment.id)])
      .then(([m, note]) => {
        setMeeting(m);
        setMinutes(m.minutes_summary);
        setMyNote(note);
        setNoteBody(note.body);
      })
      .catch(() => setError("Impossible de charger la réunion."));
  }, [open, appointment]);

  const otherNotes = meeting?.notes.filter((n) => n.id !== myNote?.id && n.body.trim()) ?? [];

  return (
    <Dialog.Root open={open && !!appointment} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
            "data-[starting-style]:opacity-0 data-[ending-style]:opacity-0"
          )}
        />
        <Dialog.Popup
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-4xl flex-col overflow-hidden bg-white shadow-2xl",
            "transition-[translate] duration-300 ease-out",
            "data-[starting-style]:translate-x-full data-[ending-style]:translate-x-full"
          )}
        >
          {appointment && (
            <>
              <div className="flex shrink-0 items-start gap-3 border-b border-neutral-100 px-6 py-4">
                <div className="min-w-0 flex-1">
                  <Dialog.Title className="truncate text-lg font-semibold text-neutral-900">{appointment.title}</Dialog.Title>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
                    <span className="flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" /> {formatRange(appointment.start_at, appointment.end_at)}
                    </span>
                    {appointment.location && (
                      <span className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" /> {appointment.location}
                      </span>
                    )}
                    {appointment.video_url && (
                      <a href={appointment.video_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 font-medium text-primary hover:underline">
                        <Video className="size-3.5" /> Rejoindre la visio
                      </a>
                    )}
                    {appointment.client_name && (
                      <span className="flex items-center gap-1.5">
                        <Building2 className="size-3.5" /> {appointment.client_name}
                      </span>
                    )}
                  </div>
                  {appointment.attendees_detail.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {appointment.attendees_detail.map((u) => (
                        <span key={u.id} className="flex items-center gap-1.5 rounded-full bg-neutral-100 py-0.5 pr-2.5 pl-0.5 text-xs text-neutral-700">
                          <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
                            {initials(u.first_name, u.last_name)}
                          </span>
                          {u.first_name} {u.last_name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(appointment)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-neutral-200 px-3.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    <Pencil className="size-3.5" /> Modifier
                  </button>
                )}
                <Dialog.Close
                  aria-label="Fermer"
                  className="shrink-0 rounded-full p-1.5 text-neutral-500 transition-colors hover:bg-black/5 hover:text-neutral-900"
                >
                  <X className="size-4" />
                </Dialog.Close>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                {error && <p className="text-sm text-destructive">{error}</p>}
                {!error && (!meeting || !myNote) && (
                  <div className="flex justify-center py-16">
                    <Loader2 className="size-6 animate-spin text-neutral-400" />
                  </div>
                )}
                {meeting && myNote && (
                  <Tabs defaultValue="ordre">
                    <TabsList>
                      <TabsTab value="ordre">Ordre du jour</TabsTab>
                      <TabsTab value="notes">Notes</TabsTab>
                      <TabsTab value="compte-rendu">Compte rendu</TabsTab>
                      <TabsIndicator />
                    </TabsList>

                    <TabsPanel value="ordre" className="pt-4">
                      <AgendaItems key={meeting.id} meeting={meeting} appointmentId={appointment.id} onSaved={setMeeting} />
                    </TabsPanel>

                    <TabsPanel value="notes" className="pt-4">
                      <p className="mb-2 text-xs text-neutral-500">Mes notes — visibles par les autres participants, modifiables par moi seul.</p>
                      <div className="rounded-lg border border-neutral-200">
                        <RichTextEditor key={`note-${myNote.id}`} value={noteBody} onChange={setNoteBody} />
                      </div>
                      <SaveButton onSave={async () => { setMyNote(await updateMyMeetingNote(appointment.id, noteBody)); }} />

                      {otherNotes.length > 0 && (
                        <div className="mt-6 space-y-3">
                          <p className="text-xs font-semibold tracking-wide text-neutral-400 uppercase">Notes des autres participants</p>
                          {otherNotes.map((n) => (
                            <div key={n.id} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                              <p className="mb-1 text-xs font-medium text-neutral-700">{n.author_name}</p>
                              <div
                                className="prose-sm max-w-none text-sm text-neutral-700 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5"
                                dangerouslySetInnerHTML={{ __html: n.body }}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsPanel>

                    <TabsPanel value="compte-rendu" className="pt-4">
                      <p className="mb-2 text-xs text-neutral-500">Synthèse de la réunion, à partir des notes de chacun.</p>
                      <div className="rounded-lg border border-neutral-200">
                        <RichTextEditor key={`minutes-${meeting.id}`} value={minutes} onChange={setMinutes} />
                      </div>
                      <SaveButton onSave={async () => { setMeeting(await updateMeeting(appointment.id, { minutes_summary: minutes })); }} />
                    </TabsPanel>
                  </Tabs>
                )}
              </div>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
