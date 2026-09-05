"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { matchesOn, type Match } from "@/lib/matches";

/**
 * Keeps a day's matches current while anyone is looking at them.
 *
 * Three rules decide whether this does anything at all, and together they mean
 * the common case costs nothing:
 *
 *  1. Only while a match is actually being played. A page of fixtures that all
 *     kick off tomorrow never polls.
 *  2. Only while the tab is visible. Browsers throttle background timers to a
 *     minute or more anyway, so polling there would be a battery cost with no
 *     benefit.
 *  3. Immediately on becoming visible again. This is the one that matters: come
 *     back to a tab and the score is right, rather than showing 0-0 for however
 *     long is left on the interval. Measured at ~50ms per round trip.
 */
const INTERVAL_MS = 5000;

export function useLiveMatches(date: Date, initial: Match[]) {
  const [matches, setMatches] = useState(initial);
  const abort = useRef<AbortController | null>(null);
  const day = date.toDateString();

  // A fresh day means fresh fixtures; without this the previous day's list
  // would linger until the first poll returned.
  useEffect(() => setMatches(initial), [initial, day]);

  const refresh = useCallback(async () => {
    abort.current?.abort();
    const ac = new AbortController();
    abort.current = ac;
    try {
      const next = await matchesOn(date, ac.signal);
      if (!ac.signal.aborted && next.length) setMatches(next);
    } catch {
      // A failed poll is not worth surfacing: the previous scoreline is still
      // on screen and the next attempt is seconds away.
    }
  }, [date]);

  const live = matches.some((m) => m.state === "in");

  useEffect(() => {
    if (!live) return;

    let timer: number | undefined;
    const start = () => {
      window.clearInterval(timer);
      timer = window.setInterval(refresh, INTERVAL_MS);
    };
    const onVisibility = () => {
      if (document.hidden) {
        window.clearInterval(timer);
      } else {
        void refresh();
        start();
      }
    };

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      abort.current?.abort();
    };
  }, [live, refresh]);

  return { matches, live };
}
