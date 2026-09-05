"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef } from "react";
import type { Match } from "@/lib/matches";
import { MatchRow } from "./MatchRow";
import { useLiveMatches } from "./useLiveMatches";
import { dealIn } from "@/lib/motion";

/**
 * A day's football.
 *
 * Grouped by competition rather than laid out as one long list: a Saturday runs
 * to forty-odd matches across six leagues, and "which competition is this" is
 * the question a flat list makes you ask on every row. The competition name
 * carries it once for the whole group.
 *
 * Groups are ordered by how much of the reader's attention they have a claim
 * on - anything being played right now first, then whatever involves a club
 * they follow, then everyone else.
 */
export function MatchBoard({
  date,
  initial,
  onlyTracked,
  bare = false,
}: {
  date: Date;
  initial: Match[];
  onlyTracked: boolean;
  /** Drop the competition headings and the footer: the page already said. */
  bare?: boolean;
}) {
  const { matches, live } = useLiveMatches(date, initial);
  const board = useRef<HTMLDivElement>(null);

  /**
   * The rows arrive in the order they will be read.
   *
   * Keyed on the day and the scope, so it plays when the board is a new board
   * and stays out of the way when a poll simply refreshes the numbers - a
   * cascade every five seconds would be unbearable.
   */
  const scope = `${date.toDateString()}·${onlyTracked}`;
  useEffect(() => {
    const el = board.current;
    if (!el) return;
    dealIn([...el.querySelectorAll<HTMLElement>("[data-match-row]")]);
  }, [scope]);

  const groups = useMemo(() => {
    const rows = onlyTracked ? matches.filter((m) => m.tracked) : matches;
    const byComp = new Map<string, Match[]>();
    for (const m of rows) {
      const list = byComp.get(m.competition);
      if (list) list.push(m);
      else byComp.set(m.competition, [m]);
    }
    return [...byComp.entries()]
      .map(([competition, list]) => ({
        competition,
        list,
        live: list.some((m) => m.state === "in"),
        tracked: list.some((m) => m.tracked),
        first: Math.min(...list.map((m) => m.kickoff)),
      }))
      .sort(
        (a, b) =>
          Number(b.live) - Number(a.live) ||
          Number(b.tracked) - Number(a.tracked) ||
          a.first - b.first,
      );
  }, [matches, onlyTracked]);

  if (groups.length === 0) {
    return (
      <div className="px-[var(--gutter)] py-16 text-center">
        <p className="text-[14px] text-muted">
          {onlyTracked
            ? "이 날은 보고 있는 구단의 경기가 없습니다"
            : "이 날은 경기가 없습니다"}
        </p>
        {onlyTracked && matches.length > 0 && (
          <p className="mt-2 text-[13px] text-faint">
            다른 경기 {matches.length}건은 전체 보기에서 볼 수 있습니다
          </p>
        )}
      </div>
    );
  }

  return (
    <div ref={board}>
      {live && (
        <p className="px-[calc(var(--gutter)+0.5rem)] pb-1 text-[11.5px] text-muted">
          진행 중인 경기는 자동으로 갱신됩니다
        </p>
      )}

      {/*
        Two columns once there is room for them.

        A match row wants to be narrow - the eye reads it from the scoreline
        outward, and stretched across a wide screen the two clubs end up at
        opposite edges. But holding every row to that width left two thirds of
        a desktop window empty. Columns keep the row narrow and use the space,
        and a Saturday of forty fixtures stops being a single long scroll.
      */}
      <div
        className={`grid items-start gap-x-6 px-[var(--gutter)] ${
          bare ? "" : "lg:grid-cols-2"
        }`}
      >
      {groups.map((g) => (
        <section
          key={g.competition}
          className="border-b border-border last:border-b-0 lg:border-b-0"
        >
          {!bare && (
            <h2 className="flex items-center gap-2 px-2 pt-5 pb-2 text-[12px] font-semibold text-muted">
              {g.competition}
              {g.live && (
                <span className="live-badge rounded-[3px] bg-accent px-1.5 py-[1px] text-[10px] font-bold text-accent-ink">
                  LIVE
                </span>
              )}
            </h2>
          )}
          <div className="divide-y divide-border/60 pb-2">
            {g.list.map((m) => (
              <MatchRow key={m.id} match={m} />
            ))}
          </div>
        </section>
      ))}
      </div>

      {!bare && (
        <p className="border-t border-border px-[calc(var(--gutter)+0.5rem)] py-6 text-[11.5px] text-faint">
          구단 이름을 누르면 그 팀 기사로 갑니다.{" "}
          <Link href="/feed" className="text-muted underline-offset-4 hover:underline">
            전체 소식 보기
          </Link>
        </p>
      )}
    </div>
  );
}
