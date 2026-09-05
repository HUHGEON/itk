import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { matchesOn, ymd } from "@/lib/matches";
import { MatchBoard } from "@/components/matches/MatchBoard";
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

/** A date from the URL, or today. `?d=20260913`. */
function parseDay(raw: string | string[] | undefined): Date {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s && /^\d{8}$/.test(s)) {
    const d = new Date(
      Number(s.slice(0, 4)),
      Number(s.slice(4, 6)) - 1,
      Number(s.slice(6, 8)),
    );
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

function shift(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

const WEEKDAY = ["일", "월", "화", "수", "목", "금", "토"];

function label(d: Date, today: Date): string {
  const days = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate(),
      ).getTime()) /
      86_400_000,
  );
  if (days === 0) return "오늘";
  if (days === 1) return "내일";
  if (days === -1) return "어제";
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY[d.getDay()]})`;
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

  const matches = await matchesOn(date);
  const trackedCount = matches.filter((m) => m.tracked).length;

  const href = (d: Date, all: boolean) => {
    const p = new URLSearchParams();
    if (ymd(d) !== ymd(today)) p.set("d", ymd(d));
    if (all) p.set("all", "1");
    return p.toString() ? `/matches?${p}` : "/matches";
  };

  return (
    <Shell
      rail={<MatchRail />}
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
        <div className="flex items-center gap-1 px-[var(--gutter)] py-3">
          <Link
            href={href(shift(date, -1), !onlyTracked)}
            aria-label="이전 날"
            className="rounded-[4px] border border-border px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            ‹
          </Link>
          <span className="min-w-[112px] px-2 text-center text-[14px] font-semibold text-text">
            {label(date, today)}
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

      <MatchBoard date={date} initial={matches} onlyTracked={onlyTracked} />
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

