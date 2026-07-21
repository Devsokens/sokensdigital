"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Bell, ChevronRight, Home, Loader2, LogOut, Search, UserRound } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/lib/auth/auth-context";
import { signOutUser } from "@/lib/firebase/auth";
import { ROLE_LABELS } from "@/lib/firebase/types";
import { ADMIN_SECTIONS, findNavMatch, type NavItem } from "@/lib/admin-nav";
import { globalSearch, type SearchResult } from "@/lib/api/search";

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
  const [contentResults, setContentResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const allItems = useMemo(() => ADMIN_SECTIONS.flatMap((section) => section.items.map((item) => ({ ...item, section: section.title }))), []);
  const pageResults = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return allItems.filter((item) => item.label.toLowerCase().includes(q) || item.section.toLowerCase().includes(q)).slice(0, 5);
  }, [allItems, query]);

  // Debounced live search across leads/devis/projets/employés/contenu/décaissements
  // — the user's own accessible data, not just the static page list.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setContentResults([]);
      return;
    }
    setSearching(true);
    const timeout = setTimeout(() => {
      globalSearch(trimmed)
        .then(setContentResults)
        .catch(() => setContentResults([]))
        .finally(() => setSearching(false));
    }, 250);
    return () => clearTimeout(timeout);
  }, [query]);

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

  function goToPage(item: NavItem) {
    router.push(item.href);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  function goToResult(result: SearchResult) {
    router.push(result.href);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
  }

  const hasResults = pageResults.length > 0 || contentResults.length > 0;

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
            if (event.key !== "Enter") return;
            if (pageResults[0]) goToPage(pageResults[0]);
            else if (contentResults[0]) goToResult(contentResults[0]);
          }}
          placeholder="Rechercher un module, un lead, un devis, un employé…"
          className="w-full min-w-0 bg-transparent text-sm text-neutral-700 placeholder:text-neutral-400 outline-none"
        />
        {searching ? (
          <Loader2 className="size-3.5 shrink-0 animate-spin text-neutral-300" />
        ) : (
          <kbd className="hidden shrink-0 items-center rounded-md border border-neutral-200 bg-white px-1.5 py-0.5 text-[0.65rem] text-neutral-400 sm:flex">
            ⌘ /
          </kbd>
        )}
      </div>

      {open && hasResults && (
        <div className="absolute top-full left-0 z-40 mt-2 w-full overflow-hidden rounded-xl border border-neutral-200 bg-white py-1.5 shadow-xl shadow-black/5">
          {pageResults.length > 0 && (
            <div className="py-1">
              <p className="px-3.5 py-1 text-[0.65rem] font-semibold tracking-wider text-neutral-400 uppercase">Pages</p>
              {pageResults.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => goToPage(item)}
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

          {contentResults.length > 0 && (
            <div className="border-t border-neutral-100 py-1">
              <p className="px-3.5 py-1 text-[0.65rem] font-semibold tracking-wider text-neutral-400 uppercase">Résultats</p>
              {contentResults.map((result, index) => (
                <button
                  key={`${result.category}-${index}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => goToResult(result)}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-neutral-700 transition-colors hover:bg-neutral-50"
                >
                  <span className="truncate">{result.label}</span>
                  {result.sublabel && <span className="shrink-0 truncate text-xs text-neutral-400">{result.sublabel}</span>}
                  <span className="ml-auto shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[0.65rem] text-neutral-500">{result.category}</span>
                </button>
              ))}
            </div>
          )}
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
