"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "animejs";
import { X } from "@phosphor-icons/react/dist/ssr";
import { reducedMotion } from "@/lib/motion";

/**
 * A daily game's running record, as the original keeps it: games played, how
 * many were won, the current and best streak, and how many guesses each win
 * took. Kept in this browser only.
 */
export interface GameRecord {
  played: number;
  wins: number;
  streak: number;
  best: number;
  dist: { [tries: string]: number };
  /** the last day recorded, so a finished day is never counted twice */
  lastDay: number;
  lastWonDay: number;
}

const EMPTY: GameRecord = { played: 0, wins: 0, streak: 0, best: 0, dist: {}, lastDay: 0, lastWonDay: 0 };

function read(game: string): GameRecord {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(`itk:stats:${game}`) ?? "{}") };
  } catch {
    return EMPTY;
  }
}

/** Counts a finished day once; a streak survives only an unbroken run of wins. */
export function recordResult(game: string, day: number, won: boolean, tries: number): GameRecord {
  const r = read(game);
  if (r.lastDay === day) return r;
  const next: GameRecord = { ...r, played: r.played + 1, lastDay: day, dist: { ...r.dist } };
  if (won) {
    next.wins++;
    next.streak = r.lastWonDay === day - 1 ? r.streak + 1 : 1;
    next.best = Math.max(r.best, next.streak);
    next.lastWonDay = day;
    next.dist[String(tries)] = (next.dist[String(tries)] ?? 0) + 1;
  } else {
    next.streak = 0;
  }
  try {
    localStorage.setItem(`itk:stats:${game}`, JSON.stringify(next));
  } catch {
    // no storage
  }
  return next;
}

export function useRecord(game: string) {
  const [r, setR] = useState<GameRecord>(EMPTY);
  useEffect(() => setR(read(game)), [game]);
  return [r, setR] as const;
}

/** Time until midnight in Seoul, when the next puzzle opens. */
function untilNext(): string {
  const seoul = Date.now() + 9 * 3600_000;
  const left = 86_400_000 - (seoul % 86_400_000);
  const s = Math.floor(left / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function StatsModal({
  record,
  buckets,
  highlight,
  nextLabel,
  onShare,
  shared,
  onClose,
}: {
  record: GameRecord;
  /** the distribution's rows, e.g. ["1".."8"] or ["1".."6","7+"] */
  buckets: string[];
  highlight?: string;
  nextLabel: string;
  /** absent until the game is over: nothing to share yet */
  onShare?: () => void;
  shared: boolean;
  onClose: () => void;
}) {
  const [clock, setClock] = useState(untilNext);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = window.setInterval(() => setClock(untilNext()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!box.current || reducedMotion()) return;
    animate(box.current, { opacity: [0, 1], y: [16, 0], duration: 420, ease: "outExpo" });
  }, []);

  const count = (b: string) =>
    b.endsWith("+")
      ? Object.entries(record.dist)
          .filter(([k]) => Number(k) >= Number(b.slice(0, -1)))
          .reduce((a, [, v]) => a + v, 0)
      : (record.dist[b] ?? 0);
  const max = Math.max(1, ...buckets.map(count));
  const rate = record.played ? Math.round((record.wins / record.played) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label="통계"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[360px] rounded-[10px] border border-border-strong bg-surface p-5 text-text shadow-2xl"
      >
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute top-3 right-3 text-muted hover:text-text">
          <X className="size-5" />
        </button>
        <h2 className="text-center text-[15px] font-bold">통계</h2>
        <div className="mt-3 grid grid-cols-4 text-center">
          {[
            [record.played, "총 도전"],
            [`${rate}%`, "성공률"],
            [record.streak, "연속"],
            [record.best, "최고 연속"],
          ].map(([v, l]) => (
            <div key={String(l)}>
              <div className="tnum text-[26px] leading-none font-bold">{v}</div>
              <div className="mt-1 text-[11px] text-muted">{l}</div>
            </div>
          ))}
        </div>
        <h3 className="mt-5 text-center text-[13px] font-semibold">몇 번 만에 맞혔나</h3>
        <ul className="mt-2 space-y-1">
          {buckets.map((b) => {
            const n = count(b);
            return (
              <li key={b} className="flex items-center gap-2 text-[12px]">
                <span className="tnum w-5 text-right text-muted">{b}</span>
                <span
                  className={`tnum flex h-5 items-center justify-end rounded-[3px] px-1.5 text-[11px] font-bold ${
                    b === highlight ? "bg-emerald-500 text-black" : "bg-surface-3 text-text"
                  }`}
                  style={{ width: `${Math.max(8, (n / max) * 100)}%` }}
                >
                  {n}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-center text-[12px] font-semibold tracking-wide text-muted">
          {nextLabel} <span className="tnum text-text">{clock}</span>
        </p>
        {onShare && (
          <button
            type="button"
            data-press
            onClick={onShare}
            className="mt-3 w-full rounded-[6px] py-2.5 text-[14px] font-semibold text-accent-ink"
            style={{ background: "var(--ribbon)" }}
          >
            {shared ? "복사했습니다" : "결과 공유"}
          </button>
        )}
      </div>
    </div>
  );
}
