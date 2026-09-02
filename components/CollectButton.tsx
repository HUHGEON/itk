"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { animate } from "animejs";
import { collectNow } from "@/app/actions";
import { Refresh } from "./icons";
import { timeAgo } from "@/lib/format";
import { reducedMotion } from "@/lib/motion";

/**
 * Collect now, without waiting for the next scheduled pass.
 *
 * Goes through a Server Action rather than a fetch: the route-handler version
 * was callable by anyone, and each run fans out ~50 outbound requests.
 */

/**
 * Whether the button lights up.
 *
 * There is no way to know a feed has something new without asking it, so the
 * signal is how long it has been since anyone did. The scheduled pass runs
 * every twenty minutes; inside that window a manual run almost always comes
 * back empty, so the button stays quiet and the ribbon means something.
 */
const DUE_MS = 20 * 60_000;

export function CollectButton({ lastCollect }: { lastCollect: number | null }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [note, setNote] = useState("");
  const [, startTransition] = useTransition();

  // Re-evaluated on a timer, so the button lights up on its own once the
  // window passes rather than waiting for a navigation.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const due = state === "idle" && (!lastCollect || now - lastCollect >= DUE_MS);

  /**
   * A run takes the better part of a minute — 42 seconds, measured — and a
   * spinning icon says nothing about whether it is still going.
   *
   * There is no progress to report — the server action fans out to fifty feeds
   * and returns once, with no interim count — so this deliberately does not
   * pretend to be a progress bar. It is a sweep across the button that keeps
   * repeating, which reads as "still working" without claiming to know how far
   * along it is. A bar creeping toward an end it cannot predict would be a
   * worse lie than no bar at all.
   */
  const sweep = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = sweep.current;
    if (!el || state !== "running" || reducedMotion()) return;
    const anim = animate(el, {
      x: ["-100%", "100%"],
      duration: 1150,
      ease: "inOutSine",
      loop: true,
    });
    return () => {
      anim.revert();
    };
  }, [state]);

  const run = () => {
    setState("running");
    setNote("");
    startTransition(async () => {
      const res = await collectNow();
      if (!res.ok) {
        setState("error");
        setNote(res.error.slice(0, 60));
        return;
      }
      setState("done");
      setNote(res.inserted ? `신규 ${res.inserted}건` : "새 기사 없음");
      router.refresh();
      window.setTimeout(() => setState("idle"), 4000);
    });
  };

  const title = due
    ? "지금 수집 (약 30초)"
    : lastCollect
      ? `${timeAgo(lastCollect, now)} 수집함 · 지금 눌러도 새 기사가 없을 가능성이 큽니다`
      : "지금 수집 (약 30초)";

  return (
    <div className="flex w-full flex-col gap-1">
      {note && (
        <span
          className={`text-[11px] ${state === "error" ? "text-red-400" : "text-muted"}`}
        >
          {note}
        </span>
      )}
      <button
        type="button"
        onClick={() => run()}
        disabled={state === "running"}
        title={title}
        className={`relative inline-flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-[5px] px-3 py-2 text-[11.5px] font-semibold transition-colors disabled:opacity-50 ${
          due
            ? "text-accent-ink hover:opacity-90"
            : "border border-border text-muted hover:border-border-strong hover:text-text"
        }`}
        style={due ? { background: "var(--ribbon)" } : undefined}
      >
        {state === "running" && (
          <span
            ref={sweep}
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-accent/25 to-transparent"
          />
        )}
        <Refresh className={state === "running" ? "animate-spin" : ""} />
        {state === "running" ? "수집 중" : "수집"}
      </button>
    </div>
  );
}
