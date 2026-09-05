"use client";

import { useEffect, useRef } from "react";
import type { Match } from "@/lib/matches";
import { dealIn } from "@/lib/motion";

/**
 * A club's results and fixtures, with the competition on every row.
 *
 * A club plays in four or five competitions at once, so unlike the day view
 * these cannot be grouped by competition without scattering the sequence that
 * matters here, which is time. The competition rides along on each row instead.
 *
 * Results run most recent first and fixtures soonest first, so both lists read
 * outward from now, which is where the reader is.
 */
export function TeamSeason({
  slug,
  played,
  upcoming,
  live,
}: {
  slug: string;
  played: Match[];
  upcoming: Match[];
  live: Match[];
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    dealIn([...el.querySelectorAll<HTMLElement>("[data-season-row]")]);
  }, [slug]);

  return (
    <div ref={root}>
      {live.length > 0 && (
        <Block title="진행 중" rows={live} slug={slug} highlight />
      )}
      {upcoming.length > 0 && (
        <Block title="다음 경기" rows={upcoming.slice(0, 12)} slug={slug} />
      )}
      {played.length > 0 && (
        <Block
          title="지난 경기"
          rows={[...played].reverse().slice(0, 20)}
          slug={slug}
        />
      )}
      {live.length + upcoming.length + played.length === 0 && (
        <p className="px-[var(--gutter)] py-16 text-center text-[14px] text-muted">
          최근 90일 안에 경기가 없습니다
        </p>
      )}
    </div>
  );
}

function Block({
  title,
  rows,
  slug,
  highlight = false,
}: {
  title: string;
  rows: Match[];
  slug: string;
  highlight?: boolean;
}) {
  return (
    <section className="border-b border-border last:border-b-0">
      <h2 className="flex items-center gap-2 px-[var(--gutter)] pt-5 pb-2 text-[12px] font-semibold text-muted">
        {title}
        {highlight && (
          <span className="live-badge rounded-[3px] bg-accent px-1.5 py-[1px] text-[10px] font-bold text-accent-ink">
            LIVE
          </span>
        )}
      </h2>
      <div className="divide-y divide-border/60 px-[var(--gutter)] pb-3">
        {rows.map((m) => (
          <SeasonRow key={m.id} match={m} slug={slug} />
        ))}
      </div>
    </section>
  );
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function SeasonRow({ match, slug }: { match: Match; slug: string }) {
  const home = match.home.slug === slug;
  const us = home ? match.home : match.away;
  const them = home ? match.away : match.home;
  const d = new Date(match.kickoff);
  const live = match.state === "in";
  const done = match.state === "post";

  // Result from this club's point of view: the reason anyone opened this page.
  const a = us.score ?? 0;
  const b = them.score ?? 0;
  const outcome = !done ? null : a > b ? "승" : a === b ? "무" : "패";
  const outcomeTone =
    outcome === "승"
      ? "bg-emerald-500/15 text-emerald-400"
      : outcome === "패"
        ? "bg-red-500/15 text-red-400"
        : "bg-surface-3 text-muted";

  return (
    <article
      data-season-row
      className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5"
    >
      <div className="tnum w-[52px] shrink-0 text-[11.5px] leading-tight text-faint">
        <div>
          {d.getMonth() + 1}.{d.getDate()}
        </div>
        <div className="text-[10.5px]">({WEEKDAY[d.getDay()]})</div>
      </div>

      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`w-[5.5rem] shrink-0 truncate text-[11px] ${
            live ? "text-accent" : "text-faint"
          }`}
        >
          {match.competitionShort}
        </span>
        <span className="shrink-0 text-[11.5px] text-faint">
          {home ? "홈" : "원정"}
        </span>
        {them.crest ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={them.crest}
            alt=""
            width={20}
            height={20}
            loading="lazy"
            className="size-5 shrink-0 object-contain"
          />
        ) : (
          <span className="size-5 shrink-0" />
        )}
        <span className="min-w-0 truncate text-[13.5px] text-text">
          {them.name}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {done || live ? (
          <>
            <span
              className={`tnum text-[14px] font-bold ${
                live ? "text-accent" : "text-text"
              }`}
            >
              {a}
              <span className="px-1 font-normal text-muted">:</span>
              {b}
            </span>
            {outcome && (
              <span
                className={`rounded-[3px] px-1.5 py-[1px] text-[10.5px] font-bold ${outcomeTone}`}
              >
                {outcome}
              </span>
            )}
            {live && match.clock && (
              <span className="tnum text-[10.5px] font-semibold text-accent">
                {match.clock}
              </span>
            )}
          </>
        ) : (
          <span className="tnum text-[13px] font-medium text-muted">
            {String(d.getHours()).padStart(2, "0")}:
            {String(d.getMinutes()).padStart(2, "0")}
          </span>
        )}
      </div>
    </article>
  );
}
