"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import type { Match } from "@/lib/matches";
import { MatchRow } from "./MatchRow";
import { MEASURE } from "./Measure";
import { useLiveMatches } from "./useLiveMatches";
import { dealIn } from "@/lib/motion";

/**
 * A day's football, in the order it is played.
 *
 * One column, sorted by kick-off, with the competition riding on each row.
 * Grouping by competition was tried and dropped: across two columns it
 * scattered the leagues so the third one read sat at the top right and the
 * fourth halfway down it, and columns of unequal length left holes down the
 * page. A day is a sequence of kick-off times, and reading it as one is what
 * the eye expects.
 *
 * Narrowing to a single competition is the rail's job, not this component's.
 */
export function MatchBoard({
  date,
  initial,
  onlyTracked,
  bare = false,
  next = null,
}: {
  date: Date;
  initial: Match[];
  onlyTracked: boolean;
  /** The page already named the competition, so the rows need not repeat it. */
  bare?: boolean;
  /** on an empty day, the next day with a match */
  next?: { href: string; label: string } | null;
}) {
  const { matches, live } = useLiveMatches(date, initial);
  const board = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const list = onlyTracked ? matches.filter((m) => m.tracked) : matches;
    // Anything in play is pulled to the top: it is the only thing on the page
    // that is changing, and it is why the page is open.
    return [...list].sort(
      (a, b) =>
        Number(b.state === "in") - Number(a.state === "in") ||
        a.kickoff - b.kickoff,
    );
  }, [matches, onlyTracked]);

  /**
   * The rows arrive in the order they will be read.
   *
   * Keyed on the day and the scope, so it plays when the board is a new board
   * and stays out of the way when a poll simply refreshes the numbers. A
   * cascade every five seconds would be unbearable.
   */
  const scope = `${date.toDateString()}·${onlyTracked}·${rows.length}`;
  useEffect(() => {
    const el = board.current;
    if (!el) return;
    dealIn([...el.querySelectorAll<HTMLElement>("[data-match-row]")]);
  }, [scope]);

  if (rows.length === 0) {
    return (
      <div className="px-[var(--gutter)] py-16 text-center">
        <p className="text-[14px] text-muted">
          {onlyTracked
            ? "이 날은 주요 구단의 경기가 없습니다"
            : "이 날은 경기가 없습니다"}
        </p>
        {onlyTracked && matches.length > 0 && (
          <p className="mt-2 text-[13px] text-faint">
            다른 경기 {matches.length}건은 전체 보기에서 볼 수 있습니다
          </p>
        )}
        {next && (
          <Link
            href={next.href}
            className="mt-5 inline-flex items-center gap-1.5 rounded-[10px] bg-accent px-4 py-2.5 text-[14px] font-semibold text-accent-ink transition-[filter] hover:brightness-110"
          >
            다음 경기일 {next.label} 보기 ›
          </Link>
        )}
      </div>
    );
  }

  return (
    <div ref={board} className={MEASURE}>
      {live && (
        <p className="px-[calc(var(--gutter)+0.5rem)] pt-3 pb-1 text-[12.5px] text-muted">
          진행 중인 경기는 자동으로 갱신됩니다
        </p>
      )}

      <div className="px-[var(--gutter)] pb-2">
        <div className="divide-y divide-border/60">
          {rows.map((m) => (
            <MatchRow key={m.id} match={m} showCompetition={!bare} />
          ))}
        </div>
      </div>

      {!bare && (
        <p className="border-t border-border px-[calc(var(--gutter)+0.5rem)] py-6 text-[12.5px] text-faint">
          경기를 누르면 기록과 선수 명단을 볼 수 있습니다.{" "}
          <Link
            href="/feed"
            className="text-muted underline-offset-4 hover:underline"
          >
            전체 소식 보기
          </Link>
        </p>
      )}
    </div>
  );
}
