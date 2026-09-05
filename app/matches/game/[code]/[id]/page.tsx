import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { matchDetail, seoul, ymd } from "@/lib/matches";
import { MatchRail } from "@/components/matches/MatchRail";
import { MatchReport } from "@/components/matches/MatchReport";
import { Shell } from "@/components/Shell";
import { SearchBox } from "@/components/SearchBox";
import { CollectButton } from "@/components/CollectButton";

/**
 * One match in full: the timeline, the statistics, both lineups.
 *
 * Never cached. A match in play has a scoreline that changes, and a page cached
 * for even a minute would open on a stale one before the first poll corrected
 * it - which is exactly the failure the live board was built to avoid.
 */
export const dynamic = "force-dynamic";

type Params = Promise<{ code: string; id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { code, id } = await params;
  const d = await matchDetail(code, id);
  if (!d) return { title: "경기 · ITK+" };
  const m = d.match;
  const line =
    m.state === "pre"
      ? `${seoul(m.kickoff).hm} 킥오프`
      : `${m.home.score ?? 0} : ${m.away.score ?? 0}`;
  return {
    title: `${m.home.name} ${line} ${m.away.name} · ITK+`,
    description: `${m.competition} · ${m.home.name} 대 ${m.away.name}. 경기 기록, 팀 기록, 선수 명단.`,
  };
}

export default async function Game({ params }: { params: Params }) {
  const { code, id } = await params;
  const detail = await matchDetail(code, id);
  if (!detail) notFound();

  return (
    <Shell
      rail={
        <MatchRail active={code} day={ymd(new Date(detail.match.kickoff))} />
      }
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
      <MatchReport initial={detail} />
    </Shell>
  );
}
