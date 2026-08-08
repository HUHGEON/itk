import Link from "next/link";
import { Suspense } from "react";
import { getFeed, getTeamActivity, getJournalistActivity } from "@/lib/feed";
import { loadTeams, loadJournalists } from "@/lib/registry";
import type { Team } from "@/lib/types";
import { Filters } from "@/components/Filters";
import { ArticleList } from "@/components/ArticleList";
import { AlertPanel } from "@/components/AlertPanel";
import { CollectButton } from "@/components/CollectButton";
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

  // Matches ArticleList's page size so the first "load more" lines up.
  const PAGE_SIZE = 40;

  const [rows, activity, journalistActivity] = await Promise.all([
    getFeed({ ...base, tieredOnly, limit: PAGE_SIZE }),
    // Counts describe the combination on screen, so each excludes its own
    // dimension: team badges ignore the team filter, journalist badges ignore
    // the journalist filter.
    getTeamActivity({ ...base, tieredOnly }),
    getJournalistActivity({ teams: teamSlugs, league, q }),
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
    <div className="min-h-screen bg-bg">
      {/* Opaque, not translucent: a backdrop-blur header let article text
            bleed through it while scrolling. */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg">
        <div className="mx-auto flex max-w-5xl items-center gap-2.5 px-4 py-2.5">
          {/* ITK — In The Know, transfer-market slang for someone with real
                sources, which is what the tier list ranks. Doubles as the way
                back to an unfiltered feed. */}
          <Link
            href="/"
            title="필터 초기화"
            className="flex shrink-0 items-center rounded bg-accent px-1.5 py-0.5 text-[13px] font-black tracking-tight text-black transition-opacity hover:opacity-80"
          >
            ITK+
          </Link>
          <span className="hidden text-[12px] text-muted sm:inline">
            In The Know
          </span>

          <div className="ml-auto flex items-center gap-2">
            <CollectButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl gap-4 lg:flex lg:px-4 lg:py-4">
        <main className="min-w-0 flex-1 overflow-hidden lg:rounded-xl lg:border lg:border-border lg:bg-surface">
          <Suspense
            fallback={<div className="p-4 text-muted">필터 불러오는 중…</div>}
          >
            <Filters
              teams={teams}
              activity={activity}
              journalists={journalists}
              journalistActivity={journalistActivity}
            />
          </Suspense>

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
        </main>

        <aside className="w-full shrink-0 space-y-4 px-4 pb-6 lg:w-64 lg:px-0">
          <DiscordPanel teams={teams} />
          <AlertPanel teams={teams} />
        </aside>
      </div>
    </div>
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
