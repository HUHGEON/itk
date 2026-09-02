import type { Metadata } from "next";
import Link from "next/link";
import { getPulse } from "@/lib/feed";
import { loadJournalists, loadTeams } from "@/lib/registry";
import { ALL_TIERS } from "@/lib/types";
import { Logo } from "@/components/Logo";
import { LandingHero } from "@/components/landing/LandingHero";
import { ScaleStrip } from "@/components/landing/ScaleStrip";
import { WhyAuthor } from "@/components/landing/WhyAuthor";
import { ClubGrid } from "@/components/landing/ClubGrid";
import { LandingCta } from "@/components/landing/LandingCta";

/**
 * The page that explains what the feed is.
 *
 * It lives at /about rather than at / on purpose: people who use this site read
 * it daily, and putting an introduction in front of the feed would cost them a
 * click every time to see something they already understand. The existing route
 * keeps its URL, its bookmarks and its search traffic.
 *
 * Every number on this page is read from the registry and the database at
 * request time. Nothing here is a figure typed into the markup.
 */

export const metadata: Metadata = {
  title: "ITK+ 소개",
  description:
    "해외 축구 기자 244명을 신뢰도 티어로 나눠, 이적설을 최초 보도자 기준으로 모읍니다.",
};

export const dynamic = "force-dynamic";

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
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-[var(--gutter)]">
          <Link href="/about" aria-label="ITK plus 소개" className="shrink-0">
            <Logo height={26} />
          </Link>
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
          >
            오늘의 이적 소식
          </Link>
        </div>
      </header>

      <main>
        <LandingHero tiers={tiers} total={journalists.length} />

        <ScaleStrip
          stats={[
            { value: journalists.length, unit: "명", label: "추적 중인 기자" },
            { value: outlets.size, unit: "곳", label: "소속 매체" },
            { value: countries.size, unit: "개국", label: "취재 국가" },
            { value: pulse.total, unit: "건", label: "최근 24시간 기사" },
          ]}
        />

        <ClubGrid teams={teams} />

        <WhyAuthor names={topTier} />

        <LandingCta todayCount={pulse.total} />
      </main>

      <footer className="border-t border-border px-[var(--gutter)] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2">
          <span className="text-[12px] text-faint">ITK plus</span>
          <Link
            href="/"
            className="text-[12px] text-muted transition-colors hover:text-text"
          >
            피드
          </Link>
        </div>
      </footer>
    </div>
  );
}
