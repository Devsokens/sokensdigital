"use client";

import { markChatRoomRead, openChatAttachment } from "@/lib/api/upload";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCheck,
  CornerUpLeft,
  FileText,
  FolderKanban,
  Globe,
  Link2,
  Loader2,
  MessageSquarePlus,
  MoreVertical,
  Paperclip,
  Pin,
  Search,
  SendHorizontal,
  Smile,
  Target,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import {
  getOrCreateDirectRoom,
  sendMessage,
  subscribeToMessages,
  subscribeToRooms,
  toggleReaction,
  togglePinned,
  uploadChatAttachment,
} from "@/lib/firebase/chat";
import { listProfiles } from "@/lib/firebase/profile";
import { profileRoles, type ChatMessage, type ChatRoom, type LinkedEntityType, type Profile } from "@/lib/firebase/types";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { listProjects } from "@/lib/api/projects";
import { listLeads, listQuotes } from "@/lib/api/marketing";

/* Messagerie au format des applications de messagerie mobiles :
 * - liste des discussions à gauche (plein écran sur mobile), filtres en
 *   pastilles, recherche ;
 * - conversation à droite : en-tête avec avatar, fond texturé, bulles
 *   (les miennes à droite en vert clair, les autres à gauche en blanc),
 *   heure dans la bulle, séparateurs de jour, barre de saisie arrondie avec
 *   bouton d'envoi rond ;
 * - réponses en fil, réactions et épingles conservées. */

const ROOM_TYPE_ICON: Record<ChatRoom["roomType"], React.ComponentType<{ className?: string }>> = {
  COMPANY: Globe,
  DEPARTMENT: Building2,
  PROJECT: FolderKanban,
  DIRECT: MessageSquarePlus,
};

const ROOM_TYPE_LABEL: Record<ChatRoom["roomType"], string> = {
  COMPANY: "Annonces de l'entreprise",
  DEPARTMENT: "Groupe du département",
  PROJECT: "Groupe projet",
  DIRECT: "Discussion privée",
};

type Filter = "ALL" | "GROUPS" | "DIRECT";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "ALL", label: "Toutes" },
  { key: "GROUPS", label: "Groupes" },
  { key: "DIRECT", label: "Privées" },
];

const ROOM_ORDER: Record<ChatRoom["roomType"], number> = { COMPANY: 0, DEPARTMENT: 1, PROJECT: 2, DIRECT: 3 };

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "🙏", "✅"];

// Couleurs de nom d'auteur dans les groupes (stables par personne).
const AUTHOR_COLORS = ["text-emerald-700", "text-sky-700", "text-violet-700", "text-rose-700", "text-amber-700", "text-teal-700", "text-indigo-700", "text-fuchsia-700"];

const LINKED_ENTITY_META: Record<LinkedEntityType, { label: string; icon: React.ComponentType<{ className?: string }>; href: (id: string) => string }> = {
  project: { label: "Projet", icon: FolderKanban, href: (id) => `/admin/technique/projets/${id}` },
  lead: { label: "Lead", icon: Target, href: () => `/admin/marketing/leads` },
  quote: { label: "Devis", icon: FileText, href: () => `/admin/marketing/devis` },
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

function hash(value: string) {
  let h = 0;
  for (let i = 0; i < value.length; i++) h = (h * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function toDate(value: unknown): Date | null {
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate();
  }
  return null;
}

function formatTime(value: unknown) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";
}

function toMillis(value: unknown): number {
  return toDate(value)?.getTime() ?? 0;
}

/** Heure (aujourd'hui), « Hier », ou date courte — comme dans une liste de discussions. */
function formatListTime(value: unknown) {
  const d = toDate(value);
  if (!d) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatDay(value: unknown) {
  const d = toDate(value);
  if (!d) return "";
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui";
  if (d.toDateString() === yesterday.toDateString()) return "Hier";
  return d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
}

function Avatar({ name, room, size = "md" }: { name: string; room?: ChatRoom; size?: "sm" | "md" | "lg" }) {
  const Icon = room && room.roomType !== "DIRECT" ? ROOM_TYPE_ICON[room.roomType] : null;
  const palette = ["bg-emerald-600", "bg-sky-600", "bg-violet-600", "bg-rose-600", "bg-amber-600", "bg-teal-600", "bg-indigo-600"];
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "sm" && "size-8 text-[11px]",
        size === "md" && "size-12 text-sm",
        size === "lg" && "size-10 text-sm",
        Icon ? "bg-(--wa-avatar) text-(--wa-icon)" : palette[hash(name) % palette.length],
      )}
    >
      {Icon ? <Icon className={size === "md" ? "size-5" : "size-4"} /> : initials(name)}
    </span>
  );
}

