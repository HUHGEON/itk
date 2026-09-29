"use client";

import { useEffect, useState } from "react";

/**
 * A daily game's progress, kept in this browser under the day's number.
 *
 * Coming back to the tab later in the day picks up where it was left; a new day
 * is a new key and so a fresh start. Wrapped in try/catch because a browser set
 * to block site data throws on the accessor itself.
 */
export function useDaily<T>(game: string, day: number, initial: T) {
  const key = `itk:${game}:${day}`;
  const [state, setState] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  // Which key the state in hand was loaded from; nothing is saved under a key
  // until its own progress has been read.
  const [loaded, setLoaded] = useState<string | null>(null);

  // A new key is a new puzzle: its own saved progress, or a fresh start.
  // Keeping the old state when nothing was saved carried a finished game
  // over to the next archive puzzle and then saved it there.
  useEffect(() => {
    setReady(false);
    let next = initial;
    try {
      const raw = localStorage.getItem(key);
      if (raw) next = JSON.parse(raw);
    } catch {
      // no storage: play without saving
    }
    setState(next);
    setLoaded(key);
    setReady(true);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || loaded !== key) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [key, state, ready, loaded]);

  return [state, setState, ready] as const;
}

/** Copies a result, falling back to a prompt where the clipboard is blocked. */
export async function share(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
