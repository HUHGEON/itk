import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { matchesForTeam, type Match } from "@/lib/matches";
import { loadTeams } from "@/lib/registry";
import { MatchRail } from "@/components/matches/MatchRail";
import { TeamSeason } from "@/components/matches/TeamSeason";
import { TeamCrest } from "@/components/TeamCrest";
import { Shell } from "@/components/Shell";
import { SearchBox } from "@/components/SearchBox";
import { CollectButton } from "@/components/CollectButton";

/**
 * One club's season, in both directions.
 *
 * Results above, fixtures below, with the join between them at the top of the
 * screen - that join is what someone actually comes here for, whether they
 * arrive wanting "how did we do" or "when are we next on".
 */
/**
 * Rendered on request and then cached, rather than prerendered at build.
 *
 * The shell reads search params for the filter state it shares with the feed,
 * which a build-time prerender cannot resolve. Caching the result gets the same
 * speed without the build-time bailout.
 */
export const revalidate = 120;

type Params = Promise<{ slug: string }>;

function club(slug: string) {
  return loadTeams().find((t) => t.slug === slug);
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const t = club(slug);
  if (!t) return {};
  return {
    title: `${t.ko} 경기 일정 · ITK+`,
    description: `${t.ko}의 지난 경기 결과와 다가오는 일정. 리그, 컵, 유럽 대항전을 한곳에서.`,
  };
}

export default async function Team({ params }: { params: Params }) {
  const { slug } = await params;
  const t = club(slug);
  if (!t) notFound();

  const all = await matchesForTeam(slug);
  const now = Date.now();
  const played = all.filter((m) => m.state === "post");
  const upcoming = all.filter((m) => m.state !== "post" && m.kickoff >= now - 3 * 3600_000);
  const live = all.filter((m) => m.state === "in");

  return (
    <Shell
      rail={<MatchRail active={slug} />}
      actions={
        <>
          <Suspense fallback={null}>
            <SearchBox
              state={{ tiers: [], teams: [], league: "", who: "", q: "" }}
            />
          </Suspense>
          <CollectButton lastCollect={null} />
        </>
      }
    >
      <header className="flex items-center gap-3 border-b border-border px-[var(--gutter)] py-5">
        <TeamCrest team={t} size={36} />
        <div className="min-w-0">
          <h1 className="truncate text-[20px] font-bold tracking-tight text-text">
            {t.ko}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            <Record played={played} slug={slug} /> ·{" "}
            <Link
              href={`/feed?team=${t.slug}`}
              className="underline-offset-4 hover:text-text hover:underline"
            >
              이적 소식 보기
            </Link>
          </p>
        </div>
      </header>

      <TeamSeason slug={slug} played={played} upcoming={upcoming} live={live} />
    </Shell>
  );
}

/**
 * Win-draw-loss over the matches in the window.
 *
 * Which side is "us" has to come from the slug, not from whichever side happens
 * to be a tracked club: in a Manchester City against Arsenal both are tracked,
 * and picking the home side made a 0-3 defeat read as a win. Measured on this
 * page before the fix: three wins claimed against a visible W-W-L.
 */
function Record({ played, slug }: { played: Match[]; slug: string }) {
  if (played.length === 0) return <span>최근 경기 없음</span>;
  let w = 0;
  let d = 0;
  let l = 0;
  for (const m of played) {
    const home = m.home.slug === slug;
    const us = home ? m.home : m.away;
    const them = home ? m.away : m.home;
    const a = us.score ?? 0;
    const b = them.score ?? 0;
    if (a > b) w++;
    else if (a === b) d++;
    else l++;
  }
  return (
    <span className="tnum">
      최근 {played.length}경기 {w}승 {d}무 {l}패
    </span>
  );
}
