"use client";

import { useEffect, useRef, useState } from "react";
import type { FmPlayerPage, FmRecentMatch } from "@/lib/fotmob";
import { seoul } from "@/lib/matches";

/**
 * A player, over the lineup rather than instead of it.
 *
 * Tapping a face is a question asked in passing - who is this, how has he been
 * playing - and answering it by leaving the page means finding your way back to
 * the match afterwards. The panel opens over the lineup and closes back onto
 * it, so the thread of what was being read is never dropped.
 *
 * The data is fetched when it opens, not with the page: forty players' careers
 * is a great deal to send on the chance that one of them is tapped.
 */
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function tone(r: number): string {
  if (r >= 7.5) return "bg-emerald-500 text-black";
  if (r >= 6.5) return "bg-amber-500 text-black";
  return "bg-zinc-500 text-white";
}

export function PlayerCard({
  id,
  onClose,
}: {
  id: number | null;
  onClose: () => void;
}) {
  const [player, setPlayer] = useState<FmPlayerPage | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    setPlayer(null);
    setState("loading");
    const ac = new AbortController();
    fetch(`/api/player/${id}`, { signal: ac.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no"))))
      .then((p: FmPlayerPage) => {
        if (!ac.signal.aborted) {
          setPlayer(p);
          setState("idle");
        }
      })
      .catch(() => !ac.signal.aborted && setState("error"));
    return () => ac.abort();
  }, [id]);

  // Escape closes, and the page behind does not scroll while it is open.
  useEffect(() => {
    if (!id) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [id, onClose]);

  if (!id) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="선수 정보"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] w-full max-w-[34rem] overflow-y-auto rounded-t-[14px] border border-border bg-bg shadow-2xl outline-none sm:rounded-[14px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-bg/95 px-4 py-3 backdrop-blur-sm">
          <span className="truncate text-[13px] font-semibold text-muted">
            {player?.name ?? "선수 정보"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="shrink-0 rounded-[4px] px-2 py-1 text-[16px] leading-none text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            ×
          </button>
        </div>

        {state === "loading" && (
          <div className="px-4 py-10">
            {/* Shaped like the answer, so the panel does not jump when it
                arrives. */}
            <div className="flex items-center gap-4">
              <span className="size-[68px] shrink-0 animate-pulse rounded-full bg-surface-2" />
              <span className="h-5 w-40 animate-pulse rounded bg-surface-2" />
            </div>
            <div className="mt-6 grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <span key={i} className="h-9 animate-pulse rounded bg-surface-2" />
              ))}
            </div>
          </div>
        )}

        {state === "error" && (
          <p className="px-4 py-12 text-center text-[13.5px] text-muted">
            선수 정보를 불러오지 못했습니다.
          </p>
        )}

        {player && (
          <>
            <div className="flex items-center gap-4 px-4 py-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={player.image}
                alt=""
                width={68}
                height={68}
                className="size-[68px] shrink-0 rounded-full bg-surface-3 object-cover object-top"
              />
              <div className="min-w-0">
                <h2 className="truncate text-[19px] font-bold tracking-tight text-text">
                  {player.name}
                </h2>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12.5px] text-muted">
                  {player.team && <span>{player.team}</span>}
                  {player.position && (
                    <>
                      <span aria-hidden className="text-faint">·</span>
                      <span>{player.position}</span>
                    </>
                  )}
                  {player.injury && (
                    <>
                      <span aria-hidden className="text-faint">·</span>
                      <span className="text-red-400">{player.injury}</span>
                    </>
                  )}
                </p>
              </div>
            </div>

            {player.facts.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 border-t border-border px-4 py-4 sm:grid-cols-4">
                {player.facts.map((f) => (
                  <div key={f.label} className="min-w-0">
                    <dt className="text-[10.5px] text-faint">{f.label}</dt>
                    <dd className="truncate text-[13px] font-medium text-text">
                      {f.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}

            {player.stats.length > 0 && (
              <section className="border-t border-border px-4 py-4">
                <h3 className="pb-2.5 text-[11.5px] font-semibold text-muted">
                  {player.league ?? "이번 시즌"}
                  {player.season && (
                    <span className="tnum ml-1.5 font-normal text-faint">
                      {player.season}
                    </span>
                  )}
                </h3>
                <dl className="grid grid-cols-4 gap-x-4 gap-y-3">
                  {player.stats.map((s) => (
                    <div key={s.label} className="min-w-0">
                      <dt className="truncate text-[10.5px] text-faint">
                        {s.label}
                      </dt>
                      <dd className="tnum text-[16px] font-bold text-text">
                        {s.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {player.recent.length > 0 && (
              <section className="border-t border-border px-4 py-4">
                <h3 className="pb-1.5 text-[11.5px] font-semibold text-muted">
                  최근 경기
                </h3>
                <ul className="divide-y divide-border/60">
                  {player.recent.slice(0, 6).map((m) => (
                    <Recent key={`${m.date}${m.opponent}`} m={m} />
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Recent({ m }: { m: FmRecentMatch }) {
  const d = seoul(m.date);
  const badge =
    m.outcome === "승"
      ? "bg-emerald-500/15 text-emerald-400"
      : m.outcome === "패"
        ? "bg-red-500/15 text-red-400"
        : "bg-surface-3 text-muted";

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 py-2">
      <span className="tnum w-[38px] shrink-0 text-[11px] leading-tight text-faint">
        {d.month}.{d.day}
        <span className="ml-0.5 text-[10px]">({WEEKDAY[d.weekday]})</span>
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[11px] text-faint">
          {m.home ? "홈" : "원정"}
        </span>
        <span className="min-w-0 truncate text-[12.5px] text-text">
          {m.opponent}
        </span>
        {m.goals > 0 && (
          <span className="shrink-0 text-[11px]">
            ⚽{m.goals > 1 ? m.goals : ""}
          </span>
        )}
        {m.assists > 0 && (
          <span className="shrink-0 text-[11px]">
            👟{m.assists > 1 ? m.assists : ""}
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="tnum text-[12.5px] font-bold text-text">{m.score}</span>
        <span
          className={`rounded-[3px] px-1 py-[1px] text-[10px] font-bold ${badge}`}
        >
          {m.outcome}
        </span>
        {m.rating != null && m.rating > 0 ? (
          <span
            className={`tnum w-[28px] rounded-[3px] text-center text-[10.5px] font-bold ${tone(m.rating)}`}
          >
            {m.rating.toFixed(1)}
          </span>
        ) : (
          <span className="w-[28px]" />
        )}
      </span>
    </li>
  );
}
