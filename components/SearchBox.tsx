"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import registry from "@/data/teams.json";
import type { Team } from "@/lib/types";
import type { FilterState } from "./Filters";
import { TeamCrest } from "./TeamCrest";
import { Close, Search } from "./icons";

const RECENT_KEY = "itk:recent-searches";
const RECENT_MAX = 8;
const TEAMS = registry as Team[];

function readRecent(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string").slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}
function writeRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX)));
  } catch {
    // private mode: nothing remembered
  }
}

/**
 * Search, as 요즘IT does it: the box in the rail is a door, and pressing it
 * drops a panel from the top of the screen with the field, the searches made
 * before and a way straight to each club. The page underneath dims so the
 * panel is plainly the thing in front.
 */
export function SearchBox({ state }: { state: FilterState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(state.q);
  const [recent, setRecent] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null);

  // Back/forward has to move the box, not just the results.
  useEffect(() => setQuery(state.q), [state.q]);

  useEffect(() => {
    if (!open) return;
    setRecent(readRecent());
    input.current?.focus();
    const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", k);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", k);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const go = (params: URLSearchParams) => {
    setOpen(false);
    startTransition(() => {
      router.push(params.toString() ? `/feed?${params}` : "/feed", { scroll: false });
    });
  };

  const submit = (value: string) => {
    const next = new URLSearchParams();
    if (state.tiers.length) next.set("tier", state.tiers.join(","));
    if (state.teams.length) next.set("team", state.teams.join(","));
    if (state.league) next.set("league", state.league);
    if (state.who) next.set("who", state.who);
    if (value) {
      next.set("q", value);
      const list = [value, ...readRecent().filter((x) => x !== value)];
      writeRecent(list);
      setRecent(list);
    }
    go(next);
  };

  const forget = (value: string) => {
    const list = readRecent().filter((x) => x !== value);
    writeRecent(list);
    setRecent(list);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="기사 검색"
        // An icon on a phone, a field-shaped button in the header above that.
        className={`flex items-center gap-2 rounded-[10px] border border-border bg-surface-2 p-2 text-left transition-colors hover:border-border-strong md:w-[220px] md:px-3 lg:w-[380px] xl:w-[440px] ${
          pending ? "opacity-60" : ""
        }`}
      >
        <Search className="shrink-0 text-muted" />
        <span className={`hidden min-w-0 flex-1 truncate text-[13px] md:block ${state.q ? "text-text" : "text-faint"}`}>
          {state.q || "선수·팀·키워드"}
        </span>
      </button>

      {/* Portalled to <body>: the box sits in the rail, and on a phone the
          rail is a drawer moved with a transform, which would pin a "fixed"
          panel to the drawer instead of the screen. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="기사 검색">
          <button type="button" aria-label="검색 닫기" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/60" />
          <div
            className="relative border-b border-border-strong bg-surface shadow-[0_20px_40px_-20px_rgba(0,0,0,0.9)]"
            style={{ animation: "search-drop 220ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
          >
            <div className="mx-auto max-w-[800px] px-[var(--gutter)]">
              <div className="flex h-16 items-center gap-3">
                <Search className="shrink-0 text-muted" />
                <input
                  ref={input}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) submit(query.trim());
                  }}
                  placeholder="선수, 팀, 키워드로 기사 찾기"
                  aria-label="검색어"
                  className="min-w-0 flex-1 bg-transparent text-[17px] text-text outline-none placeholder:text-faint"
                />
                {query && (
                  <button type="button" onClick={() => setQuery("")} className="shrink-0 text-[13px] text-muted hover:text-text">
                    지우기
                  </button>
                )}
                <button type="button" onClick={() => setOpen(false)} aria-label="닫기" className="shrink-0 p-1 text-muted hover:text-text">
                  <Close size={16} />
                </button>
              </div>

              <div className="border-t border-border py-5">
                <p className="text-[14px] font-semibold text-text">최근 검색어</p>
                {recent.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-muted">최근 검색어가 없어요.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {recent.map((r) => (
                      <span key={r} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-2 py-1 pr-1.5 pl-3 text-[13px] text-text">
                        <button type="button" onClick={() => submit(r)} className="hover:text-accent">
                          {r}
                        </button>
                        <button type="button" onClick={() => forget(r)} aria-label={`${r} 지우기`} className="rounded-full p-1 text-faint hover:text-text">
                          <Close size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-6 text-[14px] font-semibold text-text">구단 바로가기</p>
                <div className="mt-3 flex flex-wrap gap-2 pb-1">
                  {TEAMS.map((t) => (
                    <button
                      key={t.slug}
                      type="button"
                      onClick={() => go(new URLSearchParams({ team: t.slug }))}
                      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 py-1 pr-3 pl-1.5 text-[13px] text-muted transition-colors hover:border-border-strong hover:text-text"
                    >
                      <TeamCrest team={t} size={16} />
                      {t.ko}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}
