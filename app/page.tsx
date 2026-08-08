import Link from "next/link";
import {
  getFeed,
  getJournalistActivity,
  getPulse,
  getTeamActivity,
} from "@/lib/feed";
import { loadTeams, loadJournalists } from "@/lib/registry";
import type { Team } from "@/lib/types";
import { Filters } from "@/components/Filters";
import { ArticleList } from "@/components/ArticleList";
import { AlertPanel } from "@/components/AlertPanel";
import { CollectButton } from "@/components/CollectButton";
import { SearchBox } from "@/components/SearchBox";
import { Logo } from "@/components/Logo";
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

  const [rows, activity, journalistActivity, pulse] = await Promise.all([
    getFeed({ ...base, tieredOnly, limit: PAGE_SIZE }),
    // Counts describe the combination on screen, so each excludes its own
    // dimension: team badges ignore the team filter, journalist badges ignore
    // the journalist filter.
    getTeamActivity({ ...base, tieredOnly }),
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
    <div className="flex min-h-screen flex-col bg-bg lg:block">
      {/*
        An app shell, not a page with a sidebar bolted on. The rail owns the
        left edge and carries the logo at its head, so the mark lines up with
        the column it belongs to instead of floating over the feed. Search and
        collect sit in the content header, above what they act on.

        Widths come from --rail and --gutter, both clamped: the proportion
        holds as the window changes, but the rail never eats a laptop screen
        and the gutter never collapses on a phone.
      */}
      <aside className="order-last w-full shrink-0 lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:order-none lg:w-[var(--rail)] lg:overflow-y-auto lg:border-r lg:border-border lg:bg-surface no-scrollbar">
        <div className="hidden h-[var(--headerh)] shrink-0 items-center border-b border-border px-[var(--gutter)] lg:flex">
          <Link
            href="/"
            aria-label="ITK plus 홈 · 필터 초기화"
            title="필터 초기화"
            className="-m-1.5 rounded-md p-1.5 transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
          >
            <Logo height={34} />
          </Link>
        </div>

        <div className="space-y-4 px-[var(--gutter)] pt-5 pb-8 lg:py-5">
          <PulsePanel pulse={pulse} now={now} />
          <DiscordPanel teams={teams} />
          <AlertPanel teams={teams} />
        </div>
      </aside>

      <div className="lg:pl-[var(--rail)]">
        <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur-sm">
          <div className="flex h-[var(--headerh)] items-center gap-3 px-[var(--gutter)]">
            {/* On a phone there is no rail, so the mark rides the header. */}
            <Link
              href="/"
              aria-label="ITK plus 홈 · 필터 초기화"
              title="필터 초기화"
              className="-m-1.5 shrink-0 rounded-md p-1.5 transition-opacity hover:opacity-85 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none lg:hidden"
            >
              <Logo height={30} />
            </Link>

            <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2.5">
              <SearchBox state={filterState} />
              <CollectButton lastCollect={pulse.lastCollect} />
            </div>
          </div>
          <div
            aria-hidden
            className="h-[2px] w-full"
            style={{ background: "var(--ribbon)" }}
          />
        </header>

        <main className="px-0 py-0 sm:px-[var(--gutter)] sm:py-[var(--gutter)]">
          <div className="mx-auto max-w-3xl overflow-hidden sm:rounded-xl sm:border sm:border-border sm:bg-surface">
            <Filters
              teams={teams}
              activity={activity}
              journalists={journalists}
              journalistActivity={journalistActivity}
              state={filterState}
            />

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
          </div>
        </main>
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
