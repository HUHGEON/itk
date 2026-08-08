"use client";

import { useState } from "react";
import type { FeedRow } from "@/lib/feed";
import type { Team } from "@/lib/types";
import { tierLabel, tierRule, tierStyle, timeAgo } from "@/lib/format";
import { TeamCrest } from "./TeamCrest";
import { Chevron } from "./icons";

/**
 * One story, read in place.
 *
 * The headline carries the row. Everything else — who filed it, where, when —
 * sits on one quiet line above it, so a column of these scans as headlines with
 * provenance attached rather than as a stack of equally loud cards.
 *
 * Collapsed rows render **no** `<img>` at all: with 80 on screen, mounting every
 * article image at once stalled the page. The image enters the DOM only when the
 * card opens, and is height-capped there.
 */
export function ArticleCard({
  row,
  teams,
  now,
}: {
  row: FeedRow;
  teams: Map<string, Team>;
  now: number;
}) {
  const [open, setOpen] = useState(false);
  const [imageOk, setImageOk] = useState(true);

  const tier = tierStyle(row.tier, row.official);
  const rowTeams = row.teams
    .map((s) => teams.get(s))
    .filter((t): t is Team => Boolean(t));

  const body = row.summaryKo ?? row.snippet;
  // Translation happens during collection and is stored, so there is nothing to
  // resolve at render time — either the row has Korean or it does not.
  const title = row.titleKo ?? row.title;
  const translated = title !== row.title;
  const showImage = Boolean(row.imageUrl) && imageOk;
  const expandable = Boolean(body) || showImage;

  // Byline first; failing that, the reporter an outlet credited.
  const byline = row.journalistKo ?? row.citedKo;
  const outlet =
    row.outlet && row.outlet !== row.source ? row.outlet : row.source;

  // A club posts under its English name, and everything around it is Korean.
  const officialName = row.official
    ? (rowTeams.find((t) => t.en === row.source)?.ko ??
      rowTeams[0]?.ko ??
      row.source)
    : row.source;

  return (
    <article
      // A hairline between rows: without one a column of headlines ran together
      // and the eye had to find each boundary from the text alone.
      //
      // The open row is ringed in the brand orange and lifted off the page. A
      // tinted background alone was not enough to say "this is the one you
      // opened" — it read as a hover state.
      className={`group relative transition-colors ${
        open
          ? "z-10 my-1 rounded-lg border border-accent/45 bg-surface-2 shadow-[0_0_0_1px_rgba(241,128,11,0.12),0_8px_24px_-12px_rgba(0,0,0,0.9)]"
          : "border-b border-border last:border-b-0"
      }`}
    >
      {/* Presence, not decoration: the bar is only as strong as the tier — and
          it widens when the row is open. */}
      <span
        aria-hidden
        className={`absolute inset-y-0 left-0 transition-all ${
          open ? "w-[5px] rounded-l-lg" : "w-[3px]"
        }`}
        style={{
          backgroundColor: tierRule(row.tier, row.official),
          opacity: open ? 1 : 0.85,
        }}
      />

      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        aria-expanded={expandable ? open : undefined}
        className={`block w-full py-3 pr-[var(--gutter)] pl-[calc(var(--gutter)+3px)] text-left transition-colors ${
          expandable
            ? "cursor-pointer hover:bg-surface-2/50 focus-visible:bg-surface-2/50 focus-visible:outline-none"
            : "cursor-default"
        }`}
      >
        {/* Tier and name as one object, not two. They answer the same
            question — who said this, and what is that worth — and reading them
            as a single credential is faster than pairing a loose badge with a
            loose name. The tier colours the cap; the name carries the weight. */}
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className="flex min-w-0 shrink items-stretch overflow-hidden rounded-[4px] border"
            style={{
              borderColor:
                tier.border === "transparent" ? tier.bg : tier.border,
            }}
          >
            <span
              className="shrink-0 px-1.5 py-[3px] text-[10px] font-semibold tracking-tight"
              style={{ backgroundColor: tier.bg, color: tier.ink }}
            >
              {row.official ? "공식" : tierLabel(row.tier)}
            </span>
            <span className="min-w-0 truncate bg-surface-2 px-2 py-[3px] text-[12.5px] leading-[1.35] font-bold text-text">
              {row.official ? officialName : (byline ?? "기자 미확인")}
              {!row.official && byline && !row.journalistKo && (
                <span className="ml-1 text-[10px] font-normal text-faint">
                  인용
                </span>
              )}
            </span>
          </span>

          {!row.official && outlet && (
            <span className="hidden min-w-0 truncate text-muted sm:block">
              {outlet}
            </span>
          )}

          <time
            className="tnum ml-auto shrink-0 text-faint"
            dateTime={new Date(row.publishedAt).toISOString()}
          >
            {timeAgo(row.publishedAt, now)}
          </time>
        </div>
        <div className="mt-1.5 flex items-start gap-4">
          {/* A measure, not the full column. With the sidebar moved the feed is
              ~880px wide, and a headline running the whole way is tiring to
              read — the eye loses the line on the way back. */}
          <div className="min-w-0 flex-1 sm:max-w-[54ch]">
            <h3
              className={`text-[15.5px] leading-[1.38] font-semibold text-text sm:text-[16.5px] ${
                open ? "" : "line-clamp-3"
              }`}
            >
              {title}
            </h3>
            {/* The machine translation mangles football phrasing often enough
                that the original has to stay readable at a glance, not be
                hidden behind an expand. */}
            {/* One line when shut. A three-line English headline under a
                three-line Korean one doubles the row for a reference most
                readers only glance at; opening the article restores it. */}
            {translated && (
              <p
                className={`mt-0.5 text-[12.5px] leading-snug text-muted ${
                  open ? "" : "line-clamp-1"
                }`}
              >
                {row.title}
              </p>
            )}
          </div>

          {expandable && (
            <Chevron
              className={`mt-1.5 ml-auto shrink-0 text-faint transition-transform duration-150 group-hover:text-muted ${
                open ? "rotate-90" : ""
              }`}
            />
          )}
        </div>

        {/* Under the headline, with names. Squeezing them onto the metadata
            line as bare 14px icons saved a row and cost the one thing they are
            for — most crests are dark navy or maroon and simply disappeared
            against a near-black page at that size. */}
        {rowTeams.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {rowTeams.slice(0, 4).map((t) => (
              <span
                key={t.slug}
                className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-[2px] pr-2 pl-[2px] text-[10.5px] text-muted"
              >
                <span className="flex size-[16px] items-center justify-center rounded-full bg-surface-3">
                  <TeamCrest team={t} size={13} />
                </span>
                {t.ko}
              </span>
            ))}
          </div>
        )}
      </button>

      {open && (
        <div className="pr-[var(--gutter)] pb-4 pl-[calc(var(--gutter)+3px)]">
          {/* Beside the text rather than above it. A full-bleed photo pushed the
              summary — the reason the card opens — below the fold, and stock
              agency shots earn less room than the words do. */}
          <div className="flex flex-col gap-3.5 sm:flex-row">
            {showImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.imageUrl!}
                alt=""
                onError={() => setImageOk(false)}
                className="h-40 w-full shrink-0 rounded-md bg-surface-3 object-cover sm:h-[124px] sm:w-[196px]"
              />
            )}

            {body && (
              <p className="min-w-0 text-[14px] leading-[1.7] text-text/75">
                {body}
              </p>
            )}
          </div>

          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3.5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent underline-offset-4 hover:underline"
          >
            원문 보기
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              aria-hidden
              className="translate-y-px"
            >
              <path
                d="M3 9L9 3M9 3H4.5M9 3v4.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </div>
      )}
    </article>
  );
}
