"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { collectNow } from "@/app/actions";
import { Refresh } from "./icons";
import { timeAgo } from "@/lib/format";

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
    <div className="flex items-center gap-1.5">
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
        className={`inline-flex items-center gap-1.5 rounded-[5px] px-3 py-1.5 text-[11px] font-semibold transition-colors disabled:opacity-50 ${
          due
            ? "text-accent-ink hover:opacity-90"
            : "border border-border text-muted hover:border-border-strong hover:text-text"
        }`}
        style={due ? { background: "var(--ribbon)" } : undefined}
      >
        <Refresh className={state === "running" ? "animate-spin" : ""} />
        {state === "running" ? "수집 중" : "수집"}
      </button>
    </div>
  );
}
