import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { COMPETITIONS, tableFor, matchesOn, ymd } from "@/lib/matches";
import { LeagueTable } from "@/components/matches/LeagueTable";
import { MatchRail } from "@/components/matches/MatchRail";
import { MatchBoard } from "@/components/matches/MatchBoard";
import { Shell } from "@/components/Shell";
import { SearchBox } from "@/components/SearchBox";
import { CollectButton } from "@/components/CollectButton";

/**
 * One competition: where everyone stands, and what is on next.
 *
 * The table is the page. Fixtures come underneath rather than on a tab of their
 * own, because "who is top" and "who plays next" are read in the same visit and
 * splitting them would cost a click every time.
 */
/**
 * Rendered on request and then cached, rather than prerendered at build.
 *
 * The shell reads search params for the filter state it shares with the feed,
 * which a build-time prerender cannot resolve. Caching the result gets the same
 * speed without the build-time bailout.
 */
export const revalidate = 300;

type Params = Promise<{ code: string }>;

function meta(code: string) {
  return COMPETITIONS.find((c) => c.code === code);
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { code } = await params;
  const c = meta(code);
  if (!c) return {};
  return {
    title: `${c.ko} 순위 · ITK+`,
    description: `${c.ko} 순위표와 다가오는 경기 일정.`,
  };
}

export default async function League({ params }: { params: Params }) {
  const { code } = await params;
  const c = meta(code);
  if (!c) notFound();

  const today = new Date();
  const [rows, todays] = await Promise.all([
    tableFor(code),
    matchesOn(today),
  ]);
  const mine = todays.filter((m) => m.competition === c.ko);

  return (
    <Shell
      rail={<MatchRail active={code} day={ymd(today)} />}
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
      <header className="border-b border-border px-[var(--gutter)] py-5">
        <h1 className="text-[20px] font-bold tracking-tight text-text">
          {c.ko}
        </h1>
        <p className="mt-1 flex items-center gap-3 text-[12.5px] text-muted">
          <span>
            {rows.length > 0 ? `${rows.length}개 구단` : "순위 정보"}
          </span>
          <Link
            href={`/matches?comp=${code}`}
            className="rounded-[4px] border border-border px-2.5 py-1 text-[12px] transition-colors hover:border-border-strong hover:text-text"
          >
            경기 일정
          </Link>
        </p>
      </header>

      <LeagueTable rows={rows} />

      {mine.length > 0 && (
        <section className="border-t border-border pt-1">
          <h2 className="px-[var(--gutter)] pt-4 pb-1 text-[12px] font-semibold text-muted">
            오늘 경기
          </h2>
          <MatchBoard
            date={today}
            initial={mine}
            onlyTracked={false}
            bare
          />
        </section>
      )}

      <p className="px-[var(--gutter)] pb-8 text-[11.5px] text-faint">
        {ymd(today)} 기준
      </p>
    </Shell>
  );
}
