"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { nextForClubs, seoul, type Match } from "@/lib/matches";
import { useFavourites } from "@/lib/favourites";
import { markGoal } from "@/lib/motion";

/**
 * The clubs someone follows, and what each is doing next.
 *
 * A fixture list is chronological, which is right for the day but wrong for the
 * question most people arrive with - when do my lot play. So the clubs picked
 * out sit above it, one card each, showing a match in play with its score or
 * the next one with its kick-off.
 *
 * A club in play is pulled to the front and keeps ticking, because a live match
 * is the only thing here that changes while it is being looked at.
 */
const INTERVAL_MS = 5000;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/** "오늘 22:00", "내일 04:00", "9.13 (일) 23:15". */
function whenLabel(kickoff: number): string {
  const d = seoul(kickoff);
  const now = seoul(Date.now());
  const days = Math.round(
    (Date.UTC(d.year, d.month - 1, d.day) -
      Date.UTC(now.year, now.month - 1, now.day)) /
      86_400_000,
  );
  if (days === 0) return `오늘 ${d.hm}`;
  if (days === 1) return `내일 ${d.hm}`;
  return `${d.month}.${d.day} (${WEEKDAY[d.weekday]}) ${d.hm}`;
}

function Card({ slug, match }: { slug: string; match: Match }) {
  const live = match.state === "in";
  const done = match.state === "post";
  const us = match.home.slug === slug ? match.home : match.away;
  const them = match.home.slug === slug ? match.away : match.home;
  const score = useRef<HTMLSpanElement>(null);
  const last = useRef(`${match.home.score}-${match.away.score}`);

  useEffect(() => {
    const now = `${match.home.score}-${match.away.score}`;
    if (last.current !== now && score.current) markGoal(score.current);
    last.current = now;
  }, [match.home.score, match.away.score]);

  const crest = (side: typeof us, dim = false) =>
    side.crest ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={side.crest}
        alt=""
        width={18}
        height={18}
        className={`size-[18px] shrink-0 object-contain ${dim ? "opacity-80" : ""}`}
      />
    ) : (
      <span className="size-[18px] shrink-0" />
    );

  return (
    <Link
      href={`/matches/game/${match.code}/${match.id}`}
      title={`${match.home.name} 대 ${match.away.name}`}
      className={`flex shrink-0 snap-start flex-col gap-1 rounded-[8px] border px-3 py-2 transition-colors ${
        live
          ? "border-accent/40 bg-accent/[0.07] hover:bg-accent/[0.11]"
          : "border-border bg-surface-2/40 hover:border-border-strong"
      }`}
    >
      <div className="flex items-center justify-between gap-3 text-[10.5px]">
        <span className="truncate text-faint">{match.competitionShort}</span>
        {live ? (
          <span className="live-badge tnum shrink-0 rounded-[3px] bg-accent px-1.5 py-[1px] font-bold text-accent-ink">
            {match.clock ?? "LIVE"}
          </span>
        ) : (
          <span className="tnum shrink-0 text-muted">
            {done ? "종료" : whenLabel(match.kickoff)}
          </span>
        )}
      </div>

      {/*
        One line: us, the score or "vs", them.
        
        Two stacked rows made every card as tall as a fixture row and the strip
        as tall as the day beneath it. The club being followed leads, so a row
        of cards reads as a list of one's own clubs rather than of matches.
      */}
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        {crest(us)}
        <span className="text-[13px] font-semibold text-text">{us.name}</span>
        {live || done ? (
          <span
            ref={score}
            className={`tnum px-1 text-[13.5px] font-bold ${
              live ? "text-accent" : "text-text"
            }`}
          >
            {us.score ?? 0} : {them.score ?? 0}
          </span>
        ) : (
          <span className="px-1 text-[11.5px] text-faint">vs</span>
        )}
        <span className="text-[13px] text-muted">{them.name}</span>
        {crest(them, true)}
      </div>
    </Link>
  );
}

export function MyTeams() {
  const { teams, ready } = useFavourites();
  const [byClub, setByClub] = useState<Record<string, Match>>({});
  const [loading, setLoading] = useState(false);

  // The fixtures for the followed clubs, refreshed while any of them is playing.
  useEffect(() => {
    if (!ready || teams.length === 0) {
      setByClub({});
      return;
    }
    const ac = new AbortController();
    let timer: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      try {
        const next = await nextForClubs(teams, ac.signal);
        if (!ac.signal.aborted) setByClub(next);
      } catch {
        // Keep whatever is on screen.
      }
    };

    setLoading(true);
    load().finally(() => !ac.signal.aborted && setLoading(false));

    timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, INTERVAL_MS);
    return () => {
      ac.abort();
      if (timer) clearInterval(timer);
    };
    // Joined so the effect does not restart on every render of the same list.
  }, [ready, teams.join(",")]);

  if (!ready || teams.length === 0) return null;

  // Playing first, then by kick-off. A live match is what someone came for.
  const cards = teams
    .map((slug) => [slug, byClub[slug]] as const)
    .filter((e): e is [string, Match] => Boolean(e[1]))
    .sort(([, a], [, b]) => {
      if ((a.state === "in") !== (b.state === "in")) return a.state === "in" ? -1 : 1;
      return a.kickoff - b.kickoff;
    });

  return (
    <section className="border-b border-border">
      <div className="flex items-baseline justify-center gap-3 px-[var(--gutter)] pt-3 pb-1.5">
        <h2 className="text-[12px] font-semibold text-muted">내 팀</h2>
        {cards.length === 0 && !loading && (
          <span className="text-[11.5px] text-faint">
            2주 안에 예정된 경기가 없습니다
          </span>
        )}
      </div>
      {cards.length > 0 && (
        // Centred while they fit, scrolling once they do not.
        <div className="flex snap-x justify-center gap-2.5 overflow-x-auto px-[var(--gutter)] pb-3">
          {cards.map(([slug, m]) => (
            <Card key={slug} slug={slug} match={m} />
          ))}
        </div>
      )}
      {cards.length === 0 && loading && (
        <div className="flex justify-center gap-2.5 px-[var(--gutter)] pb-3">
          {teams.slice(0, 3).map((s) => (
            <span
              key={s}
              className="h-[52px] w-[14rem] shrink-0 animate-pulse rounded-[8px] bg-surface-2"
            />
          ))}
        </div>
      )}
    </section>
  );
}
