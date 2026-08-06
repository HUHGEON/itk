"use client";

import { useState } from "react";
import type { FeedRow } from "@/lib/feed";
import type { Team } from "@/lib/types";
import { tierColor, tierLabel, timeAgo } from "@/lib/format";
import { TeamCrest } from "./TeamCrest";
import { useKorean } from "./TranslationProvider";

/**
 * One story, read in place.
 *
 * Collapsed rows render **no** `<img>` at all — with 80 cards on screen,
 * mounting every article image at once stalled the page. The image only enters
 * the DOM (and downloads) when the card opens, and is height-capped there: a
 * full-bleed photo pushed everything else off screen.
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

  const accent = tierColor(row.tier);
  const rowTeams = row.teams.map((s) => teams.get(s)).filter((t): t is Team => Boolean(t));
  const rawBody = row.summaryKo ?? row.snippet;
  const title = useKorean(row.title, row.titleKo);
  const body = useKorean(rawBody, row.summaryKo);
  const translated = title !== row.title;
  const showImage = Boolean(row.imageUrl) && imageOk;
  const expandable = Boolean(rawBody) || showImage;

  // Byline first; failing that, the reporter an outlet credited.
  const byline = row.journalistKo ?? row.citedKo;

  return (
    <article className="relative border-b border-border last:border-b-0">
      <span
        aria-hidden
        className="absolute top-0 bottom-0 left-0 w-1"
        style={{ backgroundColor: accent }}
      />

      <div className="pl-3">
        <button
          type="button"
          onClick={() => expandable && setOpen((v) => !v)}
          aria-expanded={expandable ? open : undefined}
          className={`block w-full px-3 py-2.5 text-left ${
            expandable ? "cursor-pointer hover:bg-surface-2" : "cursor-default"
          }`}
        >
          {/* Who said it, and how much that's worth — the whole premise of the
              app, so it leads the card rather than sitting in fine print. */}
          <div className="flex items-baseline gap-2">
            {/* Tier is a property of a reporter, so a club's own announcement
                gets its own label rather than borrowing "0티어". */}
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-black tracking-tight"
              style={{ color: "#0e0f12", backgroundColor: accent }}
            >
              {row.official ? "공식" : tierLabel(row.tier)}
            </span>

            {row.official ? (
              <span className="min-w-0 truncate text-[13px] font-bold text-text">
                {row.source}
              </span>
            ) : byline ? (
              <span className="min-w-0 truncate text-[13px] font-bold text-text">
                {byline}
                {!row.journalistKo && (
                  <span className="ml-1 text-[11px] font-normal text-muted">인용</span>
                )}
              </span>
            ) : (
              <span className="text-[13px] text-muted">기자 미확인</span>
            )}

            <time
              className="ml-auto shrink-0 text-[11px] text-muted tabular-nums"
              dateTime={new Date(row.publishedAt).toISOString()}
            >
              {timeAgo(row.publishedAt, now)}
            </time>
          </div>

          {!row.official && (
            <div className="mt-0.5 truncate text-[11px] text-muted">
              {row.outlet && row.outlet !== row.source ? `${row.outlet} · ` : ""}
              {row.source}
            </div>
          )}

          <div className="mt-1 flex items-start gap-2">
            <h3 className="min-w-0 flex-1 text-[15px] leading-snug font-semibold text-text">
              {title}
            </h3>
            {expandable && (
              <span
                aria-hidden
                className={`mt-1 shrink-0 text-[9px] text-muted transition-transform ${
                  open ? "rotate-90" : ""
                }`}
              >
                ▶
              </span>
            )}
          </div>

          {rowTeams.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              {rowTeams.slice(0, 4).map((t) => (
                <span
                  key={t.slug}
                  className="inline-flex items-center gap-1 rounded bg-surface-3 py-px pr-1.5 pl-1 text-[10px] text-muted"
                >
                  <TeamCrest team={t} size={12} />
                  {t.ko}
                </span>
              ))}
            </div>
          )}
        </button>

        {open && (
          <div className="px-3 pb-3">
            {showImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.imageUrl!}
                alt=""
                onError={() => setImageOk(false)}
                className="mb-2.5 h-44 w-full rounded-lg bg-surface-3 object-cover sm:h-56"
              />
            )}

            {body && <p className="text-[13px] leading-relaxed text-text/80">{body}</p>}

            {/* Original headline, kept out of the collapsed row where it only
                doubled the noise. */}
            {translated && (
              <p className="mt-2 border-l-2 border-border pl-2 text-[11px] leading-snug text-muted">
                {row.title}
              </p>
            )}

            <a
              href={row.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2.5 inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-[12px] font-medium text-accent hover:bg-surface-2"
            >
              원문 보기 ↗
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
