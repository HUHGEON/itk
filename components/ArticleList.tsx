"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { animate, stagger, utils } from "animejs";
import type { FeedRow } from "@/lib/feed";
import type { Team } from "@/lib/types";
import { ArticleCard } from "./ArticleCard";
import { reducedMotion, useBeforePaint } from "@/lib/motion";

const PAGE_SIZE = 40;

/**
 * How many rows of an arriving batch actually animate.
 *
 * A page is forty stories. Staggering all forty is nine seconds of the feed
 * assembling itself, and the reader is looking at the top of it the whole time.
 * The rows past this point are below the fold when they land, so they get no
 * entrance and cost nothing.
 */
const ENTER_CAP = 12;

/**
 * The feed, extended a page at a time.
 *
 * Pages are cursor-based rather than offset-based: collection inserts rows
 * continuously, so an OFFSET shifts underneath the reader and duplicates or
 * skips stories between pages. The cursor is (publishedAt, id) — several feeds
 * stamp a whole batch with the same minute, and a timestamp alone would drop
 * the rest of that batch.
 */
export function ArticleList({
  initialRows,
  teams,
  now,
  query,
}: {
  initialRows: FeedRow[];
  teams: Map<string, Team>;
  now: number;
  /** the active filters, so "load more" keeps them */
  query: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(initialRows.length < PAGE_SIZE);
  const [error, setError] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  /** Rows that have already had their entrance, so a re-render doesn't repeat it. */
  const entered = useRef(0);

  // A filter change re-renders the server component with fresh rows; reset so
  // the previous filter's pages don't linger.
  useEffect(() => {
    setRows(initialRows);
    setDone(initialRows.length < PAGE_SIZE);
    setError(false);
    // Not an arrival. A filter swaps the whole column at once, and forty rows
    // sliding in says "these are new" about a set that is simply different.
    entered.current = initialRows.length;
  }, [initialRows]);

  /**
   * The rows that just showed up, and only those.
   *
   * "더 보기" appends a page below the fold, so without this there is no signal
   * that anything happened — the reader scrolls into forty rows that were
   * apparently always there. The stagger draws the eye down the seam.
   */
  useBeforePaint(() => {
    const root = list.current;
    if (!root || reducedMotion()) return;

    const from = entered.current;
    entered.current = rows.length;
    if (rows.length <= from) return;

    // Children are the cards followed by the sentinel, so an index into the
    // row array is an index into the DOM.
    const fresh = Array.from(root.children).slice(
      from,
      Math.min(rows.length, from + ENTER_CAP),
    );
    if (fresh.length === 0) return;

    utils.set(fresh, { opacity: 0, y: 10 });
    const anim = animate(fresh, {
      opacity: 1,
      y: 0,
      duration: 460,
      ease: "outExpo",
      delay: stagger(30),
    });
    return () => {
      anim.revert();
    };
  }, [rows]);

  const loadMore = useCallback(async () => {
    if (loading || done) return;
    const last = rows[rows.length - 1];
    if (!last) return;

    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams(query);
      params.set("beforeAt", String(last.publishedAt));
      params.set("beforeId", last.id);
      params.set("limit", String(PAGE_SIZE));

      const res = await fetch(`/api/feed?${params}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { rows: next } = (await res.json()) as { rows: FeedRow[] };

      if (next.length === 0) {
        setDone(true);
      } else {
        // Collection may have inserted rows that shift the boundary; drop any
        // id already on screen rather than rendering it twice.
        setRows((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...next.filter((r) => !seen.has(r.id))];
        });
        if (next.length < PAGE_SIZE) setDone(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [loading, done, rows, query]);

  // Auto-load as the end comes into view, with the button as the fallback for
  // browsers without IntersectionObserver and for retrying after an error.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || done || error || typeof IntersectionObserver === "undefined")
      return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadMore();
      },
      { rootMargin: "600px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore, done, error]);

  return (
    <div ref={list}>
      {rows.map((row) => (
        <ArticleCard key={row.id} row={row} teams={teams} now={now} />
      ))}

      <div ref={sentinel} className="px-4 py-5 text-center">
        {done ? (
          <p className="text-[12px] text-muted">
            {rows.length}건 · 여기까지입니다
          </p>
        ) : error ? (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-accent hover:bg-surface-2"
          >
            불러오지 못했습니다 · 다시 시도
          </button>
        ) : loading ? (
          <p className="text-[12px] text-muted">불러오는 중…</p>
        ) : (
          <button
            type="button"
            onClick={() => void loadMore()}
            className="rounded-lg border border-border px-4 py-2 text-[13px] font-medium text-muted hover:text-text"
          >
            더 보기
          </button>
        )}
      </div>
    </div>
  );
}
