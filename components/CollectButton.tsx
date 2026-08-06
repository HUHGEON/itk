"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Collect now, without waiting for the next scheduled pass.
 *
 * Defaults to the tier-0 + outlets band because that finishes in about thirty
 * seconds; the full sweep takes minutes and belongs to the background loop.
 */
export function CollectButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [note, setNote] = useState("");

  const run = async () => {
    setState("running");
    setNote("");
    try {
      const res = await fetch("/api/collect", { method: "POST" });
      const body = (await res.json()) as {
        ok?: boolean;
        inserted?: number;
        error?: string;
      };

      if (!res.ok || !body.ok) {
        setState("error");
        setNote(body.error?.slice(0, 60) ?? `HTTP ${res.status}`);
        return;
      }

      setState("done");
      setNote(body.inserted ? `신규 ${body.inserted}건` : "새 기사 없음");
      router.refresh();
      window.setTimeout(() => setState("idle"), 4000);
    } catch (err) {
      setState("error");
      setNote(err instanceof Error ? err.message.slice(0, 60) : "실패");
    }
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
        onClick={run}
        disabled={state === "running"}
        title="지금 수집 (0티어 + 매체 피드, 약 30초)"
        className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted transition-colors hover:text-text disabled:opacity-50"
      >
        {state === "running" ? "수집 중…" : "↻ 수집"}
      </button>
    </div>
  );
}
