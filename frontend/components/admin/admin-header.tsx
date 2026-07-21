"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell, ChevronRight, Home, LogOut, Search, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth/auth-context";
import { signOutUser } from "@/lib/firebase/auth";
import { ROLE_LABELS } from "@/lib/firebase/types";
import { ADMIN_SECTIONS, findNavMatch, type NavItem } from "@/lib/admin-nav";

function initials(firstName?: string, lastName?: string) {
  return `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const match = findNavMatch(pathname);
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <Link href="/admin" className="flex items-center text-neutral-400 transition-colors hover:text-neutral-600">
        <Home className="size-4" />
      </Link>
      {match && (
        <>
          <ChevronRight className="size-3.5 text-neutral-300" />
          <span className="text-neutral-400">{match.section.title}</span>
          <ChevronRight className="size-3.5 text-neutral-300" />
          <span className="font-medium text-neutral-900">{match.item.label}</span>
        </>
      )}
      {!match && <span className="font-medium text-neutral-900">Espace administrateur</span>}
    </div>
  );
}

function QuickSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const allItems = useMemo(() => ADMIN_SECTIONS.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title }))), []);
  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return allItems.filter((item) => item.label.toLowerCase().includes(q) || item.section.toLowerCase().includes(q)).slice(0, 8);
  }, [allItems, query]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "/") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  function goTo(item: NavItem) {
    router.push(item.href);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-2 transition-colors focus-within:border-primary/40 focus-within:bg-white">
        <Search className="size-4 shrink-0 text-neutral-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results[0]) goTo(results[0]);
          }}
          placeholder="Rechercher un module, une page…"
          className="w-full min-w-0 bg-transparent text-sm text-neutral-700 placeholder:text-neutral-400 outline-none"
        />
        <kbd className="hidden shrink-0 items-center rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[0.65rem] text-neutral-400 sm:flex">
          ⌘ /
        </kbd>
      </div>

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 z-40 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white py-1.5 shadow-xl shadow-black/5">
          {results.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.href}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => goTo(item)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
              >
                <Icon className="size-4 text-neutral-400" />
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-neutral-400">{item.section}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminHeader() {
  const pathname = usePathname();
  const { profile } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-neutral-200 bg-white px-6 lg:pl-8">
      <Breadcrumb pathname={pathname} />

      <div className="flex flex-1 justify-center">
        <QuickSearch />
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger className="relative flex size-9 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900">
            <Bell className="size-[1.1rem]" />
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="text-sm font-semibold text-neutral-900">Notifications</p>
            </div>
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-neutral-400">
                Aucune notification pour l&apos;instant — le module Notifications (Firestore) arrive bientôt.
              </p>
            </div>
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger className="flex items-center gap-2 rounded-full py-1 pr-2.5 pl-1 transition-colors hover:bg-neutral-100">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              {initials(profile?.firstName, profile?.lastName)}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block text-xs font-medium text-neutral-900">{profile?.firstName}</span>
            </span>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="border-b border-neutral-100 px-4 py-3">
              <p className="truncate text-sm font-medium text-neutral-900">
                {profile?.firstName} {profile?.lastName}
              </p>
              <p className="truncate text-xs text-neutral-400">
                {profile ? ROLE_LABELS[profile.role] : ""}
              </p>
            </div>
            <div className="p-1.5">
              <Link
                href="/profil"
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-neutral-700 transition-colors hover:bg-neutral-100"
              >
                <UserRound className="size-4 text-neutral-400" /> Mon profil
              </Link>
              <button
                onClick={() => signOutUser()}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <LogOut className="size-4" /> Déconnexion
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
