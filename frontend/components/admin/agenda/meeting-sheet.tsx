"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTab, TabsIndicator, TabsPanel } from "@/components/ui/tabs";
import { RichTextEditor } from "@/components/admin/marketing/rich-text-editor";
import { getMeeting, updateMeeting, getMyMeetingNote, updateMyMeetingNote } from "@/lib/api/administration";
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

/** Réunion rattachée à un rendez-vous : ordre du jour et compte rendu
 * partagés, notes personnelles par participant (les siennes éditables,
 * celles des autres en lecture seule). */
export function MeetingSheet({ appointment, onClose }: { appointment: Appointment | null; onClose: () => void }) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [myNote, setMyNote] = useState<MeetingNote | null>(null);
  const [agenda, setAgenda] = useState("");
  const [minutes, setMinutes] = useState("");
  const [noteBody, setNoteBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appointment) return;
    setMeeting(null);
    setMyNote(null);
    setError(null);
    Promise.all([getMeeting(appointment.id), getMyMeetingNote(appointment.id)])
      .then(([m, note]) => {
        setMeeting(m);
        setAgenda(m.agenda);
        setMinutes(m.minutes_summary);
        setMyNote(note);
        setNoteBody(note.body);
      })
      .catch(() => setError("Impossible de charger la réunion."));
  }, [appointment]);

  if (!appointment) return null;

  const otherNotes = meeting?.notes.filter((n) => n.id !== myNote?.id && n.body.trim()) ?? [];

  return (
    <Sheet open={!!appointment} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent title={`Réunion — ${appointment.title}`} className="max-w-3xl">
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
              <div className="rounded-lg border border-neutral-200">
                <RichTextEditor key={`agenda-${meeting.id}`} value={agenda} onChange={setAgenda} />
              </div>
              <SaveButton onSave={async () => { setMeeting(await updateMeeting(appointment.id, { agenda })); }} />
            </TabsPanel>

            <TabsPanel value="notes" className="pt-4">
              <p className="mb-2 text-xs text-neutral-500">Mes notes — visibles par les autres participants, modifiables par moi seul.</p>
              <div className="rounded-lg border border-neutral-200">
                <RichTextEditor key={`note-${myNote.id}`} value={noteBody} onChange={setNoteBody} />
              </div>
              <SaveButton onSave={async () => { setMyNote(await updateMyMeetingNote(appointment.id, noteBody)); }} />

              {otherNotes.length > 0 && (
                <div className="mt-6 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Notes des autres participants</p>
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
      </SheetContent>
    </Sheet>
  );
}
