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

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setState(JSON.parse(raw));
    } catch {
      // no storage: play without saving
    }
    setReady(true);
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [key, state, ready]);

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
