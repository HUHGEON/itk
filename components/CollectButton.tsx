"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { collectNow } from "@/app/actions";

/**
 * Collect now, without waiting for the next scheduled pass.
 *
 * Goes through a Server Action rather than a fetch: the route-handler version
 * was callable by anyone, and each run fans out ~50 outbound requests.
 */
export function CollectButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [note, setNote] = useState("");
  const [, startTransition] = useTransition();

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
        title="지금 수집 (0티어 + 매체 피드, 약 30초)"
        className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:text-text disabled:opacity-50"
      >
        {state === "running" ? "수집 중…" : "↻ 수집"}
      </button>
    </div>
  );
}
