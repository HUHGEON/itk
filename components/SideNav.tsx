"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDots, ChartDonut, GameController, IdentificationBadge, Newspaper } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import registry from "@/data/teams.json";
import { LEAGUE_LABEL, type League, type Team } from "@/lib/types";
import { LeagueMark } from "./LeagueMark";
import { Logo } from "./Logo";
import { TeamCrest } from "./TeamCrest";

const TEAMS = registry as Team[];

export const SECTIONS = [
  { href: "/feed", label: "이적 소식", Icon: Newspaper, match: (p: string) => p === "/feed" || p === "/" },
  { href: "/matches", label: "경기 일정", Icon: CalendarDots, match: (p: string) => p.startsWith("/matches") },
  { href: "/journalists", label: "기자", Icon: IdentificationBadge, match: (p: string) => p.startsWith("/journalists") },
  { href: "/games", label: "미니게임", Icon: GameController, match: (p: string) => p.startsWith("/games") },
];

const LEAGUES: League[] = ["EPL", "LaLiga", "SerieA", "Bundesliga", "Ligue1", "Eredivisie"];

/** The clubs the reader set up team alerts for, read after mount. */
function useMyClubs(): Team[] {
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("itk:alerts");
      const teams = raw ? (JSON.parse(raw) as { teams?: unknown }).teams : null;
      if (Array.isArray(teams)) setSlugs(teams.filter((t): t is string => typeof t === "string"));
    } catch {
      // nothing saved, or storage blocked
    }
  }, []);
  return slugs.map((s) => TEAMS.find((t) => t.slug === s)).filter((t): t is Team => Boolean(t));
}

/**
 * The left column: where you are, and every way into the feed by what it is
 * about.
 *
 * Leagues and clubs used to be reachable only from the tab row over the list,
 * which sat under the fold once the page grew a hero; a reader who wanted
 * "just Chelsea" had to find it. Here they are always in view, by logo, the
 * way a sports app keeps "favourite league" and "favourite club" in its side
 * menu. Clubs are the ones the reader set alerts for, or the best-followed
 * few until they have.
 */
export function SideNav({
  collect,
  search,
  searchUntilXl = false,
  onWidgets,
}: {
  /** the page's main button, under the menu as X and Bluesky place theirs */
  collect?: ReactNode;
  search?: ReactNode;
  /** the widget column takes the search from 1280px up */
  searchUntilXl?: boolean;
  /** opens the widgets, while there is no column for them */
  onWidgets?: () => void;
} = {}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const mine = useMyClubs();
  const [allClubs, setAllClubs] = useState(false);
  const onFeed = pathname === "/feed";
  const league = onFeed ? params.get("league") : null;
  const team = onFeed ? params.get("team") : null;
  const clubs = mine.length ? mine : allClubs ? TEAMS : TEAMS.slice(0, 5);

  return (
    <div className="flex min-h-full flex-col px-3 pb-6">
      <Link
        href="/feed"
        aria-label="ITK plus 이적 소식"
        className="mx-2 mt-5 mb-4 hidden self-start rounded-[6px] focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none lg:block"
      >
        <Logo height={32} />
      </Link>

      {search && <div className={`mb-4 ${searchUntilXl ? "xl:hidden" : ""}`}>{search}</div>}

      <nav aria-label="섹션" className="space-y-0.5">
        {SECTIONS.map(({ href, label, Icon, match }) => {
          const on = match(pathname) && !(href === "/feed" && (league || team));
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              className={`group flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors ${
                on ? "bg-accent/12 font-semibold text-text" : "text-muted hover:bg-white/[0.04] hover:text-text"
              }`}
            >
              <Icon size={20} weight={on ? "fill" : "regular"} className={on ? "text-accent" : "text-faint group-hover:text-muted"} />
              {label}
            </Link>
          );
        })}
      </nav>

      {collect && <div className="mt-3">{collect}</div>}
      {onWidgets && (
        <button
          type="button"
          onClick={onWidgets}
          className="mt-2 flex h-10 items-center justify-center gap-2 rounded-full border border-border text-[14px] text-muted transition-colors hover:border-border-strong hover:text-text xl:hidden"
        >
          <ChartDonut size={18} />
          현황 보기
        </button>
      )}

      <Heading>리그</Heading>
      <ul className="space-y-0.5">
        {LEAGUES.map((l) => {
          const on = league === l;
          return (
            <li key={l}>
              <Link
                href={`/feed?league=${l}`}
                aria-current={on ? "page" : undefined}
                className={`flex h-9 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors ${
                  on ? "bg-white/[0.07] font-semibold text-text" : "text-muted hover:bg-white/[0.04] hover:text-text"
                }`}
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-white/[0.06]">
                  <LeagueMark league={l} size={15} />
                </span>
                {LEAGUE_LABEL[l]}
              </Link>
            </li>
          );
        })}
      </ul>

      <Heading>{mine.length ? "내 구단" : "구단"}</Heading>
      <ul className="space-y-0.5">
        {clubs.map((t) => {
          const on = team === t.slug;
          return (
            <li key={t.slug}>
              <Link
                href={`/feed?team=${t.slug}`}
                aria-current={on ? "page" : undefined}
                className={`flex h-9 items-center gap-3 rounded-xl px-3 text-[14px] transition-colors ${
                  on ? "bg-white/[0.07] font-semibold text-text" : "text-muted hover:bg-white/[0.04] hover:text-text"
                }`}
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-white/[0.06]">
                  <TeamCrest team={t} size={16} />
                </span>
                <span className="truncate">{t.ko}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      {!mine.length && (
        <button
          type="button"
          onClick={() => setAllClubs((v) => !v)}
          className="mx-3 mt-1.5 self-start text-[13px] text-faint transition-colors hover:text-text"
        >
          {allClubs ? "접기" : `${TEAMS.length - 5}개 더 보기`}
        </button>
      )}

      <Link
        href="/?intro=1"
        prefetch={false}
        className="mx-3 mt-auto pt-5 text-[12.5px] text-faint transition-colors hover:text-muted"
      >
        ITK+ 소개
      </Link>
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="mx-3 mt-4 mb-1.5 text-[12px] font-semibold tracking-wide text-faint">{children}</p>;
}
