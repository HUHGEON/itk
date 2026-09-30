"use client";

import { useState } from "react";
import type { FeedRow } from "@/lib/feed";
import { splitLeadingEmoji, thumb, tierLabel, tierStyle, timeAgo } from "@/lib/format";

/**
 * The top of the feed, as FotMob opens its news page: one story large on the
 * left, and a numbered run of the next ones on the right, each with its
 * picture.
 *
 * The list underneath is in time order, which is right for reading everything
 * but says nothing about what matters today. This says it the way the site
 * measures it: the most trusted reporters' stories of the last day, trust
 * first and time second. A story opens at its source, since the row for it is
 * a click away further down.
 */
export function FeedHero({ lead, rest, now }: { lead: FeedRow; rest: FeedRow[]; now: number }) {
  return (
    <section
      aria-labelledby="feed-hero-title"
      className="grid gap-5 bg-surface p-[var(--gutter)] sm:rounded-2xl sm:p-5 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] md:gap-6"
    >
      <Lead row={lead} now={now} />

      <div className="min-w-0">
        <h2 id="feed-hero-title" className="text-[15px] font-bold text-text">
          지금 주목할 소식
        </h2>
        <ol className="mt-1.5">
          {rest.map((row, i) => (
            <li key={row.id} className="border-b border-border last:border-b-0">
              <Item row={row} n={i + 1} now={now} />
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function useImage(url: string | null, w: number, h: number) {
  // 0: resized copy, 1: the original, 2: give up.
  const [step, setStep] = useState(0);
  if (!url || step > 1) return { src: null, onError: undefined };
  return { src: step === 0 ? thumb(url, w, h) : url, onError: () => setStep((s) => s + 1) };
}

function Byline({ row, now }: { row: FeedRow; now: number }) {
  const st = tierStyle(row.tier, row.official);
  const who = row.journalistKo ?? row.citedKo ?? row.byline ?? row.source;
  return (
    <p className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
      <span
        className="shrink-0 rounded-[6px] px-1.5 py-[1px] text-[12px] font-semibold"
        style={{ background: st.bg, color: st.ink, boxShadow: `inset 0 0 0 1px ${st.border === "transparent" ? st.bg : st.border}` }}
      >
        {row.official ? "공식" : tierLabel(row.tier)}
      </span>
      <span className="min-w-0 truncate font-semibold text-text/90">{who}</span>
      <span aria-hidden>·</span>
      <time className="tnum shrink-0" dateTime={new Date(row.publishedAt).toISOString()}>
        {timeAgo(row.publishedAt, now)}
      </time>
    </p>
  );
}

function Lead({ row, now }: { row: FeedRow; now: number }) {
  const img = useImage(row.imageUrl, 960, 540);
  const { mark, text } = splitLeadingEmoji(row.titleKo ?? row.title);
  return (
    <a
      href={row.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex min-w-0 flex-col overflow-hidden rounded-[12px] bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      {/* The picture takes whatever height the numbered list beside it sets,
          so the headline sits at the foot of the card instead of over a
          stretch of empty panel. */}
      <div className="relative aspect-[16/9] overflow-hidden bg-surface-3 md:aspect-auto md:min-h-[240px] md:flex-1">
        {img.src && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={img.src}
            onError={img.onError}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
          />
        )}
      </div>
      <div className="flex flex-col gap-3 p-4 sm:p-5">
        <h3 className="text-[20px] leading-[1.4] font-semibold tracking-[-0.01em] text-pretty text-text sm:text-[22px]">
          {mark && <span aria-hidden className="mr-1.5 text-[0.7em] opacity-60">{mark}</span>}
          {text}
        </h3>
        <Byline row={row} now={now} />
      </div>
    </a>
  );
}

function Item({ row, n, now }: { row: FeedRow; n: number; now: number }) {
  const img = useImage(row.imageUrl, 224, 176);
  const { mark, text } = splitLeadingEmoji(row.titleKo ?? row.title);
  return (
    <a
      href={row.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 py-3.5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
    >
      <span className="tnum mt-[3px] flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-accent-ink">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[15px] leading-[1.45] font-semibold text-text transition-colors group-hover:text-accent-soft">
          {mark && <span aria-hidden className="mr-1 text-[0.8em] opacity-60">{mark}</span>}
          {text}
        </h3>
        <div className="mt-1.5">
          <Byline row={row} now={now} />
        </div>
      </div>
      {img.src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img.src}
          onError={img.onError}
          alt=""
          loading="lazy"
          className="h-[66px] w-[88px] shrink-0 rounded-[8px] bg-surface-3 object-cover sm:h-[80px] sm:w-[104px]"
        />
      )}
    </a>
  );
}
