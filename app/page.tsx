import type { Metadata } from "next";
import Link from "next/link";
import { getPulse } from "@/lib/feed";
import { loadJournalists, loadTeams } from "@/lib/registry";
import { ALL_TIERS } from "@/lib/types";
import { PitchSequence } from "@/components/landing/PitchSequence";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { TierLadder } from "@/components/landing/LandingHero";
import { ScaleStrip } from "@/components/landing/ScaleStrip";
import { WhyAuthor } from "@/components/landing/WhyAuthor";

import { LandingCta } from "@/components/landing/LandingCta";

/**
 * The front door.
 *
 * This used to sit at /about, behind a small link at the bottom of the rail,
 * on the reasoning that a daily reader wants the stories rather than the pitch.
 * That reasoning held right up until it meant almost nobody ever saw it. The
 * feed moved to /feed and this took the root; /about still resolves, as a
 * permanent redirect here, so old links and search results keep working.
 *
 * Every number on this page is read from the registry and the database at
 * request time. Nothing here is a figure typed into the markup.
 */

export const metadata: Metadata = {
  title: "ITK+ 축구 이적 소식",
  description:
    "유럽 주요 구단 이적 소식을 한곳에 모읍니다. 해외 기자 244명의 기사를 20분마다 가져와, 처음 쓴 기자 기준으로 정리해 보여줍니다.",
};

/**
 * Rebuilt on a timer rather than on every request.
 *
 * Measured on production: this page was taking 0.6-1.6s to first byte, because
 * `force-dynamic` meant every visitor waited for a database round trip before
 * a single byte left the server. Nothing on the page is per-visitor and the
 * only figure that moves is the day's article count, so it can be served from
 * the edge and refreshed behind the reader's back. The feed keeps its live
 * rendering - that one really is different every time you open it.
 */
export const revalidate = 300;

export default async function About() {
  const [pulse] = await Promise.all([getPulse()]);
  const journalists = loadJournalists();
  const teams = loadTeams();

  const tiers = ALL_TIERS.map((t) => ({
    tier: t,
    count: journalists.filter((j) => j.tier === t).length,
  })).filter((t) => t.count > 0);

  const outlets = new Set(
    journalists.map((j) => j.outlet).filter((o): o is string => Boolean(o)),
  );
  const countries = new Set(
    journalists.map((j) => j.country).filter((c): c is string => Boolean(c)),
  );

  // The 0-tier names, alphabetical by Korean so the pick is not editorialised.
  const topTier = journalists
    .filter((j) => j.tier === 0 && j.outlet)
    .sort((a, b) => a.ko.localeCompare(b.ko))
    .slice(0, 6)
    .map((j) => ({ ko: j.ko, outlet: j.outlet! }));

  return (
    <div className="relative min-h-screen bg-bg">
      <LandingHeader />

      <main>
        <PitchSequence teams={teams} />

        <TierLadder tiers={tiers} total={journalists.length} />

        <ScaleStrip
          stats={[
            { value: journalists.length, unit: "명", label: "모으는 기자" },
            { value: outlets.size, unit: "곳", label: "매체" },
            { value: countries.size, unit: "개국", label: "나라" },
            { value: pulse.total, unit: "건", label: "오늘 올라온 기사" },
          ]}
        />

        <WhyAuthor names={topTier} />

        <LandingCta todayCount={pulse.total} />
      </main>

      <footer className="border-t border-border px-[var(--gutter)] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-[12px] text-faint">ITK plus</span>
          <Link
            href="/feed"
            className="text-[12px] text-muted transition-colors hover:text-text"
          >
            피드
          </Link>
        </div>
      </footer>
    </div>
  );
}
