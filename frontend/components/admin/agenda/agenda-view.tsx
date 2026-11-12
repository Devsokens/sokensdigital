"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { MeetingSheet } from "@/components/admin/agenda/meeting-sheet";
import { MonthCalendar } from "@/components/admin/month-calendar";
import { Button } from "@/components/ui/button";
import { Modal, ModalContent, ModalClose } from "@/components/ui/modal";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { SelectSearch, MultiSelectSearch } from "@/components/admin/multi-select-search";
import { inputClass, labelClass } from "@/components/admin/form-styles";
import {
  listAppointments,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  listClients,
  type AppointmentInput,
} from "@/lib/api/administration";
import { listUsers } from "@/lib/api/hr";
import type { Appointment, Client, UserBrief } from "@/lib/api/types";

// Rendez-vous client en bleu ciel, rendez-vous interne en indigo.
const CLIENT_COLOR = "#0ea5e9";
const INTERNAL_COLOR = "#6366f1";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Formulaire ouvert : `appointment` pour modifier, sinon création avec un
 * début éventuellement pré-rempli (clic sur un jour du calendrier). */
type FormState = { appointment: Appointment | null; initialStart?: string };

export function AgendaView() {
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [form, setForm] = useState<FormState | null>(null);
  const [meetingFor, setMeetingFor] = useState<Appointment | null>(null);
  const [meetingOpen, setMeetingOpen] = useState(false);

  async function load() {
    try {
      const data = await listAppointments();
      setAppointments(data.results);
    } catch {
      setError("Impossible de charger l'agenda.");
    }
  }

  useEffect(() => {
    load();
    listClients().then((res) => setClients(res.results)).catch(() => setClients([]));
    listUsers().then((res) => setUsers(res.results)).catch(() => setUsers([]));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Agenda</h1>
          <p className="mt-1.5 text-sm text-neutral-500">
            Rendez-vous et réunions planifiés — cliquez sur un jour pour en créer un, sur un rendez-vous pour l&apos;ouvrir.
          </p>
        </div>
        <Button onClick={() => setForm({ appointment: null })} className="gap-1.5 rounded-full px-4">
          <Plus className="size-4" /> Nouveau rendez-vous
        </Button>
      </div>

      {!appointments ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <>
          <MonthCalendar
            items={appointments}
            getDate={(a) => a.start_at}
            getKey={(a) => a.id}
            getLabel={(a) => a.title}
            getPrefix={(a) => formatTime(a.start_at)}
            getColor={(a) => (a.client ? CLIENT_COLOR : INTERNAL_COLOR)}
            onSelectDay={(iso) => setForm({ appointment: null, initialStart: `${iso}T09:00` })}
            onSelectItem={(a) => {
              setMeetingFor(a);
              setMeetingOpen(true);
            }}
          />
          <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: CLIENT_COLOR }} /> Avec un client
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2.5 rounded-sm" style={{ background: INTERNAL_COLOR }} /> Interne
            </span>
          </div>
        </>
      )}

      {form && (
        <AppointmentFormModal
          appointment={form.appointment}
          initialStart={form.initialStart}
          clients={clients}
          users={users}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null);
            load();
          }}
        />
      )}

      <MeetingSheet
        open={meetingOpen}
        appointment={meetingFor}
        onClose={() => setMeetingOpen(false)}
        onEdit={(appt) => {
          setMeetingOpen(false);
          setForm({ appointment: appt });
        }}
      />
    </div>
  );
}

