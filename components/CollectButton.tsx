"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { Refresh } from "./icons";
import { timeAgo } from "@/lib/format";
import { reducedMotion } from "@/lib/motion";

/**
 * Collect now, without waiting for the next scheduled pass.
 *
 * A plain request rather than a Server Action. Actions share a queue with
 * navigations, so while this ran the whole site appeared to hang - measured on
 * production, a filter clicked during a collection took 16.7 seconds to land.
 * See `app/api/collect/route.ts` for how the route is kept to this site.
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

type CollectResult =
  | { ok: true; inserted: number; seen: number }
  | { ok: false; error: string };

/**
 * The run in progress, if there is one, held outside the component.
 *
 * Now that a collection no longer pins the router, the reader can navigate
 * while one is running - and that unmounts this button and remounts a fresh
 * one on the new page. Kept in the component, the state would reset to idle
 * while the work was still going, which invites a second press and a 429. A
 * module-scoped promise survives the remount, so the new button picks the run
 * back up and keeps sweeping.
 */
let inFlight: Promise<CollectResult> | null = null;

function startCollect(): Promise<CollectResult> {
  inFlight ??= fetch("/api/collect", { method: "POST" })
    .then((res) => res.json() as Promise<CollectResult>)
    .catch(() => ({ ok: false, error: "수집하지 못했습니다" }) as CollectResult)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function CollectButton({ lastCollect }: { lastCollect: number | null }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [note, setNote] = useState("");

  // Re-evaluated on a timer, so the button lights up on its own once the
  // window passes rather than waiting for a navigation.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const due = state === "idle" && (!lastCollect || now - lastCollect >= DUE_MS);

  /**
   * A run takes about sixteen seconds — measured, after the fetching was
   * widened — and a spinning icon says nothing about whether it is still going.
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

  const settle = (body: CollectResult) => {
    if (!body.ok) {
      setState("error");
      setNote(body.error.slice(0, 60));
    } else {
      setState("done");
      setNote(body.inserted ? `신규 ${body.inserted}건` : "새 기사 없음");
      // Deliberately after the run rather than around it: this is the one part
      // that does belong to the router, and it is a single re-render.
      router.refresh();
    }
    window.setTimeout(() => setState("idle"), 4000);
  };

  // A run started on the page before this one is still ours to report on.
  useEffect(() => {
    if (!inFlight) return;
    setState("running");
    let live = true;
    void inFlight.then((body) => live && settle(body));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    setState("running");
    setNote("");
    settle(await startCollect());
  };

  const title = due
    ? "지금 수집 (약 15초)"
    : lastCollect
      ? `${timeAgo(lastCollect, now)} 수집함 · 지금 눌러도 새 기사가 없을 가능성이 큽니다`
      : "지금 수집 (약 15초)";

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
        onClick={() => void run()}
        disabled={state === "running"}
        title={title}
        className={`relative inline-flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-[4px] px-3 py-2 text-[11.5px] font-semibold transition-colors disabled:opacity-50 ${
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