export function Chat() {
  const { user, profile } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  // undefined = pas encore choisi (salon du lien ou par défaut) ; null = liste affichée.
  const [chosenRoomId, setActiveRoomId] = useState<string | null | undefined>(undefined);
  const [roomMessages, setRoomMessages] = useState<{ roomId: string | null; list: ChatMessage[] }>({ roomId: null, list: [] });
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [thread, setThread] = useState<{ roomId: string | null; id: string } | null>(null);
  const [pendingAttachment, setPendingAttachment] = useState<ChatMessage["attachment"]>(null);
  const [pendingLink, setPendingLink] = useState<ChatMessage["linkedEntity"]>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sur ordinateur, une conversation est ouverte d'office ; sur mobile, on
  // commence par la liste (comme une application de messagerie).
  const desktop = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1024px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1024px)").matches,
    () => false,
  );

  useEffect(() => {
    if (!user) return;
    return subscribeToRooms(
      { departmentId: profile?.departmentId ?? null, uid: user.uid },
      (nextRooms) => setRooms(nextRooms),
    );
  }, [user, profile?.departmentId]);

  const roomFromLink = useSearchParams().get("room");
  const activeRoomId =
    chosenRoomId !== undefined ? chosenRoomId : (roomFromLink && rooms.some((r) => r.id === roomFromLink) ? roomFromLink : null) ?? (desktop && rooms.length > 0 ? rooms.find((r) => r.roomType !== "DIRECT")?.id ?? rooms[0].id : null);

  useEffect(() => {
    if (!activeRoomId) return;
    return subscribeToMessages(activeRoomId, (list) => setRoomMessages({ roomId: activeRoomId, list }));
  }, [activeRoomId]);

  // Accusé de lecture : à l'ouverture et à chaque nouveau message tant que
  // la discussion est affichée et l'onglet visible (léger délai groupé).
  const lastMessageId = roomMessages.roomId === activeRoomId ? roomMessages.list[roomMessages.list.length - 1]?.id : undefined;
  useEffect(() => {
    if (!activeRoomId) return;
    const timer = window.setTimeout(() => {
      if (document.visibilityState === "visible") markChatRoomRead(activeRoomId).catch(() => {});
    }, 800);
    return () => window.clearTimeout(timer);
  }, [activeRoomId, lastMessageId]);

  // Messages et fil ouvert n'appartiennent qu'au salon affiché.
  const messages = useMemo(() => (roomMessages.roomId === activeRoomId ? roomMessages.list : []), [roomMessages, activeRoomId]);
  const threadRootId = thread && thread.roomId === activeRoomId ? thread.id : null;
  const setThreadRootId = (id: string | null) => setThread(id ? { roomId: activeRoomId, id } : null);

  useEffect(() => {
    if (!threadRootId) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, threadRootId]);

  function roomDisplayName(room: ChatRoom) {
    if (room.roomType === "DIRECT" && user) {
      const otherUid = room.memberUids?.find((uid) => uid !== user.uid);
      return (otherUid && room.participantNames?.[otherUid]) || "Conversation";
    }
    return room.name;
  }

  const visibleRooms = useMemo(() => {
    return rooms
      .filter((room) => (filter === "ALL" ? true : filter === "DIRECT" ? room.roomType === "DIRECT" : room.roomType !== "DIRECT"))
      .filter((room) => matchesSearch(room, search, user?.uid))
      .sort(
        (a, b) =>
          toMillis(b.lastMessage?.createdAt) - toMillis(a.lastMessage?.createdAt) ||
          ROOM_ORDER[a.roomType] - ROOM_ORDER[b.roomType] ||
          roomDisplayName(a).localeCompare(roomDisplayName(b)),
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, filter, search, user?.uid]);

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null;
  const isGroup = activeRoom ? activeRoom.roomType !== "DIRECT" : false;
  const rootMessages = messages.filter((m) => !m.parentMessageId);
  const repliesOf = (id: string) => messages.filter((m) => m.parentMessageId === id);
  const threadRoot = threadRootId ? messages.find((m) => m.id === threadRootId) ?? null : null;
  const pinnedMessages = messages.filter((m) => m.pinned);
  const filesMessages = messages.filter((m) => m.attachment);

  const canPostInActiveRoom =
    !activeRoom ||
    activeRoom.roomType !== "COMPANY" ||
    profileRoles(profile).some((r) => r === "SUPER_ADMIN" || r === "RESPONSABLE_MARKETING_COM");

  async function handleStartDm(other: Profile & { uid: string }) {
    if (!user || !profile) return;
    const roomId = await getOrCreateDirectRoom(
      { uid: user.uid, name: `${profile.firstName} ${profile.lastName}` },
      { uid: other.uid, name: `${other.firstName} ${other.lastName}` },
    );
    setNewChatOpen(false);
    setActiveRoomId(roomId);
  }

  async function handleSend(text: string, parentMessageId?: string) {
    if ((!text.trim() && !pendingAttachment) || !activeRoomId || !user || !profile) return;
    await sendMessage(activeRoomId, {
      text: text.trim(),
      authorUid: user.uid,
      authorName: `${profile.firstName} ${profile.lastName}`,
      parentMessageId,
      attachment: parentMessageId ? undefined : pendingAttachment,
      linkedEntity: parentMessageId ? undefined : pendingLink,
    });
    if (!parentMessageId) {
      setPendingAttachment(null);
      setPendingLink(null);
    }
    // Aperçu « dernier message » + notifications (in-app et push) aux autres
    // membres — seulement pour les messages principaux, pas les réponses en fil.
    markChatRoomRead(activeRoomId, { sent: !parentMessageId }).catch(() => {});
  }

  /** État de lecture d'un de mes messages : lu par tous (discussion privée
   * ou groupe à membres connus), ou par au moins un collègue (grands groupes). */
  function readState(message: ChatMessage): { read: boolean; readers: number } {
    const at = toMillis(message.createdAt);
    const readAt = activeRoom?.readAt ?? {};
    const readers = Object.entries(readAt).filter(([uid, v]) => uid !== user?.uid && toMillis(v) >= at).map(([uid]) => uid);
    const others = (activeRoom?.memberUids ?? []).filter((uid) => uid !== user?.uid);
    const read = others.length > 0 ? others.every((uid) => readers.includes(uid)) : readers.length > 0;
    return { read, readers: readers.length };
  }

  async function handleReact(message: ChatMessage, emoji: string) {
    if (!activeRoomId || !user) return;
    const already = (message.reactions?.[emoji] ?? []).includes(user.uid);
    await toggleReaction(activeRoomId, message.id, emoji, user.uid, already);
  }

  async function handlePin(message: ChatMessage) {
    if (!activeRoomId || !user) return;
    await togglePinned(activeRoomId, message.id, !message.pinned, user.uid);
  }

  // `dvh` et non `vh` : la barre d'URL mobile fausse `100vh`.
  return (
    <div className="flex h-[calc(100dvh-13rem-env(safe-area-inset-bottom))] min-h-[24rem] wa overflow-hidden rounded-xl border border-(--wa-border) bg-(--wa-surface) shadow-sm sm:h-[calc(100dvh-13.5rem-env(safe-area-inset-bottom))] lg:h-[calc(100dvh-8rem)]">
      {/* ===== Liste des discussions ===== */}
      <aside
        data-tour="module-messagerie"
        className={cn(
          "relative min-h-0 flex-col border-r border-(--wa-border) bg-(--wa-surface) lg:flex lg:w-[380px] lg:shrink-0",
          activeRoom ? "hidden" : "flex w-full",
        )}
      >
        <header className="flex h-16 shrink-0 items-center justify-between bg-(--wa-panel) px-4">
          <h1 className="text-xl font-bold text-(--wa-text)">Discussions</h1>
          <button
            type="button"
            onClick={() => setNewChatOpen(true)}
            title="Nouvelle discussion"
            aria-label="Nouvelle discussion"
            className="flex size-10 items-center justify-center rounded-full text-(--wa-icon) hover:bg-black/5"
          >
            <MessageSquarePlus className="size-5" />
          </button>
        </header>

        <div className="shrink-0 space-y-2 px-3 pt-2 pb-2">
          <label className="flex items-center gap-3 rounded-lg bg-(--wa-panel) px-3 py-2">
            <Search className="size-4 shrink-0 text-(--wa-icon)" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une discussion"
              className="w-full min-w-0 bg-transparent text-sm text-(--wa-text) outline-none placeholder:text-(--wa-muted)"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Effacer" className="text-(--wa-icon)">
                <X className="size-4" />
              </button>
            )}
          </label>
          <div className="flex gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-sm transition-colors",
                  filter === f.key ? "bg-(--wa-chip) font-medium text-(--wa-accent)" : "bg-(--wa-panel) text-(--wa-icon) hover:bg-(--wa-divider)",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visibleRooms.length === 0 && (
            <p className="px-6 py-10 text-center text-sm text-(--wa-muted)">
              {search ? "Aucune discussion trouvée." : "Aucune discussion pour l'instant."}
            </p>
          )}
          {visibleRooms.map((room) => {
            const name = roomDisplayName(room);
            const active = room.id === activeRoomId;
            const last = room.lastMessage;
            const mine = Boolean(last && last.authorUid === user?.uid);
            const myRead = toMillis(room.readAt?.[user?.uid ?? ""]);
            const unread = Boolean(last && !mine && toMillis(last.createdAt) > myRead && !active);
            const lastAt = toMillis(last?.createdAt);
            const othersRead = mine
              ? (room.memberUids ?? []).filter((u) => u !== user?.uid).length > 0
                ? (room.memberUids ?? []).filter((u) => u !== user?.uid).every((u) => toMillis(room.readAt?.[u]) >= lastAt)
                : Object.entries(room.readAt ?? {}).some(([u, v]) => u !== user?.uid && toMillis(v) >= lastAt)
              : false;
            const preview = last
              ? `${!mine && room.roomType !== "DIRECT" ? `${last.authorName.split(" ")[0]} : ` : ""}${last.text || (last.hasAttachment ? "📎 Fichier" : "")}`
              : ROOM_TYPE_LABEL[room.roomType];
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setActiveRoomId(room.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 text-left transition-colors",
                  active ? "bg-(--wa-panel)" : "hover:bg-(--wa-hover)",
                )}
              >
                <Avatar name={name} room={room} />
                <span className="flex min-w-0 flex-1 flex-col border-b border-(--wa-divider) py-3">
                  <span className="flex items-baseline gap-2">
                    <span className={cn("min-w-0 flex-1 truncate text-[15px] text-(--wa-text)", unread && "font-semibold")}>{name}</span>
                    {last && (
                      <span className={cn("shrink-0 text-xs", unread ? "font-medium text-[#25d366]" : "text-(--wa-muted)")}>
                        {formatListTime(last.createdAt)}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    {mine && (othersRead ? <CheckCheck className="size-4 shrink-0 text-sky-400" /> : <CheckCheck className="size-4 shrink-0 text-(--wa-muted)" />)}
                    <span className={cn("min-w-0 flex-1 truncate text-[13px]", unread ? "font-medium text-(--wa-text)" : "text-(--wa-muted)")}>{preview}</span>
                    {unread && <span className="size-2.5 shrink-0 rounded-full bg-[#25d366]" aria-label="Non lu" />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        {newChatOpen && (
          <NewChatPanel currentUid={user?.uid} onClose={() => setNewChatOpen(false)} onPick={handleStartDm} />
        )}
      </aside>

      {/* ===== Conversation ===== */}
      <section className={cn("min-h-0 min-w-0 flex-1 flex-col lg:flex", activeRoom ? "flex" : "hidden lg:flex")}>
        {activeRoom ? (
          <>
            <header className="flex h-16 shrink-0 items-center gap-3 border-l border-(--wa-border) bg-(--wa-panel) px-2 sm:px-4 lg:border-l-0">
              <button
                type="button"
                onClick={() => setActiveRoomId(null)}
                aria-label="Retour aux discussions"
                className="flex size-10 items-center justify-center rounded-full text-(--wa-icon) hover:bg-black/5 lg:hidden"
              >
                <ArrowLeft className="size-5" />
              </button>
              <Avatar name={roomDisplayName(activeRoom)} room={activeRoom} size="lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-medium text-(--wa-text)">{roomDisplayName(activeRoom)}</p>
                <p className="truncate text-xs text-(--wa-muted)">{ROOM_TYPE_LABEL[activeRoom.roomType]}</p>
              </div>
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      title="Messages épinglés"
                      aria-label="Messages épinglés"
                      className="relative flex size-10 items-center justify-center rounded-full text-(--wa-icon) hover:bg-black/5"
                    >
                      <Pin className="size-5" />
                      {pinnedMessages.length > 0 && (
                        <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-[#25d366] text-[9px] font-bold text-white">
                          {pinnedMessages.length}
                        </span>
                      )}
                    </button>
                  }
                />
                <PopoverContent className="wa bg-(--wa-surface) max-h-80 w-72 overflow-y-auto p-2" align="end">
                  <p className="px-2.5 pb-1 text-xs font-semibold text-(--wa-muted)">Messages épinglés</p>
                  {pinnedMessages.length === 0 && <p className="p-3 text-xs text-(--wa-muted)">Aucun message épinglé.</p>}
                  {pinnedMessages.map((m) => (
                    <div key={m.id} className="rounded-lg px-2.5 py-2 hover:bg-(--wa-hover)">
                      <p className="text-xs font-medium text-(--wa-text)">{m.authorName}</p>
                      <p className="truncate text-xs text-(--wa-muted)">{m.text || m.attachment?.name}</p>
                    </div>
                  ))}
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger
                  render={
                    <button
                      type="button"
                      title="Fichiers partagés"
                      aria-label="Fichiers partagés"
                      className="flex size-10 items-center justify-center rounded-full text-(--wa-icon) hover:bg-black/5"
                    >
                      <MoreVertical className="size-5" />
                    </button>
                  }
                />
                <PopoverContent className="wa bg-(--wa-surface) max-h-80 w-72 overflow-y-auto p-2" align="end">
                  <p className="px-2.5 pb-1 text-xs font-semibold text-(--wa-muted)">Fichiers partagés</p>
                  {filesMessages.length === 0 && <p className="p-3 text-xs text-(--wa-muted)">Aucun fichier partagé.</p>}
                  {filesMessages.map((m) => (
                    <a
                      key={m.id}
                      href={m.attachment?.url}
                      target="_blank"
                      rel="noreferrer"
                      download={m.attachment?.name}
                      onClick={(e) => {
                        if (!activeRoomId) return;
                        e.preventDefault();
                        openChatAttachment(activeRoomId, m.id);
                      }}
                      className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs text-(--wa-text) hover:bg-(--wa-hover)"
                    >
                      <FileText className="size-4 shrink-0 text-(--wa-icon)" />
                      <span className="truncate">{m.attachment?.name}</span>
                    </a>
                  ))}
                </PopoverContent>
              </Popover>
            </header>

            <div className="relative flex min-h-0 flex-1 overflow-hidden">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                <div
                  className="wa-wallpaper min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-[6%]"
                >
                  {rootMessages.length === 0 && (
                    <div className="mx-auto mt-6 max-w-sm rounded-lg bg-(--wa-notice) px-4 py-2.5 text-center text-xs text-(--wa-icon) shadow-sm">
                      Aucun message. Écrivez le premier !
                    </div>
                  )}
                  {rootMessages.map((message, index) => {
                    const prev = index > 0 ? rootMessages[index - 1] : null;
                    const day = formatDay(message.createdAt);
                    const newDay = !prev || formatDay(prev.createdAt) !== day;
                    // Messages consécutifs d'une même personne : bulles groupées.
                    const firstOfGroup = newDay || !prev || prev.authorUid !== message.authorUid;
                    return (
                      <div key={message.id}>
                        {newDay && day && (
                          <div className="my-3 flex justify-center">
                            <span className="rounded-lg bg-(--wa-surface) px-3 py-1 text-xs text-(--wa-icon) shadow-sm">{day}</span>
                          </div>
                        )}
                        <MessageBubble
                          roomId={activeRoomId}
                          message={message}
                          isSelf={message.authorUid === user?.uid}
                          showAuthor={isGroup && firstOfGroup}
                          firstOfGroup={firstOfGroup}
                          replyCount={repliesOf(message.id).length}
                          onReact={(emoji) => handleReact(message, emoji)}
                          onPin={() => handlePin(message)}
                          onOpenThread={() => setThreadRootId(message.id)}
                          currentUid={user?.uid}
                          readInfo={message.authorUid === user?.uid ? readState(message) : undefined}
                        />
                      </div>
                    );
                  })}
                  <div ref={bottomRef} />
                </div>

                <footer className="shrink-0 bg-(--wa-panel) px-2 py-2 sm:px-4">
                  {canPostInActiveRoom ? (
                    <Composer
                      roomId={activeRoomId}
                      onSend={(text) => handleSend(text)}
                      pendingAttachment={pendingAttachment}
                      onAttach={setPendingAttachment}
                      pendingLink={pendingLink}
                      onLink={setPendingLink}
                    />
                  ) : (
                    <p className="py-2 text-center text-xs text-(--wa-muted)">
                      Seules la direction et l&apos;équipe Marketing &amp; Communication peuvent publier dans ce groupe.
                    </p>
                  )}
                </footer>
              </div>

              {/* Fil de réponses : panneau à droite sur ordinateur, plein écran sur mobile. */}
              {threadRoot && (
                <aside className="absolute inset-0 z-20 flex flex-col bg-(--wa-surface) lg:static lg:z-auto lg:w-[360px] lg:shrink-0 lg:border-l lg:border-(--wa-border)">
                  <header className="flex h-16 shrink-0 items-center gap-3 bg-(--wa-panel) px-3">
                    <button
                      type="button"
                      onClick={() => setThreadRootId(null)}
                      aria-label="Fermer le fil"
                      className="flex size-10 items-center justify-center rounded-full text-(--wa-icon) hover:bg-black/5"
                    >
                      <X className="size-5" />
                    </button>
                    <div>
                      <p className="text-[15px] font-medium text-(--wa-text)">Réponses</p>
                      <p className="text-xs text-(--wa-muted)">{repliesOf(threadRoot.id).length} réponse(s)</p>
                    </div>
                  </header>
                  <div className="wa-wallpaper min-h-0 flex-1 overflow-y-auto px-3 py-3">
                    <MessageBubble
                      roomId={activeRoomId}
                      message={threadRoot}
                      isSelf={threadRoot.authorUid === user?.uid}
                      showAuthor
                      firstOfGroup
                      replyCount={0}
                      onReact={(emoji) => handleReact(threadRoot, emoji)}
                      onPin={() => handlePin(threadRoot)}
                      currentUid={user?.uid}
                    />
                    <div className="my-3 flex justify-center">
                      <span className="rounded-lg bg-(--wa-surface) px-3 py-1 text-xs text-(--wa-icon) shadow-sm">Réponses</span>
                    </div>
                    {repliesOf(threadRoot.id).map((reply, i, all) => (
                      <MessageBubble
                        key={reply.id}
                        roomId={activeRoomId}
                        message={reply}
                        isSelf={reply.authorUid === user?.uid}
                        showAuthor={isGroup && (i === 0 || all[i - 1].authorUid !== reply.authorUid)}
                        firstOfGroup={i === 0 || all[i - 1].authorUid !== reply.authorUid}
                        replyCount={0}
                        onReact={(emoji) => handleReact(reply, emoji)}
                        onPin={() => handlePin(reply)}
                        currentUid={user?.uid}
                      />
                    ))}
                  </div>
                  <footer className="shrink-0 bg-(--wa-panel) px-2 py-2">
                    <Composer onSend={(text) => handleSend(text, threadRoot.id)} />
                  </footer>
                </aside>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 border-b-[6px] border-[#25d366] bg-(--wa-panel) px-6 text-center">
            <span className="flex size-20 items-center justify-center rounded-full bg-(--wa-surface) text-(--wa-icon) shadow-sm">
              <MessageSquarePlus className="size-9" />
            </span>
            <p className="text-2xl font-light text-(--wa-title)">Messagerie Soken&apos;s Digital</p>
            <p className="max-w-md text-sm text-(--wa-muted)">
              Choisissez une discussion à gauche, ou démarrez-en une nouvelle avec un collègue.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function matchesSearch(room: ChatRoom, search: string, uid?: string) {
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  const name =
    room.roomType === "DIRECT" && uid
      ? Object.entries(room.participantNames ?? {}).find(([id]) => id !== uid)?.[1] ?? ""
      : room.name;
  return name.toLowerCase().includes(q);
}

function MessageBubble({
  roomId,
  message,
  isSelf,
  showAuthor,
  firstOfGroup,
  replyCount,
  onReact,
  onPin,
  onOpenThread,
  currentUid,
  readInfo,
}: {
  roomId?: string | null;
  message: ChatMessage;
  isSelf: boolean;
  showAuthor: boolean;
  firstOfGroup: boolean;
  replyCount: number;
  onReact: (emoji: string) => void;
  onPin: () => void;
  onOpenThread?: () => void;
  currentUid?: string;
  readInfo?: { read: boolean; readers: number };
}) {
  const linkMeta = message.linkedEntity ? LINKED_ENTITY_META[message.linkedEntity.type] : null;
  const LinkIcon = linkMeta?.icon;
  const reactions = Object.entries(message.reactions ?? {}).filter(([, uids]) => uids.length > 0);
  const authorColor = AUTHOR_COLORS[hash(message.authorUid || message.authorName) % AUTHOR_COLORS.length];

  return (
    <div className={cn("group flex", isSelf ? "justify-end" : "justify-start", firstOfGroup ? "mt-2" : "mt-0.5", reactions.length > 0 && "mb-3")}>
      <div className={cn("relative flex max-w-[85%] items-center gap-1 sm:max-w-[65%]", isSelf && "flex-row-reverse")}>
        <div
          className={cn(
            "relative min-w-[90px] rounded-lg px-2 pt-1.5 pb-1 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
            isSelf ? "bg-(--wa-out)" : "bg-(--wa-in)",
            firstOfGroup && (isSelf ? "rounded-tr-none" : "rounded-tl-none"),
          )}
        >
          {/* Queue de la bulle, sur le premier message d'une série. */}
          {firstOfGroup && (
            <span
              aria-hidden
              className={cn(
                "absolute top-0 size-0 border-t-[8px] border-t-current",
                isSelf
                  ? "-right-2 border-r-[8px] border-r-transparent text-(--wa-out)"
                  : "-left-2 border-l-[8px] border-l-transparent text-(--wa-in)",
              )}
            />
          )}

          {showAuthor && !isSelf && <p className={cn("mb-0.5 text-[13px] font-medium", authorColor)}>{message.authorName}</p>}

          {message.attachment && (
            <a
              href={message.attachment.url}
              target="_blank"
              rel="noreferrer"
              download={message.attachment.name}
              onClick={(e) => {
                // Lien frais à chaque ouverture : un fichier partagé ne
                // devient jamais indisponible avec le temps.
                if (!roomId) return;
                e.preventDefault();
                openChatAttachment(roomId, message.id);
              }}
              className={cn("mb-1 flex items-center gap-3 rounded-md px-2.5 py-2", isSelf ? "bg-(--wa-out-inner)" : "bg-(--wa-in-inner)")}
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded bg-(--wa-surface) text-(--wa-icon)">
                <FileText className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-(--wa-text)">{message.attachment.name}</span>
                <span className="block text-[11px] text-(--wa-muted)">{Math.max(1, Math.round(message.attachment.size / 1024))} Ko</span>
              </span>
            </a>
          )}

          {message.linkedEntity && linkMeta && LinkIcon && (
            <Link
              href={linkMeta.href(message.linkedEntity.id)}
              className={cn("mb-1 flex items-center gap-3 rounded-md border-l-4 border-(--wa-accent) px-2.5 py-1.5", isSelf ? "bg-(--wa-out-inner)" : "bg-(--wa-in-inner)")}
            >
              <LinkIcon className="size-4 shrink-0 text-(--wa-accent)" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium text-(--wa-accent)">{linkMeta.label}</span>
                <span className="block truncate text-xs text-(--wa-text)">{message.linkedEntity.label}</span>
              </span>
            </Link>
          )}

          <p className="text-[14.2px] leading-[19px] break-words whitespace-pre-wrap text-(--wa-text)">
            {message.text}
            {/* Réserve la place de l'heure en bas à droite, comme dans une bulle de messagerie. */}
            <span className="inline-block w-[70px]" aria-hidden />
          </p>

          <span className="absolute right-2 bottom-1 flex items-center gap-1 text-[11px] text-(--wa-muted)">
            {message.pinned && <Pin className="size-3 fill-current" />}
            {formatTime(message.createdAt)}
            {isSelf &&
              (!message.createdAt ? (
                <Check className="size-3.5" aria-label="Envoi en cours" />
              ) : (
                <span title={readInfo?.read ? "Lu" : readInfo?.readers ? `Lu par ${readInfo.readers}` : "Envoyé"}>
                  <CheckCheck className={cn("size-4", readInfo?.read ? "text-sky-400" : "text-(--wa-muted)")} />
                </span>
              ))}
          </span>

          {reactions.length > 0 && (
            <div className={cn("absolute -bottom-3.5 flex gap-0.5", isSelf ? "right-2" : "left-2")}>
              {reactions.map(([emoji, uids]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  className={cn(
                    "flex items-center gap-0.5 rounded-full border bg-(--wa-surface) px-1.5 py-0 text-xs shadow-sm",
                    currentUid && uids.includes(currentUid) ? "border-[#25d366]" : "border-(--wa-surface)",
                  )}
                >
                  {emoji}
                  {uids.length > 1 && <span className="text-[10px] text-(--wa-muted)">{uids.length}</span>}
                </button>
              ))}
            </div>
          )}

          {onOpenThread && replyCount > 0 && (
            <button
              type="button"
              onClick={onOpenThread}
              className="mt-1 flex w-full items-center gap-1 border-t border-black/5 pt-1 text-xs font-medium text-sky-500"
            >
              <CornerUpLeft className="size-3.5" />
              {replyCount} réponse{replyCount > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {/* Actions au survol (ordinateur) ou au toucher (mobile). */}
        <div className="flex shrink-0 flex-col gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Réagir"
                  className="flex size-7 items-center justify-center rounded-full bg-(--wa-surface)/80 text-(--wa-icon) shadow-sm hover:bg-(--wa-surface)"
                >
                  <Smile className="size-4" />
                </button>
              }
            />
            <PopoverContent className="wa bg-(--wa-surface) flex w-auto gap-1 rounded-full p-1.5" align={isSelf ? "end" : "start"}>
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact(emoji)}
                  className="flex size-9 items-center justify-center rounded-full text-xl transition-transform hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  aria-label="Plus d'actions"
                  className="flex size-7 items-center justify-center rounded-full bg-(--wa-surface)/80 text-(--wa-icon) shadow-sm hover:bg-(--wa-surface)"
                >
                  <MoreVertical className="size-4" />
                </button>
              }
            />
            <PopoverContent className="wa bg-(--wa-surface) w-44 p-1" align={isSelf ? "end" : "start"}>
              {onOpenThread && (
                <button type="button" onClick={onOpenThread} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-(--wa-text) hover:bg-(--wa-hover)">
                  <CornerUpLeft className="size-4 text-(--wa-icon)" /> Répondre
                </button>
              )}
              <button type="button" onClick={onPin} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-(--wa-text) hover:bg-(--wa-hover)">
                <Pin className="size-4 text-(--wa-icon)" /> {message.pinned ? "Désépingler" : "Épingler"}
              </button>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}

function Composer({
  onSend,
  pendingAttachment,
  onAttach,
  pendingLink,
  onLink,
  roomId,
}: {
  roomId?: string | null;
  onSend: (text: string) => void;
  pendingAttachment?: ChatMessage["attachment"];
  onAttach?: (attachment: ChatMessage["attachment"]) => void;
  pendingLink?: ChatMessage["linkedEntity"];
  onLink?: (link: ChatMessage["linkedEntity"]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Zone de saisie qui grandit avec le texte (jusqu'à 6 lignes).
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [draft]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !onAttach || !roomId) return;
    setUploading(true);
    try {
      onAttach(await uploadChatAttachment(file, roomId));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Envoi du fichier impossible.");
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    if (!draft.trim() && !pendingAttachment) return;
    onSend(draft);
    setDraft("");
    textRef.current?.focus();
  }

  const canSend = Boolean(draft.trim() || pendingAttachment);

  return (
    <div>
      {(pendingAttachment || pendingLink) && (
        <div className="mb-2 space-y-1">
          {pendingAttachment && (
            <div className="flex items-center gap-2 rounded-lg bg-(--wa-surface) px-3 py-2 text-sm text-(--wa-text) shadow-sm">
              <FileText className="size-4 text-(--wa-icon)" />
              <span className="min-w-0 flex-1 truncate">{pendingAttachment.name}</span>
              <button type="button" onClick={() => onAttach?.(null)} aria-label="Retirer le fichier" className="text-(--wa-icon) hover:text-red-600">
                <X className="size-4" />
              </button>
            </div>
          )}
          {pendingLink && (
            <div className="flex items-center gap-2 rounded-lg border-l-4 border-(--wa-accent) bg-(--wa-surface) px-3 py-2 text-sm text-(--wa-text) shadow-sm">
              <Link2 className="size-4 text-(--wa-accent)" />
              <span className="min-w-0 flex-1 truncate">
                {LINKED_ENTITY_META[pendingLink.type].label} : {pendingLink.label}
              </span>
              <button type="button" onClick={() => onLink?.(null)} aria-label="Retirer le lien" className="text-(--wa-icon) hover:text-red-600">
                <X className="size-4" />
              </button>
            </div>
          )}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2"
      >
        <div className="flex min-w-0 flex-1 items-end gap-1 rounded-3xl bg-(--wa-surface) px-2 py-1.5 shadow-sm">
          {onLink && <LinkEntityButton onPick={(link) => onLink(link)} />}
          <textarea
            ref={textRef}
            rows={1}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Écrire un message"
            className="max-h-36 min-h-[24px] flex-1 resize-none bg-transparent px-1 py-1.5 text-[15px] leading-5 text-(--wa-text) outline-none placeholder:text-(--wa-muted)"
          />
          {onAttach && (
            <>
              <input ref={fileInputRef} type="file" onChange={handleFile} className="hidden" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                title="Joindre un fichier"
                aria-label="Joindre un fichier"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-(--wa-icon) hover:bg-black/5"
              >
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Paperclip className="size-5" />}
              </button>
            </>
          )}
        </div>
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Envoyer"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white shadow-sm transition-opacity hover:bg-[#008f6f] disabled:opacity-50"
        >
          <SendHorizontal className="size-5" />
        </button>
      </form>
    </div>
  );
}

function LinkEntityButton({ onPick }: { onPick: (link: ChatMessage["linkedEntity"]) => void }) {
  const [type, setType] = useState<LinkedEntityType>("project");
  const [options, setOptions] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadOptions(t: LinkedEntityType) {
    setLoading(true);
    try {
      if (t === "project") {
        const data = await listProjects();
        setOptions(data.results.map((p) => ({ id: p.id, label: p.name })));
      } else if (t === "lead") {
        const data = await listLeads();
        setOptions(data.results.map((l) => ({ id: l.id, label: `${l.first_name} ${l.last_name} — ${l.company_name}` })));
      } else {
        const data = await listQuotes();
        setOptions(data.results.map((q) => ({ id: q.id, label: `${q.quote_number} — ${q.client_name}` })));
      }
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            onClick={() => loadOptions(type)}
            title="Lier un projet, un lead ou un devis"
            aria-label="Lier un projet, un lead ou un devis"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-(--wa-icon) hover:bg-black/5"
          >
            <Link2 className="size-5" />
          </button>
        }
      />
      <PopoverContent className="wa bg-(--wa-surface) w-72 p-2" align="start">
        <div className="mb-2 flex gap-1 rounded-full bg-(--wa-panel) p-0.5">
          {(Object.keys(LINKED_ENTITY_META) as LinkedEntityType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setType(t);
                loadOptions(t);
              }}
              className={cn("flex-1 rounded-full py-1 text-xs font-medium", type === t ? "bg-(--wa-surface) text-(--wa-accent) shadow-sm" : "text-(--wa-icon)")}
            >
              {LINKED_ENTITY_META[t].label}
            </button>
          ))}
        </div>
        <div className="max-h-56 overflow-y-auto">
          {loading && <Loader2 className="mx-auto my-3 size-4 animate-spin text-(--wa-muted)" />}
          {!loading && options.length === 0 && <p className="p-2 text-xs text-(--wa-muted)">Rien à afficher.</p>}
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onPick({ type, id: opt.id, label: opt.label })}
              className="block w-full truncate rounded-md px-2.5 py-1.5 text-left text-sm text-(--wa-text) hover:bg-(--wa-hover)"
            >
              {opt.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Nouvelle discussion : panneau qui glisse par-dessus la liste. */
function NewChatPanel({
  onPick,
  onClose,
  currentUid,
}: {
  onPick: (profile: Profile & { uid: string }) => void;
  onClose: () => void;
  currentUid?: string;
}) {
  const [profiles, setProfiles] = useState<(Profile & { uid: string })[] | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    listProfiles().then(setProfiles).catch(() => setProfiles([]));
  }, []);

  const filtered = (profiles ?? [])
    .filter((p) => p.uid !== currentUid && `${p.firstName} ${p.lastName}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-(--wa-surface)">
      <header className="flex h-[108px] shrink-0 items-end gap-4 bg-(--wa-accent) px-4 pb-4 text-white">
        <button type="button" onClick={onClose} aria-label="Retour" className="flex size-8 items-center justify-center rounded-full hover:bg-white/10">
          <ArrowLeft className="size-5" />
        </button>
        <p className="text-lg font-medium">Nouvelle discussion</p>
      </header>
      <div className="shrink-0 px-3 py-2">
        <label className="flex items-center gap-3 rounded-lg bg-(--wa-panel) px-3 py-2">
          <Search className="size-4 shrink-0 text-(--wa-icon)" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un collègue"
            className="w-full min-w-0 bg-transparent text-sm text-(--wa-text) outline-none placeholder:text-(--wa-muted)"
          />
        </label>
      </div>
      <p className="px-6 py-3 text-sm text-(--wa-accent)">Collègues</p>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {profiles === null && <Loader2 className="mx-auto my-6 size-5 animate-spin text-(--wa-muted)" />}
        {profiles !== null && filtered.length === 0 && <p className="py-6 text-center text-sm text-(--wa-muted)">Aucun collègue trouvé.</p>}
        {filtered.map((p) => {
          const name = `${p.firstName} ${p.lastName}`;
          return (
            <button
              key={p.uid}
              type="button"
              onClick={() => onPick(p)}
              className="flex w-full items-center gap-3 px-3 text-left hover:bg-(--wa-hover)"
            >
              <Avatar name={name} />
              <span className="flex min-w-0 flex-1 flex-col border-b border-(--wa-divider) py-3">
                <span className="truncate text-[15px] text-(--wa-text)">{name}</span>
                <span className="truncate text-[13px] text-(--wa-muted)">{p.email}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
