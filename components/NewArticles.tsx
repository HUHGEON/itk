"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, spring } from "animejs";
import { DB_SCHEMA } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { reducedMotion, useBeforePaint } from "@/lib/motion";

/**
 * "새 기사 N건 · 보기" — the only thing that tells an open tab it has gone stale.
 *
 * The page is force-dynamic, so a reload always shows the latest stories, but
 * nothing reloaded it: AlertPanel subscribed to inserts and did no more than
 * raise a notification, so the list on screen stayed at whatever was rendered
 * when the tab was opened. A tab left open all day showed yesterday's feed
 * while the notification said otherwise.
 *
 * Refreshing on its own was the obvious fix and the wrong one — a collection
 * run inserts hundreds of rows, and swapping the list under someone mid-read
 * moves the card they were on. So the arrival is announced and the reader
 * decides when to take it.
 */

/** A collection run inserts hundreds of rows; wait for the burst to settle. */
const BURST_DEBOUNCE_MS = 3_000;
/** Safety net only — covers a dropped socket or a missing anon key. */
const FALLBACK_POLL_MS = 120_000;
/** Past this the exact number tells the reader nothing. */
const MAX_COUNT = 99;

export function NewArticles({
  query,
  since,
}: {
  /** the active filters, so the count matches what a refresh would show */
  query: string;
  /** server clock, stamped when the page rendered */
  since: number;
}) {
  const router = useRouter();
  const [count, setCount] = useState(0);

  // Stamped by the server and compared against the row's own created_at, so
  // both sides of the comparison are server time. The alert poller does this
  // with Date.now() from the browser and drifts.
  const sinceRef = useRef(since);

  // A refresh — or a filter change — re-renders the page with a newer stamp.
  // That is the signal that the reader has caught up.
  useEffect(() => {
    sinceRef.current = since;
    setCount(0);
  }, [since]);

  const check = useCallback(async () => {
    const params = new URLSearchParams(query);
    params.set("after", String(sinceRef.current));
    params.set("limit", String(MAX_COUNT + 1));

    try {
      const res = await fetch(`/api/feed?${params}`, { cache: "no-store" });
      if (!res.ok) return;
      const { rows } = (await res.json()) as { rows: unknown[] };
      setCount(rows.length);
    } catch {
      // Offline, or the collector is mid-write; the next tick retries.
    }
  }, [query]);

  useEffect(() => {
    let burst: number | undefined;
    const supabase = supabaseBrowser();
    // A channel name of its own: AlertPanel already holds "itk-articles", and
    // one client cannot join the same channel twice.
    const channel = supabase
      ?.channel("itk-new-articles")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: DB_SCHEMA, table: "articles" },
        () => {
          window.clearTimeout(burst);
          burst = window.setTimeout(check, BURST_DEBOUNCE_MS);
        },
      )
      .subscribe();

    const poll = window.setInterval(check, FALLBACK_POLL_MS);

    return () => {
      window.clearTimeout(burst);
      window.clearInterval(poll);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [check]);

  /**
   * The banner drops in, and nudges each time the count climbs.
   *
   * It is the one thing on the page that interrupts: it appears over a column
   * the reader is already in the middle of, unasked. A hard cut there reads as
   * a rendering glitch — something that was always there and only now got
   * painted — so it arrives under a spring, from above, which is the direction
   * it is pointing. Later arrivals only bump it: a second full entrance for a
   * banner already on screen is motion with nothing behind it.
   */
  const pill = useRef<HTMLButtonElement>(null);
  const shown = useRef(false);

  useBeforePaint(() => {
    const el = pill.current;
    if (!el || reducedMotion()) {
      shown.current = count > 0;
      return;
    }
    const entering = !shown.current;
    shown.current = true;

    const anim = entering
      ? animate(el, {
          // Eased separately from the spring below — see the note in Modal.
          opacity: { from: 0, to: 1, duration: 200, ease: "outQuad" },
          y: [-16, 0],
          scale: [0.9, 1],
          ease: spring({ stiffness: 190, damping: 14 }),
        })
      : animate(el, {
          scale: [1, 1.07, 1],
          duration: 340,
          ease: "outQuad",
        });

    return () => {
      anim.revert();
    };
  }, [count]);

  // The banner leaving resets `shown` through the effect above, which runs with
  // a null ref once the button has unmounted.
  if (count === 0) return null;

  return (
    <div className="pointer-events-none sticky top-[calc(var(--headerh)+0.5rem)] z-10 flex justify-center lg:top-2">
      <button
        ref={pill}
        type="button"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: "smooth" });
          router.refresh();
        }}
        className="pointer-events-auto rounded-full border border-accent/45 bg-surface-2/95 px-3.5 py-1.5 text-[12px] font-semibold text-accent shadow-lg backdrop-blur-sm transition-colors hover:bg-accent/15"
      >
        ↑ 새 기사 {count > MAX_COUNT ? `${MAX_COUNT}+` : count}건 · 보기
      </button>
    </div>
  );
}
