"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The original's alert: a rose (warning) or blue (success) card under the
 * header, gone after 2.4 seconds. "Incorrect answer. Turn lost." in Possession
 * Play, "The player was …" at the end of a lost Who Are Ya.
 */
export function Toast({ message, variant = "warning" }: { message: string; variant?: "warning" | "success" }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed top-24 left-1/2 z-[60] w-max max-w-[min(24rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 animate-[toast-in_300ms_ease-out] rounded-lg p-4 text-center text-sm font-medium text-white shadow-lg ${
        variant === "warning" ? "bg-rose-500" : "bg-blue-500"
      }`}
    >
      {message}
    </div>
  );
}

export const TOAST_MS = 2400;

export function useToast(ms = TOAST_MS) {
  const [message, setMessage] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback(
    (m: string) => {
      setMessage(m);
      window.clearTimeout(timer.current);
      if (ms > 0) timer.current = window.setTimeout(() => setMessage(""), ms);
    },
    [ms],
  );
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return { message, show };
}

/**
 * The original buzzes the phone: five short pulses on a wrong answer, a nudge
 * when it becomes your turn online. Browsers without vibration ignore it.
 */
export const HAPTIC = { error: [40, 40, 40, 40, 40], nudge: [80, 80, 50] };
export function buzz(pattern: number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") navigator.vibrate(pattern);
  } catch {
    // not allowed here
  }
}