function AppointmentFormModal({
  appointment,
  initialStart,
  clients,
  users,
  onClose,
  onSaved,
}: {
  appointment: Appointment | null;
  initialStart?: string;
  clients: Client[];
  users: UserBrief[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(appointment);
  const [defaults] = useState(() => {
    if (appointment) return { start: new Date(appointment.start_at), end: new Date(appointment.end_at) };
    const start = initialStart ? new Date(initialStart) : new Date();
    return { start, end: new Date(start.getTime() + 60 * 60 * 1000) };
  });

  const [title, setTitle] = useState(appointment?.title ?? "");
  const [description, setDescription] = useState(appointment?.description ?? "");
  const [startAt, setStartAt] = useState(toLocalInputValue(defaults.start));
  const [endAt, setEndAt] = useState(toLocalInputValue(defaults.end));
  const [location, setLocation] = useState(appointment?.location ?? "");
  const [kind, setKind] = useState<"RENDEZ_VOUS" | "REUNION">(appointment?.kind ?? "REUNION");
  const [videoUrl, setVideoUrl] = useState(appointment?.video_url ?? "");
  const [clientId, setClientId] = useState<string | null>(appointment?.client ?? null);
  const [attendeeIds, setAttendeeIds] = useState<string[]>(appointment?.attendees ?? []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const data: AppointmentInput = {
      title,
      description,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      location,
      kind,
      video_url: videoUrl.trim(),
      client: clientId,
      attendees: attendeeIds,
    };
    try {
      if (isEdit && appointment) {
        await updateAppointment(appointment.id, data);
      } else {
        await createAppointment(data);
      }
      onSaved();
    } catch {
      setError("Impossible d'enregistrer ce rendez-vous — vérifie les dates et réessaie.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onOpenChange={(open) => !open && onClose()}>
      <ModalContent title={isEdit ? "Modifier le rendez-vous" : "Nouveau rendez-vous"} className="max-h-[92dvh] max-w-4xl sm:max-h-[85vh]">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}

          {/* Deux colonnes : tout tient à l'écran, sans défilement. */}
          <div className="grid gap-x-6 gap-y-4 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <span className={labelClass}>Type</span>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ["REUNION", "Réunion", "Participants notifiés"],
                    ["RENDEZ_VOUS", "Rendez-vous", "Toute l'équipe notifiée"],
                  ] as const).map(([value, label, hint]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setKind(value)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${kind === value ? "border-primary bg-primary/10 text-neutral-900" : "border-neutral-200 text-neutral-600 hover:border-neutral-300"}`}
                    >
                      <span className="block font-medium">{label}</span>
                      <span className="block text-xs text-neutral-500">{hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className={labelClass}>Titre</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
              </label>

              {/* Date + heure : trop étroit à deux par ligne sur téléphone. */}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Début</span>
                  <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputClass} required />
                </label>
                <label className="block">
                  <span className={labelClass}>Fin</span>
                  <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className={inputClass} required />
                </label>
              </div>

              <label className="block">
                <span className={labelClass}>Lieu</span>
                <input value={location} onChange={(e) => setLocation(e.target.value)} className={inputClass} placeholder="Bureau, visio, chez le client…" />
              </label>

              <label className="block">
                <span className={labelClass}>Lien visio</span>
                <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} className={inputClass} placeholder="https://meet.google.com/…" />
              </label>

              <label className="block">
                <span className={labelClass}>Client lié</span>
                <SelectSearch
                  options={clients.map((c) => ({ id: c.id, label: c.company_name }))}
                  value={clientId}
                  onChange={setClientId}
                  placeholder="Aucun"
                />
              </label>
            </div>

            <div className="space-y-4">
              <label className="block">
                <span className={labelClass}>Participants</span>
                <MultiSelectSearch
                  options={users.map((u) => ({ id: u.id, label: `${u.first_name} ${u.last_name}` }))}
                  values={attendeeIds}
                  onChange={setAttendeeIds}
                />
                <span className="mt-1 block text-[11px] text-neutral-400">Ils seront prévenus par notification et par e-mail.</span>
              </label>

              <label className="block">
                <span className={labelClass}>Notes</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={5} className={`${inputClass} resize-none`} />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-neutral-100 pt-4">
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving} className="rounded-full px-6">
                {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Enregistrer" : "Créer"}
              </Button>
              <ModalClose render={<Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose}>Annuler</Button>} />
            </div>
            {isEdit && appointment && (
              <ConfirmModal
                title="Supprimer le rendez-vous"
                description={`Supprimer « ${appointment.title} » ? Cette action est irréversible.`}
                onConfirm={async () => {
                  await deleteAppointment(appointment.id);
                  onSaved();
                }}
                trigger={
                  <button type="button" className="flex items-center gap-1.5 text-xs font-medium text-destructive hover:underline">
                    <Trash2 className="size-3.5" /> Supprimer
                  </button>
                }
              />
            )}
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
