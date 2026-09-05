"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  parseSummary,
  seoul,
  summaryUrl,
  type MatchDetail,
  type MatchSide,
} from "@/lib/matches";
import { markGoal } from "@/lib/motion";
import { MEASURE } from "./Measure";
import { Timeline } from "./Timeline";
import { StatBars } from "./StatBars";
import { Lineups } from "./Lineups";
import { Pitch } from "./Pitch";

/**
 * One match, kept current.
 *
 * The report polls the same open endpoint the board does, on the same terms:
 * only while the match is actually in play, only while the tab is visible, and
 * again the moment it becomes visible. A finished match never polls, so an
 * archive page costs one request.
 *
 * Re-parsing the whole summary each time is deliberate. A goal changes the
 * scoreline, the timeline, four statistics and possibly both lineups, and
 * patching those individually would be five chances to leave one stale.
 */
const INTERVAL_MS = 5000;
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export function MatchReport({ initial }: { initial: MatchDetail }) {
  const [detail, setDetail] = useState(initial);
  const { match } = detail;
  const live = match.state === "in";
  const score = useRef<HTMLDivElement>(null);
  const last = useRef(`${match.home.score}-${match.away.score}`);

  useEffect(() => {
    if (!live) return;
    const ac = new AbortController();

    const refresh = async () => {
      try {
        const res = await fetch(summaryUrl(match.code, match.id), {
          signal: ac.signal,
          cache: "no-store",
        });
        if (!res.ok) return;
        const next = parseSummary(await res.json(), match.code, match.id);
        if (next && !ac.signal.aborted) setDetail(next);
      } catch {
        // The previous report is still on screen and still nearly right.
      }
    };

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      ac.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [live, match.code, match.id]);

  // The flash marks a goal, so it fires on the scoreline changing and not on
  // every poll that returns the same two numbers.
  useEffect(() => {
    const now = `${match.home.score}-${match.away.score}`;
    if (last.current !== now && score.current) markGoal(score.current);
    last.current = now;
  }, [match.home.score, match.away.score]);

  const d = seoul(match.kickoff);
  const done = match.state === "post";

  return (
    /*
     * A report is a document, so it gets the section's measure. Measured at
     * 1440px unconstrained, possession read "69.6%" and "30.4%" 580px apart,
     * which is two facts rather than a comparison.
     */
    <div className={MEASURE}>
      <header className="border-b border-border px-[var(--gutter)] py-6">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-faint">
          <Link
            href={`/matches?comp=${match.code}`}
            className="font-medium text-muted underline-offset-4 hover:text-text hover:underline"
          >
            {match.competition}
          </Link>
          <span aria-hidden>·</span>
          <span className="tnum">
            {d.month}월 {d.day}일 ({WEEKDAY[d.weekday]}) {d.hm}
          </span>
          {detail.venue && (
            <>
              <span aria-hidden>·</span>
              <span>{detail.venue}</span>
            </>
          )}
        </p>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3 sm:gap-6">
          <Club side={match.home} align="home" />

          <div className="flex min-w-[92px] flex-col items-center gap-1">
            {match.state === "pre" ? (
              <span className="tnum text-[26px] leading-none font-bold text-muted">
                {d.hm}
              </span>
            ) : (
              <div
                ref={score}
                className={`tnum text-[34px] leading-none font-bold whitespace-nowrap sm:text-[40px] ${
                  live ? "text-accent" : "text-text"
                }`}
              >
                {match.home.score ?? 0}
                <span className="px-1.5 font-normal text-faint">:</span>
                {match.away.score ?? 0}
              </div>
            )}
            {live && (
              <span className="live-badge rounded-[3px] bg-accent px-1.5 py-[1px] text-[10.5px] font-bold text-accent-ink">
                {match.clock ?? "LIVE"}
              </span>
            )}
            {done && (
              <span className="text-[11px] font-medium text-faint">경기 종료</span>
            )}
          </div>

          <Club side={match.away} align="away" />
        </div>
      </header>

      {/*
        The lineups lead.
        
        Who is playing is the first question asked of a match report, before
        the first kick and after the last, and it is the one thing here that
        cannot be inferred from the scoreline. The pitch answers it at a
        glance; the lists under it carry the numbers and the bench.
      */}
      {detail.lineups && (
        <section className="border-b border-border pt-5">
          <h2 className="px-[var(--gutter)] pb-3 text-[12px] font-semibold text-muted">
            선수 명단
          </h2>
          <Pitch
            home={detail.lineups.home}
            away={detail.lineups.away}
            homeSide={match.home}
            awaySide={match.away}
          />
          <Lineups
            home={detail.lineups.home}
            away={detail.lineups.away}
            homeName={match.home.name}
            awayName={match.away.name}
            bare
          />
        </section>
      )}

      <Timeline events={detail.events} />
      <StatBars groups={detail.stats} />

      {detail.events.length === 0 &&
        detail.stats.length === 0 &&
        !detail.lineups && (
          <p className="px-[var(--gutter)] py-16 text-center text-[13.5px] text-muted">
            아직 공개된 기록이 없습니다. 킥오프와 함께 기록과 선수 명단이
            채워집니다.
          </p>
        )}
    </div>
  );
}

/**
 * One side of the scoreline.
 *
 * A tracked club is a link to its season; everyone else is a name. Same rule as
 * the board - there is nowhere useful to send someone who taps a club the feed
 * does not follow.
 */
function Club({ side, align }: { side: MatchSide; align: "home" | "away" }) {
  const body = (
    <>
      {side.crest ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={side.crest}
          alt=""
          width={44}
          height={44}
          className={`size-9 shrink-0 object-contain sm:size-11 ${
            side.slug ? "" : "opacity-70"
          }`}
        />
      ) : (
        <span className="size-9 shrink-0 sm:size-11" />
      )}
      <span
        className={`min-w-0 text-[14px] leading-tight sm:text-[16px] ${
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
      href={`/matches/team/${side.slug}`}
      title={`${side.name} 일정 보기`}
      className={`flex min-w-0 items-center gap-3 rounded-[4px] transition-colors hover:text-accent ${lane}`}
    >
      {body}
    </Link>
  ) : (
    <span className={`flex min-w-0 items-center gap-3 ${lane}`}>{body}</span>
  );
}
