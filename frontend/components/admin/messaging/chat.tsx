"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, FolderKanban, Globe, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { subscribeToMessages, subscribeToRooms, sendMessage } from "@/lib/firebase/chat";
import type { ChatMessage, ChatRoom } from "@/lib/firebase/types";
import { inputClass } from "@/components/admin/form-styles";

const ROOM_TYPE_ICON: Record<ChatRoom["roomType"], React.ComponentType<{ className?: string }>> = {
  COMPANY: Globe,
  DEPARTMENT: Building2,
  PROJECT: FolderKanban,
};

const ROOM_TYPE_LABEL: Record<ChatRoom["roomType"], string> = {
  COMPANY: "Entreprise",
  DEPARTMENT: "Département",
  PROJECT: "Projets",
};

const ROOM_TYPE_ORDER: ChatRoom["roomType"][] = ["COMPANY", "DEPARTMENT", "PROJECT"];

export function Chat() {
  const { user, profile } = useAuth();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    return subscribeToRooms(
      { departmentId: profile?.departmentId ?? null, uid: user.uid },
      (nextRooms) => {
        setRooms(nextRooms);
        setActiveRoomId((current) => current ?? nextRooms[0]?.id ?? null);
      }
    );
  }, [user, profile?.departmentId]);

  useEffect(() => {
    if (!activeRoomId) {
      setMessages([]);
      return;
    }
    return subscribeToMessages(activeRoomId, setMessages);
  }, [activeRoomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const groupedRooms = useMemo(() => {
    return ROOM_TYPE_ORDER.map((roomType) => ({
      roomType,
      rooms: rooms.filter((room) => room.roomType === roomType),
    })).filter((group) => group.rooms.length > 0);
  }, [rooms]);

  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? null;

  const canPostInActiveRoom =
    !activeRoom ||
    activeRoom.roomType !== "COMPANY" ||
    profile?.role === "SUPER_ADMIN" ||
    profile?.role === "RESPONSABLE_MARKETING";

  async function handleSend() {
    if (!draft.trim() || !activeRoomId || !user || !profile) return;
    setSending(true);
    try {
      await sendMessage(activeRoomId, {
        text: draft.trim(),
        authorUid: user.uid,
        authorName: `${profile.firstName} ${profile.lastName}`,
      });
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <aside className="w-64 shrink-0 overflow-y-auto border-r border-neutral-200">
        {groupedRooms.length === 0 && (
          <p className="p-4 text-xs text-neutral-400">Aucun salon disponible.</p>
        )}
        {groupedRooms.map((group) => {
          const Icon = ROOM_TYPE_ICON[group.roomType];
          return (
            <div key={group.roomType} className="py-2">
              <p className="px-4 py-1 text-[0.65rem] font-semibold tracking-wider text-neutral-400 uppercase">
                {ROOM_TYPE_LABEL[group.roomType]}
              </p>
              {group.rooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setActiveRoomId(room.id)}
                  className={cn(
                    "flex w-full items-center gap-2 px-4 py-2 text-left text-sm transition-colors",
                    room.id === activeRoomId
                      ? "bg-primary/10 text-primary"
                      : "text-neutral-700 hover:bg-neutral-50"
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="truncate">{room.name}</span>
                </button>
              ))}
            </div>
          );
        })}
      </aside>

      <div className="flex flex-1 flex-col">
        {activeRoom ? (
          <>
            <div className="border-b border-neutral-200 px-5 py-3">
              <p className="text-sm font-medium text-neutral-900">{activeRoom.name}</p>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[75%] rounded-xl px-3.5 py-2 text-sm",
                    message.authorUid === user?.uid
                      ? "ml-auto bg-primary/10 text-neutral-900"
                      : "bg-neutral-100 text-neutral-900"
                  )}
                >
                  {message.authorUid !== user?.uid && (
                    <p className="mb-0.5 text-xs font-medium text-neutral-500">{message.authorName}</p>
                  )}
                  <p className="whitespace-pre-wrap">{message.text}</p>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-neutral-200 p-3">
              {canPostInActiveRoom ? (
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    handleSend();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Écrire un message…"
                    className={inputClass}
                  />
                  <button
                    type="submit"
                    disabled={sending || !draft.trim()}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white transition-opacity disabled:opacity-40"
                  >
                    <Send className="size-4" />
                  </button>
                </form>
              ) : (
                <p className="text-center text-xs text-neutral-400">
                  Seuls les annonces de la direction/marketing peuvent être publiées ici.
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-400">
            Sélectionnez un salon.
          </div>
        )}
      </div>
    </div>
  );
}
