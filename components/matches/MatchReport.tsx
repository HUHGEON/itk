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
import type { FmLineup, FmTeam } from "@/lib/fotmob";
import { spots } from "@/lib/pitch";
import { Timeline } from "./Timeline";
import { StatBars } from "./StatBars";
import { Lineups } from "./Lineups";
import { Pitch, type PitchPlayer } from "./Pitch";
import { PlayerCard } from "./PlayerCard";

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

type TabId = "lineup" | "events" | "stats";

/** When each player was replaced, read off the timeline. */
function subMinutes(events: MatchDetail["events"]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of events) {
    if (e.kind !== "sub") continue;
    if (e.player) out[e.player] = e.minute;
    if (e.second) out[e.second] = e.minute;
  }
  return out;
}
const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

export function MatchReport({
  initial,
  fm = null,
  faces = {},
}: {
  initial: MatchDetail;
  /** Ratings, photographs and exact positions, when the match was found. */
  fm?: FmLineup | null;
  /** Fallback photographs, keyed by player name. */
  faces?: Record<string, string>;
}) {
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

  /*
   * Positions from the richer source where it has the match, worked out from
   * the formation where it does not.
   *
   * The two agree on shape - both were checked against the same 4-2-3-1 - but
   * only one of them gives coordinates, ratings and photographs, so it leads
   * whenever it answers.
   */
  const pitchSide = (
    side: "home" | "away",
  ): PitchPlayer[] | null => {
    const t = fm?.[side];
    if (t) {
      return t.starters.map((p) => ({
        id: p.id,
        name: p.name,
        jersey: p.jersey,
        x: p.x,
        y: p.y,
        rating: p.rating,
        image: p.image,
        goals: p.goals,
        assists: p.assists,
        offAt: p.offAt,
      }));
    }
    const l = detail.lineups?.[side];
    const laid = l ? spots(l) : null;
    if (!laid) return null;
    const off = subMinutes(detail.events);
    return laid.map((p) => ({
      id: 0,
      name: p.name,
      jersey: p.jersey,
      x: p.x,
      y: p.y,
      rating: null,
      image: faces[p.name] ?? null,
      goals: p.goals,
      assists: p.assists,
      offAt: p.subbedOut && off[p.name] ? Number(off[p.name].replace(/\D+/g, "")) : null,
    }));
  };
  const meta = (side: "home" | "away") => {
    const t = fm?.[side];
    return {
      formation: t?.formation ?? detail.lineups?.[side]?.formation ?? null,
      rating: t?.rating ?? null,
      coach: t?.coach ?? null,
    };
  };
  const hasPitch = Boolean(pitchSide("home") && pitchSide("away"));

  const tabs = [
    (hasPitch || fm) && { id: "lineup" as const, label: "라인업" },
    detail.events.length > 0 && { id: "events" as const, label: "경기 기록" },
    detail.stats.length > 0 && { id: "stats" as const, label: "통계" },
  ].filter((t): t is { id: TabId; label: string } => Boolean(t));

  // The chosen tab, or the first one that exists. Holding the choice rather
  // than forcing it means a live match that gains a statistics tab mid-way does
  // not yank the reader off the one they were looking at.
  const [tab, setTab] = useState<TabId | null>(null);
  const [openPlayer, setOpenPlayer] = useState<number | null>(null);
  const current = tabs.some((t) => t.id === tab) ? tab : tabs[0]?.id;

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
          {detail.attendance && (
            <>
              <span aria-hidden>·</span>
              <span className="tnum">
                관중 {detail.attendance.toLocaleString("ko-KR")}
              </span>
            </>
          )}
          {detail.referee && (
            <>
              <span aria-hidden>·</span>
              <span>주심 {detail.referee}</span>
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
        Three views of one match, behind three tabs.
        
        A report is not read straight through. Someone opens it wanting one of
        three things - who is playing, what happened, how it went - and stacking
        all three down a page makes two of them a scroll away from whichever one
        was wanted. The lineup leads because it is the question asked most, and
        the one thing here that cannot be worked out from the scoreline.
        
        Only tabs with something behind them are offered, so a fixture that has
        not kicked off shows one tab rather than three, two of them empty.
      */}
      {tabs.length > 0 && (
        <>
          <nav className="flex gap-1 border-b border-border px-[var(--gutter)]">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                aria-current={t.id === current ? "page" : undefined}
                className={`-mb-px border-b-2 px-3 py-2.5 text-[13px] transition-colors ${
                  t.id === current
                    ? "border-accent font-semibold text-text"
                    : "border-transparent text-muted hover:text-text"
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {current === "lineup" && (
            <section className="pt-4">
              <Pitch
                home={pitchSide("home")}
                away={pitchSide("away")}
                homeSide={match.home}
                awaySide={match.away}
                homeMeta={meta("home")}
                awayMeta={meta("away")}
                onOpen={setOpenPlayer}
              />
              <Lineups
                home={fm?.home ?? null}
                away={fm?.away ?? null}
                homeName={match.home.name}
                awayName={match.away.name}
                onOpen={setOpenPlayer}
              />
            </section>
          )}
          {current === "events" && <Timeline events={detail.events} />}
          {current === "stats" && <StatBars groups={detail.stats} />}
        </>
      )}

      {tabs.length === 0 && (
        /*
         * "About an hour" is measured, not assumed.
         *
         * Three matches were watched from three hours out at two minute
         * intervals: the lineups appeared 81, 53 and 36 minutes before their
         * kick-offs. So an hour is the middle of it and the spread is wide
         * enough that a firmer number would be wrong more often than right.
         * An earlier version of this line said "한 시간 전" with nothing behind
         * it, and a later one said "킥오프와 함께" because nothing had been
         * measured yet.
         */
        <p className="px-[var(--gutter)] py-16 text-center text-[13.5px] text-muted">
          아직 공개된 기록이 없습니다. 선수 명단은 보통 킥오프 1시간 전후에
          나옵니다.
        </p>
      )}
      <PlayerCard id={openPlayer} onClose={() => setOpenPlayer(null)} />
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
