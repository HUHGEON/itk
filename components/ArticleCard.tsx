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

  return (
    <article className="group relative">
      {/* Presence, not decoration: the bar is only as strong as the tier. */}
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ backgroundColor: tierRule(row.tier, row.official) }}
      />

      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        aria-expanded={expandable ? open : undefined}
        className={`block w-full px-4 py-3.5 pl-5 text-left transition-colors sm:px-5 sm:pl-6 ${
          expandable ? "cursor-pointer hover:bg-surface-2/60" : "cursor-default"
        }`}
      >
        {/* Provenance line — small, single row, never wraps into the headline */}
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className="shrink-0 rounded-[3px] border px-1.5 py-[2px] text-[10px] font-semibold tracking-tight"
            style={{
              backgroundColor: tier.bg,
              borderColor: tier.border,
              color: tier.ink,
            }}
          >
            {row.official ? "공식" : tierLabel(row.tier)}
          </span>

          {byline || row.official ? (
            <span className="min-w-0 truncate font-medium text-text/90">
              {row.official ? row.source : byline}
              {!row.official && !row.journalistKo && (
                <span className="ml-1 font-normal text-faint">인용</span>
              )}
            </span>
          ) : (
            <span className="text-faint">기자 미확인</span>
          )}

          {!row.official && outlet && (
            <>
              <span aria-hidden className="text-faint">
                ·
              </span>
              <span className="hidden min-w-0 truncate text-muted sm:inline">
                {outlet}
              </span>
            </>
          )}

          <time
            className="tnum ml-auto shrink-0 text-faint"
            dateTime={new Date(row.publishedAt).toISOString()}
          >
            {timeAgo(row.publishedAt, now)}
          </time>
        </div>

        <div className="mt-2 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-[16px] leading-[1.45] font-semibold text-text sm:text-[17px]">
              {title}
            </h3>
            {/* The machine translation mangles football phrasing often enough
                that the original has to stay readable at a glance, not be
                hidden behind an expand. */}
            {translated && (
              <p className="mt-1 text-[12.5px] leading-snug text-muted">
                {row.title}
              </p>
            )}
          </div>

          {expandable && (
            <Chevron
              className={`mt-1.5 shrink-0 text-faint transition-transform duration-150 group-hover:text-muted ${
                open ? "rotate-90" : ""
              }`}
            />
          )}
        </div>

        {rowTeams.length > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {rowTeams.slice(0, 4).map((t) => (
              <span
                key={t.slug}
                className="inline-flex items-center gap-1.5 text-[11px] text-muted"
              >
                <TeamCrest team={t} size={13} />
                {t.ko}
              </span>
            ))}
          </div>
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 pl-5 sm:px-5 sm:pl-6">
          {showImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={row.imageUrl!}
              alt=""
              onError={() => setImageOk(false)}
              className="mb-3 h-44 w-full rounded-md bg-surface-3 object-cover sm:h-60"
            />
          )}

          {body && (
            <p className="max-w-[68ch] text-[14px] leading-[1.7] text-text/75">
              {body}
            </p>
          )}

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
