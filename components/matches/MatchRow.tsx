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
 * Clubs the feed follows carry full weight; everyone else is present but
 * recessive. That contrast is the one distinction this board is built on.
 *
 * The row as a whole is the link, and it goes to the match. Clubs are not links
 * of their own here: a link inside a link is invalid, and of the two
 * destinations the match is the one being pointed at. The club is a tap away
 * from the report, and always in the rail.
 */

function Side({ side, align }: { side: MatchSide; align: "home" | "away" }) {
  const lane =
    align === "home"
      ? "flex-row-reverse justify-start text-right"
      : "justify-start text-left";

  return (
    <span className={`flex min-w-0 items-center gap-2.5 ${lane}`}>
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
    </span>
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
    <Link
      href={`/matches/game/${match.code}/${match.id}`}
      data-match-row
      title={`${match.home.name} 대 ${match.away.name} 기록 보기`}
      className={`group grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[6px] px-2 py-3 transition-colors sm:gap-4 ${
        live ? "bg-accent/[0.06] hover:bg-accent/[0.11]" : "hover:bg-surface-2/40"
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
    </Link>
  );
}
