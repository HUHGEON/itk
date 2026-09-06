"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * The clubs someone follows.
 *
 * Kept in the browser rather than on a server: this is a preference, not an
 * account, and putting it in local storage means it needs no sign-in, no
 * database and no per-visitor cost. The trade is that it does not follow anyone
 * between devices, which for a list of five clubs is the right trade.
 *
 * Changes are broadcast so every part of the page reacts at once - the star in
 * the rail and the strip at the top are the same fact shown twice, and one
 * lagging behind the other looks broken.
 */
const KEY = "itk.favourites";
const EVENT = "itk:favourites";

function read(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((x) => typeof x === "string") : [];
  } catch {
    // A private window, cleared storage, or a browser refusing it entirely.
    return [];
  }
}

function write(list: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // Nothing to do: the list still works for this page view.
  }
  window.dispatchEvent(new CustomEvent(EVENT));
}

export function useFavourites() {
  /*
   * Empty on the first render, always.
   *
   * The server has no idea what is in a visitor's storage, so rendering the
   * real list straight away would not match what the server sent and React
   * would throw the markup away. Reading it in an effect costs one extra paint
   * and keeps the two in step.
   */
  const [teams, setTeams] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTeams(read());
    setReady(true);
    const sync = () => setTeams(read());
    window.addEventListener(EVENT, sync);
    // Another tab of the same site.
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const toggle = useCallback((slug: string) => {
    const now = read();
    write(now.includes(slug) ? now.filter((s) => s !== slug) : [...now, slug]);
  }, []);

  return { teams, ready, toggle };
}
