"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { FilterState } from "./Filters";
import { Close, Search } from "./icons";

/**
 * Search lives in the header rather than in the filter block.
 *
 * It was a full-width bar of empty space below three rows of chips, pushing the
 * first headline further down than it needed to be, while the header carried
 * nothing but a logo. Up here it costs no vertical space and stays reachable
 * while scrolling, since the header is sticky.
 */
export function SearchBox({ state }: { state: FilterState }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [query, setQuery] = useState(state.q);

  // Back/forward has to move the box, not just the results.
  useEffect(() => setQuery(state.q), [state.q]);

  const submit = (value: string) => {
    const next = new URLSearchParams();
    if (state.tiers.length) next.set("tier", state.tiers.join(","));
    if (state.teams.length) next.set("team", state.teams.join(","));
    if (state.league) next.set("league", state.league);
    if (state.who) next.set("who", state.who);
    if (value) next.set("q", value);
    startTransition(() => {
      router.push(next.toString() ? `/?${next}` : "/", { scroll: false });
    });
  };

  return (
    <div
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-[5px] border border-border bg-surface-2 px-2.5 py-1.5 transition-colors focus-within:border-border-strong sm:max-w-xs ${
        pending ? "opacity-60" : ""
      }`}
    >
      <Search className="shrink-0 text-faint" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit(query.trim());
          if (e.key === "Escape" && query) {
            setQuery("");
            submit("");
          }
        }}
        placeholder="선수·팀·키워드"
        aria-label="기사 검색"
        className="min-w-0 flex-1 bg-transparent text-[12.5px] outline-none placeholder:text-faint"
      />
      {query && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            submit("");
          }}
          aria-label="검색어 지우기"
          className="shrink-0 text-faint transition-colors hover:text-text"
        >
          <Close size={12} />
        </button>
      )}
    </div>
  );
}
