"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Pulse } from "@/lib/feed";
import { ALL_TIERS } from "@/lib/types";
import { tierColor, tierLabel, timeAgo } from "@/lib/format";
import { reducedMotion } from "@/lib/motion";

/**
 * The last 24 hours as a ring: how the day's stories split across the tiers.
 *
 * It was a 6px stacked bar; a ring reads as "shares of one day" at a glance
 * and has room in the middle for the total. The tier colours are the ones the
 * whole site uses - a ladder that fades from the 0-tier orange to grey - so 2
 * and 3 are close greys by design (measured: ΔE 9.5, under the 15 a colour
 * alone needs). Identity therefore never rests on colour: every segment is
 * separated by a gap, the legend names each tier with its count and share,
 * and pointing at either lights the one segment and puts its numbers in the
 * middle.
 */

const R = 46;
const STROKE = 14;
const C = 2 * Math.PI * R;
/** the surface gap between segments, in px of arc */
const GAP = 3;

export function PulsePanel({ pulse, now }: { pulse: Pulse; now: number }) {
  const router = useRouter();
  const tiers = ALL_TIERS.map((t) => ({ tier: t, n: pulse.byTier[String(t)] ?? 0 })).filter((s) => s.n > 0);
  const ranked = pulse.total - pulse.official;
  const [lit, setLit] = useState<number | null>(null);
  // The ring draws itself once, from nothing, on first paint.
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    if (reducedMotion()) return setDrawn(true);
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (ranked === 0) return null;

  let start = 0;
  const segs = tiers.map((s) => {
    const len = (s.n / ranked) * C;
    const seg = { ...s, start, len: Math.max(0.5, len - (tiers.length > 1 ? GAP : 0)) };
    start += len;
    return seg;
  });
  const focus = lit === null ? null : segs[lit];
  const pct = (n: number) => Math.round((n / ranked) * 100);

  return (
    <section className="p-5" onMouseLeave={() => setLit(null)}>
      <div className="flex items-baseline justify-between">
        <h2 className="flex items-center gap-2 text-[15px] font-bold">
          <span aria-hidden className="h-[15px] w-[3px] rounded-full" style={{ background: "var(--ribbon)" }} />
          최근 24시간
        </h2>
        <span className="tnum text-[12.5px] text-faint">{pulse.total}건</span>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative size-[124px] shrink-0">
          <svg
            viewBox="0 0 124 124"
            className="size-full -rotate-90"
            role="img"
            aria-label={segs.map((s) => `${tierLabel(s.tier)} ${s.n}건`).join(", ")}
          >
            <circle cx="62" cy="62" r={R} fill="none" stroke="var(--surface-3)" strokeWidth={STROKE} opacity={0.5} />
            {segs.map((s, i) => (
              <circle
                key={s.tier}
                cx="62"
                cy="62"
                r={R}
                fill="none"
                stroke={tierColor(s.tier)}
                strokeWidth={lit === i ? STROKE + 4 : STROKE}
                strokeDasharray={`${drawn ? s.len : 0} ${C}`}
                strokeDashoffset={-s.start}
                opacity={lit === null || lit === i ? 1 : 0.22}
                className="cursor-pointer"
                style={{
                  transition: `stroke-dasharray 800ms cubic-bezier(0.22,1,0.36,1) ${i * 70}ms, opacity 200ms, stroke-width 200ms`,
                }}
                onMouseEnter={() => setLit(i)}
                onClick={() => router.push(`/feed?tier=${s.tier}`)}
              />
            ))}
          </svg>
          {/* The middle says the total, or the pointed-at tier. */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="tnum text-[24px] leading-none font-bold text-text">{focus ? focus.n : ranked}</span>
            <span className="mt-1 text-[11.5px] text-muted">
              {focus ? `${tierLabel(focus.tier)} · ${pct(focus.n)}%` : "티어 기사"}
            </span>
          </div>
        </div>

        <ul className="min-w-0 flex-1 space-y-0.5">
          {segs.map((s, i) => (
            <li key={s.tier}>
              <Link
                href={`/feed?tier=${s.tier}`}
                onMouseEnter={() => setLit(i)}
                onFocus={() => setLit(i)}
                onBlur={() => setLit(null)}
                className={`flex items-center gap-2 rounded-lg px-1.5 py-1 text-[13px] transition-colors ${
                  lit === i ? "bg-white/[0.05]" : ""
                }`}
              >
                <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tierColor(s.tier) }} />
                <span className={`flex-1 ${lit === i ? "text-text" : "text-muted"}`}>{tierLabel(s.tier)}</span>
                <span className="tnum font-semibold text-text">{s.n}</span>
                <span className="tnum w-8 text-right text-[12px] text-faint">{pct(s.n)}%</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {(pulse.official > 0 || pulse.lastCollect) && (
        <p className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[12.5px] text-faint">
          {pulse.official > 0 && (
            <>
              <span aria-hidden className="size-2 rounded-full" style={{ backgroundColor: "var(--official)" }} />
              구단 공식 {pulse.official}건
            </>
          )}
          {pulse.lastCollect && <span className="ml-auto">마지막 수집 {timeAgo(pulse.lastCollect, now)}</span>}
        </p>
      )}
    </section>
  );
}
