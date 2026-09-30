import Link from "next/link";
import type { Team } from "@/lib/types";
import { LEAGUE_LABEL, type League } from "@/lib/types";
import { tierColor, tierLabel } from "@/lib/format";
import { TeamCrest } from "./TeamCrest";

type Activity = Record<string, { count: number; bestTier: number | null }>;

/**
 * The clubs the last day's stories are about, most first - the "trending"
 * box of X and Digg, one compact line each.
 *
 * It replaced a five-reporter leaderboard that stood 500px tall and pushed the
 * widget column past the bottom of a laptop screen, so the column scrolled on
 * its own. Five single-line rows fit, and "who is being talked about" is the
 * question a transfer page is opened to answer.
 */
export function TrendingClubs({ teams, activity }: { teams: Team[]; activity: Activity }) {
  const top = teams
    .map((t) => ({ t, a: activity[t.slug] }))
    .filter((x): x is { t: Team; a: { count: number; bestTier: number | null } } => Boolean(x.a && x.a.count > 0))
    .sort((a, b) => b.a.count - a.a.count)
    .slice(0, 5);
  if (top.length === 0) return null;

  return (
    <section aria-labelledby="trending-clubs" className="p-5">
      <h2 id="trending-clubs" className="flex items-center gap-2 text-[15px] font-bold text-text">
        <span aria-hidden className="h-[15px] w-[3px] rounded-full" style={{ background: "var(--ribbon)" }} />
        지금 뜨는 구단
      </h2>
      <ol className="mt-2">
        {top.map(({ t, a }, i) => (
          <li key={t.slug}>
            <Link
              href={`/feed?team=${t.slug}`}
              className="group -mx-2 flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.04]"
            >
              <span className={`tnum w-3 shrink-0 text-center text-[13px] font-bold ${i === 0 ? "text-accent" : "text-faint"}`}>
                {i + 1}
              </span>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06]">
                <TeamCrest team={t} size={20} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] leading-tight font-semibold text-text group-hover:text-accent-soft">
                  {t.ko}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[12px] text-faint">
                  {LEAGUE_LABEL[t.league as League]}
                  {a.bestTier !== null && (
                    <>
                      <span aria-hidden>·</span>
                      <span className="size-1.5 rounded-full" style={{ background: tierColor(a.bestTier) }} />
                      최고 {tierLabel(a.bestTier)}
                    </>
                  )}
                </span>
              </span>
              <span className="tnum shrink-0 text-[14px] font-bold text-text">
                {a.count}
                <span className="ml-0.5 text-[11.5px] font-medium text-faint">건</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
