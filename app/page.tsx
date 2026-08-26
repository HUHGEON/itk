import {
  getFeed,
  getJournalistActivity,
  getPulse,
  getLeagueActivity,
  getTeamActivity,
} from "@/lib/feed";
import { loadTeams, loadJournalists } from "@/lib/registry";
import type { Team } from "@/lib/types";
import { Filters } from "@/components/Filters";
import { ArticleList } from "@/components/ArticleList";
import { NewArticles } from "@/components/NewArticles";
import { AlertPanel } from "@/components/AlertPanel";
import { Suspense } from "react";
import { Shell } from "@/components/Shell";
import { CollectButton } from "@/components/CollectButton";
import { SearchBox } from "@/components/SearchBox";
import { PulsePanel } from "@/components/PulsePanel";
import { DiscordPanel } from "@/components/DiscordPanel";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function csv(v: string | string[] | undefined): string[] {
  if (!v) return [];
  const s = Array.isArray(v) ? v.join(",") : v;
  return s.split(",").filter(Boolean);
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;

  const tiers = csv(sp.tier)
    .map(Number)
    .filter((n) => !Number.isNaN(n));
  const teamSlugs = csv(sp.team);
  const league = typeof sp.league === "string" ? sp.league : undefined;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const who = typeof sp.who === "string" ? sp.who : undefined;
  // The feed is only what we can attribute to a ranked reporter — outlet churn
  // with no recognised byline was four in five articles and buried everything
  // the tier ranking exists to surface. `?feed=all` is the escape hatch.
  const tieredOnly = sp.feed !== "all";

  const base = { tiers, teams: teamSlugs, league, q, journalistId: who };

  // The filter bar renders on the server from this, so it is present in the
  // first byte instead of arriving as a streamed swap.
  const filterState = {
    tiers: csv(sp.tier),
    teams: teamSlugs,
    league: league ?? "",
    who: who ?? "",
    q: q ?? "",
  };

  // Matches ArticleList's page size so the first "load more" lines up.
  const PAGE_SIZE = 40;

  const [rows, activity, leagueActivity, journalistActivity, pulse] =
    await Promise.all([
      getFeed({ ...base, tieredOnly, limit: PAGE_SIZE }),
      // Counts describe the combination on screen, so each excludes its own
      // dimension: team badges ignore the team filter, league badges ignore
      // the league filter, journalist badges ignore the journalist filter.
      getTeamActivity({ ...base, tieredOnly }),
      getLeagueActivity({
        tiers,
        teams: teamSlugs,
        journalistId: who,
        q,
        tieredOnly,
      }),
      getJournalistActivity({ teams: teamSlugs, league, q }),
      getPulse(),
    ]);

  const teams = loadTeams();
  const teamMap = new Map<string, Team>(teams.map((t) => [t.slug, t]));
  const journalists = loadJournalists();
  const now = Date.now();

  // Handed to the client so paging keeps whatever filters are on screen.
  const feedQuery = new URLSearchParams(
    Object.entries({
      tier: tiers.join(","),
      team: teamSlugs.join(","),
      league: league ?? "",
      q: q ?? "",
      who: who ?? "",
      feed: tieredOnly ? "" : "all",
    }).filter(([, v]) => v !== ""),
  ).toString();

  return (
    <Suspense fallback={null}>
      <Shell
        rail={
          <>
            <PulsePanel pulse={pulse} now={now} />
            <DiscordPanel teams={teams} />
            <AlertPanel teams={teams} />
          </>
        }
        actions={
          <>
            <SearchBox state={filterState} />
            <CollectButton lastCollect={pulse.lastCollect} />
          </>
        }
      >
        <Filters
          teams={teams}
          activity={activity}
          leagueActivity={leagueActivity}
          journalists={journalists}
          journalistActivity={journalistActivity}
          state={filterState}
        />

        <NewArticles query={feedQuery} since={now} />

        {rows.length === 0 ? (
          <EmptyState
            tieredOnly={tieredOnly}
            hasJournalists={journalists.length > 0}
          />
        ) : (
          <ArticleList
            initialRows={rows}
            teams={teamMap}
            now={now}
            query={feedQuery}
          />
        )}
      </Shell>
    </Suspense>
  );
}

function EmptyState({
  tieredOnly,
  hasJournalists,
}: {
  tieredOnly: boolean;
  hasJournalists: boolean;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-[15px] font-semibold">조건에 맞는 기사가 없습니다</p>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">
        {!hasJournalists ? (
          <>
            기자 명단이 비어 있습니다.{" "}
            <code className="rounded bg-surface-3 px-1.5 py-0.5">
              npm run seed
            </code>{" "}
            를 먼저 실행하세요.
          </>
        ) : (
          <>
            기본 화면은 기자가 확인된 기사만 보여줍니다.
            <br />
            신뢰도·구단 필터를 풀거나 검색어를 바꿔보세요.
          </>
        )}
      </p>
    </div>
  );
}
