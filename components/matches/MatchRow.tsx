"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { seoul, type Match, type MatchSide } from "@/lib/matches";
import { markGoal } from "@/lib/motion";

/**
 * One match.
 *
 * A fixture is read from the middle out: the eye lands on the scoreline and
 * collects the two clubs beside it. So the crests sit tight against the score
 * and the names run outward, and everything else - kick-off time, minute
 * played - is set quieter around that spine.
 *
 * Clubs the feed follows are links to their stories and carry full weight;
 * everyone else is present but recessive. There is nowhere useful to send
 * someone who taps Coventry City, and pretending otherwise would flatten the
 * one distinction this board is built on.
 */

function Side({ side, align }: { side: MatchSide; align: "home" | "away" }) {
  const body = (
    <>
      {side.crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={side.crest}
          alt=""
          width={26}
          height={26}
          loading="lazy"
          className={`size-[26px] shrink-0 object-contain transition-opacity ${
            side.slug ? "" : "opacity-70"
          }`}
        />
      ) : (
        <span className="size-[26px] shrink-0" />
      )}
      <span
        className={`min-w-0 truncate text-[14px] ${
          side.slug ? "font-semibold text-text" : "text-muted"
        }`}
      >
        {side.name}
      </span>
    </>
  );

  const lane =
    align === "home"
      ? "flex-row-reverse justify-start text-right"
      : "justify-start text-left";

  return side.slug ? (
    <Link
      href={`/feed?team=${side.slug}`}
      title={`${side.name} 소식 보기`}
      className={`flex min-w-0 items-center gap-2.5 rounded-[4px] transition-colors hover:text-accent ${lane}`}
    >
      {body}
    </Link>
  ) : (
    <span className={`flex min-w-0 items-center gap-2.5 ${lane}`}>{body}</span>
  );
}

export function MatchRow({
  match,
  showCompetition = false,
}: {
  match: Match;
  /** On a mixed list the competition has to ride along on the row. */
  showCompetition?: boolean;
}) {
  const live = match.state === "in";
  const done = match.state === "post";
  const score = useRef<HTMLSpanElement>(null);
  const last = useRef<string | null>(null);

  /**
   * Fires when the scoreline itself changes, not on every poll.
   *
   * The board refreshes every few seconds and almost every refresh returns the
   * same numbers. Comparing against the previous value means the flash marks a
   * goal and nothing else. The first render seeds the reference without
   * animating, or every match would flash on arrival.
   */
  useEffect(() => {
    if (!live) return;
    const now = `${match.home.score}-${match.away.score}`;
    if (last.current !== null && last.current !== now && score.current) {
      markGoal(score.current);
    }
    last.current = now;
  }, [live, match.home.score, match.away.score]);

  const time = seoul(match.kickoff).hm;

  return (
    <article
      data-match-row
      className={`group grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[6px] px-2 py-3 transition-colors sm:gap-4 ${
        live ? "bg-accent/[0.06]" : "hover:bg-surface-2/40"
      }`}
    >
      <Side side={match.home} align="home" />

      <div className="flex min-w-[72px] flex-col items-center gap-0.5">
        {showCompetition && (
          <span className="text-[10px] leading-none text-faint">
            {match.competitionShort}
          </span>
        )}
        {match.state === "pre" ? (
          <span className="tnum text-[14.5px] font-semibold text-muted">
            {time}
          </span>
        ) : (
          <span
            ref={score}
            className={`tnum inline-block text-[17px] leading-none font-bold whitespace-nowrap ${
              live ? "text-accent" : "text-text"
            }`}
          >
            {match.home.score ?? 0}
            <span className="px-1 font-normal text-faint">:</span>
            {match.away.score ?? 0}
          </span>
        )}

        {/* Only a match in play earns a second line. A fixture has nothing to
            add and a finished one says so in a single quiet word. */}
        {live && match.clock && (
          <span className="tnum text-[10.5px] font-semibold text-accent">
            {match.clock}
          </span>
        )}
        {done && (
          <span className="text-[10.5px] font-medium text-faint">종료</span>
        )}
      </div>

      <Side side={match.away} align="away" />
    </article>
  );
}
