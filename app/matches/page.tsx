import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { COMPETITIONS, matchesOn, seoul, seoulDay, ymd } from "@/lib/matches";
import { MatchBoard } from "@/components/matches/MatchBoard";
import { MEASURE } from "@/components/matches/Measure";
import { MatchRail } from "@/components/matches/MatchRail";
import { Shell } from "@/components/Shell";
import { SearchBox } from "@/components/SearchBox";
import { CollectButton } from "@/components/CollectButton";

export const metadata: Metadata = {
  title: "경기 일정 · ITK+",
  description:
    "프리미어리그·라리가·세리에 A·분데스리가·리그 1과 챔피언스리그, FA컵을 비롯한 컵대회 일정과 결과. 진행 중인 경기는 실시간으로 갱신됩니다.",
};

/**
 * Fixtures, results and live scores.
 *
 * Rendered fresh on every request rather than cached: a scoreline that is a
 * minute old is worse than no scoreline, and the page has a date in the URL so
 * there is nothing shared to cache anyway. The polling that keeps a live match
 * ticking happens in the browser - see `useLiveMatches`.
 */
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** A date from the URL, read as a Korean calendar day. `?d=20260913`. */
function parseDay(raw: string | string[] | undefined): Date {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s && /^\d{8}$/.test(s)) {
    const d = seoulDay(
      Number(s.slice(0, 4)),
      Number(s.slice(4, 6)),
      Number(s.slice(6, 8)),
    );
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** Moves by whole Korean days, not by 24 hour blocks from an arbitrary clock. */
function shift(d: Date, days: number): Date {
  const t = seoul(d);
  return seoulDay(t.year, t.month, t.day + days);
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * Names a day relative to today, in Seoul.
 *
 * Both dates are reduced to their Korean calendar day before subtracting, so
 * "today" turns over at midnight in Korea rather than at whatever hour the
 * server happens to think midnight is.
 */
/**
 * The day being shown, as a date and as a bearing.
 *
 * "내일" alone was not enough. A day here runs from Korean midnight to Korean
 * midnight, so the small hours belong to the day they are dated - Arsenal
 * against Chelsea at 00:30 is Monday, and a page headed only "내일" gave a
 * reader no way to see that. The date is the fact and the relative word is the
 * convenience, so both are shown, date first.
 */
function label(d: Date, today: Date): { date: string; near: string | null } {
  const a = seoul(d);
  const b = seoul(today);
  const days = Math.round(
    (Date.UTC(a.year, a.month - 1, a.day) -
      Date.UTC(b.year, b.month - 1, b.day)) /
      86_400_000,
  );
  return {
    date: `${a.month}월 ${a.day}일 (${WEEKDAY[a.weekday]})`,
    near: days === 0 ? "오늘" : days === 1 ? "내일" : days === -1 ? "어제" : null,
  };
}

export default async function Matches({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const date = parseDay(sp.d);
  const today = new Date();
  const onlyTracked = sp.all !== "1";

  const all = await matchesOn(date);

  /**
   * The competition picked in the rail, if any.
   *
   * Filtering here rather than in the board keeps the counts on the scope
   * buttons honest: they describe what this competition has on this date, not
   * what the whole day holds.
   */
  const comp = Array.isArray(sp.comp) ? sp.comp[0] : sp.comp;
  const picked = COMPETITIONS.find((c) => c.code === comp);
  const matches = picked
    ? all.filter((m) => m.competition === picked.ko)
    : all;
  const trackedCount = matches.filter((m) => m.tracked).length;

  // Feeds the rail, so it can show what is on and hide what is not.
  const counts: Record<string, number> = {};
  for (const m of all) counts[m.competition] = (counts[m.competition] ?? 0) + 1;
  const ranked =
    picked &&
    (picked.kind === "league" ||
      picked.code === "uefa.champions" ||
      picked.code === "uefa.europa");

  const href = (d: Date, showAll: boolean) => {
    const p = new URLSearchParams();
    if (ymd(d) !== ymd(today)) p.set("d", ymd(d));
    if (comp) p.set("comp", comp);
    if (showAll) p.set("all", "1");
    return p.toString() ? `/matches?${p}` : "/matches";
  };

  return (
    <Shell
      rail={<MatchRail active={picked?.code} day={ymd(date)} counts={counts} />}
      actions={
        <>
          <Suspense fallback={null}>
            <SearchBox state={{ tiers: [], teams: [], league: "", who: "", q: "" }} />
          </Suspense>
          <CollectButton lastCollect={null} />
        </>
      }
    >
      {/* Date and scope sit together: they are the two things that change what
          is on screen, and splitting them across the page would mean hunting
          for one after using the other. */}
      <div className="sticky top-0 z-20 border-b border-border bg-bg/95 backdrop-blur-sm">
        <div className={`${MEASURE} flex items-center gap-1 px-[var(--gutter)] py-3`}>
          <Link
            href={href(shift(date, -1), !onlyTracked)}
            aria-label="이전 날"
            className="rounded-[4px] border border-border px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            ‹
          </Link>
          <span className="flex min-w-[148px] items-baseline justify-center gap-1.5 px-2 text-center">
            <span className="text-[14px] font-semibold text-text">
              {label(date, today).date}
            </span>
            {label(date, today).near && (
              <span className="text-[12px] text-faint">
                {label(date, today).near}
              </span>
            )}
          </span>
          <Link
            href={href(shift(date, 1), !onlyTracked)}
            aria-label="다음 날"
            className="rounded-[4px] border border-border px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            ›
          </Link>

          {ymd(date) !== ymd(today) && (
            <Link
              href={href(today, !onlyTracked)}
              className="ml-1 rounded-[4px] px-2 py-1.5 text-[12.5px] text-muted transition-colors hover:text-text"
            >
              오늘
            </Link>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Scope href={href(date, false)} on={onlyTracked}>
              보고 있는 구단
              {trackedCount > 0 && (
                <span className="ml-1 opacity-70">{trackedCount}</span>
              )}
            </Scope>
            <Scope href={href(date, true)} on={!onlyTracked}>
              전체
              {matches.length > 0 && (
                <span className="ml-1 opacity-70">{matches.length}</span>
              )}
            </Scope>
          </div>
        </div>
      </div>

      {picked && (
        <div className="border-b border-border">
          <div className={`${MEASURE} flex items-center gap-3 px-[var(--gutter)] py-3`}>
          <h1 className="text-[15px] font-bold tracking-tight text-text">
            {picked.ko}
          </h1>
          {ranked && (
            <Link
              href={`/matches/league/${picked.code}`}
              className="rounded-[4px] border border-border px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-border-strong hover:text-text"
            >
              순위표
            </Link>
          )}
          </div>
        </div>
      )}

      <MatchBoard
        date={date}
        initial={matches}
        onlyTracked={onlyTracked}
        bare={Boolean(picked)}
      />
    </Shell>
  );
}

function Scope({
  href,
  on,
  children,
}: {
  href: string;
  on: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={on ? "true" : undefined}
      className={`tnum rounded-[4px] border px-2.5 py-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
        on
          ? "border-accent/50 bg-accent/10 font-medium text-accent"
          : "border-border text-muted hover:border-border-strong hover:text-text"
      }`}
    >
      {children}
    </Link>
  );
}

