"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, NotebookPen, Plus, Trash2 } from "lucide-react";
import { MeetingSheet } from "@/components/admin/agenda/meeting-sheet";
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
import { cn } from "@/lib/utils";

const DAY_LABELS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // lundi = 0
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function toLocalInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function AgendaView() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [appointments, setAppointments] = useState<Appointment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [users, setUsers] = useState<UserBrief[]>([]);
  const [editing, setEditing] = useState<Appointment | null | undefined>(undefined);
  const [meetingFor, setMeetingFor] = useState<Appointment | null>(null);

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

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  const byDay = useMemo(() => {
    const map = new Map<number, Appointment[]>();
    if (!appointments) return map;
    for (const day of days) {
      const list = appointments
        .filter((a) => sameDay(new Date(a.start_at), day))
        .sort((a, b) => a.start_at.localeCompare(b.start_at));
      map.set(day.getTime(), list);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointments, weekStart]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Agenda</h1>
          <p className="mt-1.5 text-sm text-neutral-500">Rendez-vous et réunions planifiés.</p>
        </div>
        <Button onClick={() => setEditing(null)} className="gap-1.5 rounded-full px-4">
          <Plus className="size-4" /> Nouveau rendez-vous
        </Button>
      </div>

      <div className="mb-4 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setWeekStart((d) => addDays(d, -7))}
          className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="rounded-full border border-neutral-200 bg-white px-3.5 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Aujourd&apos;hui
        </button>
        <button
          type="button"
          onClick={() => setWeekStart((d) => addDays(d, 7))}
          className="flex size-8 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
        >
          <ChevronRight className="size-4" />
        </button>
        <span className="ml-2 text-sm font-medium text-neutral-600">
          {days[0].toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })} – {days[6].toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </div>

      {!appointments ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-neutral-400" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
          {days.map((day) => {
            const isToday = sameDay(day, new Date());
            const list = byDay.get(day.getTime()) ?? [];
            return (
              <div key={day.toISOString()} className="min-h-[220px] rounded-xl border border-neutral-200 bg-white p-3">
                <p className={cn("mb-2 text-xs font-semibold uppercase tracking-wide", isToday ? "text-primary" : "text-neutral-400")}>
                  {DAY_LABELS[(day.getDay() + 6) % 7]} {day.getDate()}
                </p>
                <div className="space-y-1.5">
                  {list.map((appt) => (
                    <button
                      key={appt.id}
                      type="button"
                      onClick={() => setEditing(appt)}
                      className="block w-full rounded-lg bg-primary/5 px-2.5 py-1.5 text-left transition-colors hover:bg-primary/10"
                    >
                      <span className="block text-xs font-medium text-primary">{formatTime(appt.start_at)}</span>
                      <span className="block truncate text-xs text-neutral-700">{appt.title}</span>
                    </button>
                  ))}
                  {list.length === 0 && <p className="text-xs text-neutral-300">—</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editing !== undefined && (
        <AppointmentFormModal
          appointment={editing}
          clients={clients}
          users={users}
          onClose={() => setEditing(undefined)}
          onSaved={() => {
            setEditing(undefined);
            load();
          }}
          onOpenMeeting={(appt) => {
            setEditing(undefined);
            setMeetingFor(appt);
          }}
        />
      )}

      <MeetingSheet appointment={meetingFor} onClose={() => setMeetingFor(null)} />
    </div>
  );
}

function AppointmentFormModal({
  appointment,
  clients,
  users,
  onClose,
  onSaved,
  onOpenMeeting,
}: {
  appointment: Appointment | null;
  clients: Client[];
  users: UserBrief[];
  onClose: () => void;
  onSaved: () => void;
  onOpenMeeting: (appointment: Appointment) => void;
}) {
  const isEdit = Boolean(appointment);
  const now = new Date();
  const defaultStart = appointment ? new Date(appointment.start_at) : now;
  const defaultEnd = appointment ? new Date(appointment.end_at) : new Date(now.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(appointment?.title ?? "");
  const [description, setDescription] = useState(appointment?.description ?? "");
  const [startAt, setStartAt] = useState(toLocalInputValue(defaultStart));
  const [endAt, setEndAt] = useState(toLocalInputValue(defaultEnd));
  const [location, setLocation] = useState(appointment?.location ?? "");
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
      <ModalContent title={isEdit ? "Modifier le rendez-vous" : "Nouveau rendez-vous"} className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-xs text-destructive">
              {error}
            </p>
          )}

          <label className="block">
            <span className={labelClass}>Titre</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} required />
          </label>

          <div className="grid grid-cols-2 gap-3">
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
            <span className={labelClass}>Client lié</span>
            <SelectSearch
              options={clients.map((c) => ({ id: c.id, label: c.company_name }))}
              value={clientId}
              onChange={setClientId}
              placeholder="Aucun"
            />
          </label>

          <label className="block">
            <span className={labelClass}>Participants</span>
            <MultiSelectSearch
              options={users.map((u) => ({ id: u.id, label: `${u.first_name} ${u.last_name}` }))}
              values={attendeeIds}
              onChange={setAttendeeIds}
            />
          </label>

          <label className="block">
            <span className={labelClass}>Notes</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputClass} resize-none`} />
          </label>

          <div className="flex items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={saving} className="rounded-full px-6">
                {saving ? <Loader2 className="size-4 animate-spin" /> : isEdit ? "Enregistrer" : "Créer"}
              </Button>
              <ModalClose render={<Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose}>Annuler</Button>} />
            </div>
            {isEdit && appointment && (
              <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => onOpenMeeting(appointment)}
                className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <NotebookPen className="size-3.5" /> Réunion
              </button>
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
              </div>
            )}
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
