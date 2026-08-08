import Link from "next/link";
import type { Pulse } from "@/lib/feed";
import { ALL_TIERS } from "@/lib/types";
import { tierColor, tierLabel, timeAgo } from "@/lib/format";

/**
 * The last 24 hours as one bar.
 *
 * The sidebar ran out of content halfway down the page, and a feed sorted by
 * time tells you what just happened but not what the day looked like. The
 * segments are the tier colours the rest of the app uses, so the shape of the
 * bar reads as "mostly rumour" or "a real 0-tier day" without a legend — and
 * each one is a link into that filter.
 */
export function PulsePanel({ pulse, now }: { pulse: Pulse; now: number }) {
  const tiers = ALL_TIERS.map((t) => ({
    tier: t,
    n: pulse.byTier[String(t)] ?? 0,
  })).filter((s) => s.n > 0);

  const ranked = pulse.total - pulse.official;
  if (ranked === 0) return null;

  return (
    <section className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[13px] font-semibold">최근 24시간</h2>
        <span className="tnum text-[11px] text-faint">{pulse.total}건</span>
      </div>

      <div
        className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-surface-3"
        role="img"
        aria-label={tiers
          .map((s) => `${tierLabel(s.tier)} ${s.n}건`)
          .join(", ")}
      >
        {tiers.map((s) => (
          <span
            key={s.tier}
            style={{
              width: `${(s.n / ranked) * 100}%`,
              backgroundColor: tierColor(s.tier),
            }}
          />
        ))}
      </div>

      <ul className="mt-3 space-y-1.5">
        {tiers.map((s) => (
          <li key={s.tier}>
            <Link
              href={`/?tier=${s.tier}`}
              className="group flex items-center gap-2 text-[12px]"
            >
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: tierColor(s.tier) }}
              />
              <span className="flex-1 text-muted transition-colors group-hover:text-text">
                {tierLabel(s.tier)}
              </span>
              <span className="tnum text-text/80">{s.n}</span>
            </Link>
          </li>
        ))}
        {pulse.official > 0 && (
          <li className="flex items-center gap-2 text-[12px]">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-[2px]"
              style={{ backgroundColor: "var(--official)" }}
            />
            <span className="flex-1 text-muted">구단 공식</span>
            <span className="tnum text-text/80">{pulse.official}</span>
          </li>
        )}
      </ul>

      {pulse.lastCollect && (
        <p className="mt-3 border-t border-border pt-2.5 text-[10.5px] text-faint">
          마지막 수집 {timeAgo(pulse.lastCollect, now)}
        </p>
      )}
    </section>
  );
}
