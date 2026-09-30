import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getJournalistActivity, getPulse } from "@/lib/feed";
import { loadJournalists, loadTeams } from "@/lib/registry";
import { ALL_TIERS, LEAGUE_LABEL, type Journalist, type League, type Team } from "@/lib/types";
import { tierLabel, tierStyle } from "@/lib/format";
import { Shell } from "@/components/Shell";
import { SearchBox } from "@/components/SearchBox";
import { CollectButton } from "@/components/CollectButton";
import { PulsePanel } from "@/components/PulsePanel";
import { TeamCrest } from "@/components/TeamCrest";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "기자 · ITK+",
  description: "티어로 나눈 해외 축구 기자 명단. 누가 얼마나 쓰는지, 어느 구단을 다루는지.",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The reporters, as 요즘IT lays out its writers: one card each, with who they
 * are, what they cover, how much they have written lately and the way to
 * their stories. The tier is the site's whole premise, so it leads every card
 * and filters the list.
 */
export default async function JournalistsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.tier) ? sp.tier[0] : sp.tier;
  const tier = ALL_TIERS.find((t) => String(t) === raw) ?? null;

  const [month, week, pulse] = await Promise.all([
    getJournalistActivity({}, 720).catch(() => ({}) as Record<string, number>),
    getJournalistActivity({}, 168).catch(() => ({}) as Record<string, number>),
    getPulse().catch(() => null),
  ]);
  const teams = new Map(loadTeams().map((t) => [t.slug, t]));
  const all = loadJournalists().filter((j) => j.active);
  const list = all
    .filter((j) => tier === null || j.tier === tier)
    .sort((a, b) => (month[b.id] ?? 0) - (month[a.id] ?? 0) || a.tier - b.tier || a.ko.localeCompare(b.ko));
  const perTier = Object.fromEntries(ALL_TIERS.map((t) => [t, all.filter((j) => j.tier === t).length]));

  return (
    <Shell
        bare
      rail={pulse ? <PulsePanel pulse={pulse} now={Date.now()} /> : null}
      actions={
        <>
          <Suspense fallback={null}>
            <SearchBox state={{ tiers: [], teams: [], league: "", who: "", q: "" }} />
          </Suspense>
          <CollectButton lastCollect={pulse?.lastCollect ?? null} />
        </>
      }
    >
      <div className="px-[var(--gutter)] pt-6 pb-16 lg:px-0">
        <h1 className="text-[26px] font-bold tracking-tight text-text">기자</h1>
        <p className="mt-1.5 text-[15px] text-muted">
          티어로 나눈 {all.length}명. 최근 30일 동안 많이 쓴 순서입니다.
        </p>

        <nav className="mt-6 flex gap-1.5 overflow-x-auto" aria-label="티어">
          <TierTab href="/journalists" on={tier === null} label="전체" n={all.length} />
          {ALL_TIERS.map((t) => (
            <TierTab key={t} href={`/journalists?tier=${t}`} on={tier === t} label={tierLabel(t)} n={perTier[t]} tier={t} />
          ))}
        </nav>

        <ul className="mt-5 grid gap-3 sm:gap-4 xl:grid-cols-2">
          {list.map((j) => (
            <li key={j.id}>
              <Card j={j} month={month[j.id] ?? 0} week={week[j.id] ?? 0} teams={teams} />
            </li>
          ))}
        </ul>
      </div>
    </Shell>
  );
}

function TierTab({ href, on, label, n, tier }: { href: string; on: boolean; label: string; n: number; tier?: number }) {
  const st = tier === undefined ? null : tierStyle(tier);
  return (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition-colors ${
        on ? "border-transparent bg-text text-bg" : "border-transparent bg-surface text-muted hover:text-text"
      }`}
      style={on && st ? { background: st.bg, color: st.ink } : undefined}
    >
      {label}
      <span className="tnum text-[12px] opacity-70">{n}</span>
    </Link>
  );
}

function Card({ j, month, week, teams }: { j: Journalist; month: number; week: number; teams: Map<string, Team> }) {
  const st = tierStyle(j.tier);
  const covered = j.teams.map((s) => teams.get(s)).filter((t): t is Team => Boolean(t));
  const league = LEAGUE_LABEL[j.league as League];
  return (
    <article className="flex h-full gap-4 rounded-2xl bg-surface p-5 transition-colors hover:bg-surface-2 sm:gap-5">
      {/* No portraits to hand, so the initial in the tier's own colour: the
          one thing about a reporter this site exists to show. */}
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-full text-[18px] font-bold sm:size-14 sm:text-[20px]"
        style={{ background: st.bg, color: st.ink, boxShadow: `inset 0 0 0 1px ${st.border === "transparent" ? st.bg : st.border}` }}
      >
        {j.ko.slice(0, 1)}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[18px] font-bold text-text">
              {j.ko}
              <span
                className="rounded-[6px] px-1.5 py-[1px] text-[12px] font-semibold"
                style={{ background: st.bg, color: st.ink, boxShadow: `inset 0 0 0 1px ${st.border === "transparent" ? st.bg : st.border}` }}
              >
                {tierLabel(j.tier)}
              </span>
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-faint">{j.en}</p>
          </div>
          <Link
            href={`/feed?tier=${j.tier}&who=${j.id}`}
            className="shrink-0 rounded-full bg-surface-3 px-3.5 py-1.5 text-[13px] font-semibold text-text transition-colors hover:bg-accent hover:text-accent-ink"
          >
            기사 보기
          </Link>
        </div>

        <p className="mt-2.5 text-[14px] text-muted">
          {[j.outlet, league].filter(Boolean).join(" · ")}
          {j.x && (
            <>
              {" · "}
              <a href={`https://x.com/${j.x}`} target="_blank" rel="noopener noreferrer" className="hover:text-text hover:underline">
                @{j.x}
              </a>
            </>
          )}
        </p>

        <p className="tnum mt-2 text-[13px] text-faint">
          최근 30일 <span className="font-semibold text-text">{month}</span>건 · 7일 <span className="font-semibold text-text">{week}</span>건
        </p>

        {covered.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {covered.map((t) => (
              <Link
                key={t.slug}
                href={`/feed?team=${t.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 py-[3px] pr-2.5 pl-[3px] text-[12.5px] font-semibold text-muted transition-colors hover:text-text"
              >
                <span className="flex size-[18px] items-center justify-center rounded-full bg-surface-3">
                  <TeamCrest team={t} size={14} />
                </span>
                {t.ko}
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
