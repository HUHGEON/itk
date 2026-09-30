"use client";

import { useState } from "react";
import type { FeedRow } from "@/lib/feed";
import { splitLeadingEmoji, thumb, tierLabel, tierStyle, timeAgo } from "@/lib/format";

/**
 * The top of the feed: the day's lead story as a large picture card with the
 * headline laid over it, and the next four as a pair of rows of small cards
 * under it - the shape a sports dashboard gives its featured match.
 *
 * The list underneath is in time order, which is right for reading everything
 * but says nothing about what matters today. This says it the way the site
 * measures it: the most trusted reporters' stories of the last day, trust
 * first and time second. A story opens at its source, since the row for it is
 * a click away further down.
 */
export function FeedHero({ lead, rest, now }: { lead: FeedRow; rest: FeedRow[]; now: number }) {
  return (
    <section aria-label="지금 주목할 소식" className="grid gap-3">
      <Lead row={lead} now={now} />
      <ol className="grid gap-3 sm:grid-cols-2">
        {rest.map((row, i) => (
          <li key={row.id} className="min-w-0">
            <Item row={row} n={i + 2} now={now} />
          </li>
        ))}
      </ol>
    </section>
  );
}

function useImage(url: string | null, w: number, h: number) {
  // 0: resized copy, 1: the original, 2: give up.
  const [step, setStep] = useState(0);
  if (!url || step > 1) return { src: null, onError: undefined };
  return { src: step === 0 ? thumb(url, w, h) : url, onError: () => setStep((s) => s + 1) };
}

function Byline({ row, now, onImage = false }: { row: FeedRow; now: number; onImage?: boolean }) {
  const st = tierStyle(row.tier, row.official);
  const who = row.journalistKo ?? row.citedKo ?? row.byline ?? row.source;
  return (
    <p className={`flex min-w-0 items-center gap-1.5 text-[13px] ${onImage ? "text-white/75" : "text-muted"}`}>
      <span
        className="shrink-0 rounded-[6px] px-1.5 py-[1px] text-[12px] font-semibold"
        style={{ background: st.bg, color: st.ink, boxShadow: `inset 0 0 0 1px ${st.border === "transparent" ? st.bg : st.border}` }}
      >
        {row.official ? "공식" : tierLabel(row.tier)}
      </span>
      <span className={`min-w-0 truncate font-semibold ${onImage ? "text-white" : "text-text/90"}`}>{who}</span>
      <span aria-hidden>·</span>
      <time className="tnum shrink-0" dateTime={new Date(row.publishedAt).toISOString()}>
        {timeAgo(row.publishedAt, now)}
      </time>
    </p>
  );
}

function Lead({ row, now }: { row: FeedRow; now: number }) {
  const img = useImage(row.imageUrl, 1200, 675);
  const { mark, text } = splitLeadingEmoji(row.titleKo ?? row.title);
  return (
    <a
      href={row.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative isolate flex min-h-[300px] flex-col justify-end overflow-hidden bg-surface-2 p-5 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none sm:min-h-[360px] rounded-[20px] sm:p-7"
    >
      {img.src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={img.src}
          onError={img.onError}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03]"
        />
      )}
      {/* Dark enough under the words to read them on any photograph, clear
          enough at the top to see the photograph. */}
      <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/90 via-black/45 to-black/5" />

      <span className="absolute top-5 left-5 inline-flex items-center gap-2 rounded-full bg-black/45 px-3 py-1.5 text-[12.5px] font-semibold text-white backdrop-blur-md sm:top-6 sm:left-7">
        <span className="size-1.5 rounded-full bg-accent shadow-[0_0_0_3px_rgba(241,128,11,0.25)]" />
        지금 주목할 소식
      </span>

      <h3 className="max-w-[34ch] text-[22px] leading-[1.35] font-bold tracking-[-0.015em] text-pretty text-white sm:text-[28px]">
        {mark && <span aria-hidden className="mr-2 text-[0.7em] opacity-70">{mark}</span>}
        {text}
      </h3>
      <div className="mt-3">
        <Byline row={row} now={now} onImage />
      </div>
    </a>
  );
}

function Item({ row, n, now }: { row: FeedRow; n: number; now: number }) {
  const img = useImage(row.imageUrl, 176, 176);
  const { mark, text } = splitLeadingEmoji(row.titleKo ?? row.title);
  return (
    <a
      href={row.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex h-full items-center gap-3.5 bg-surface p-3 transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none rounded-[20px]"
    >
      <span className="relative shrink-0">
        {img.src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img.src} onError={img.onError} alt="" loading="lazy" className="size-[72px] rounded-[14px] bg-surface-3 object-cover" />
        ) : (
          <span className="block size-[72px] rounded-[14px] bg-surface-3" />
        )}
        <span className="tnum absolute -top-1.5 -left-1.5 flex size-6 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-accent-ink ring-[3px] ring-surface transition-[--tw-ring-color] group-hover:ring-surface-2">
          {n}
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="line-clamp-2 text-[14.5px] leading-[1.45] font-semibold text-text transition-colors group-hover:text-accent-soft">
          {mark && <span aria-hidden className="mr-1 text-[0.8em] opacity-60">{mark}</span>}
          {text}
        </h3>
        <div className="mt-1.5">
          <Byline row={row} now={now} />
        </div>
      </div>
    </a>
  );
}
