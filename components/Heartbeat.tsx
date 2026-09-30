"use client";

import { useEffect } from "react";
import { stamp, sweep } from "@/lib/games/expiry";

/**
 * Marks the site as open, every 30 seconds and when a page is hidden, so
 * lib/games/expiry can tell a closed browser from a quiet tab. Runs the sweep
 * first, so a return after the site was closed clears first.
 */
export function Heartbeat() {
  useEffect(() => {
    sweep();
    const t = setInterval(stamp, 30_000);
    const onHide = () => stamp();
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      clearInterval(t);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);
  return null;
}
