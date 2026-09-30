"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import type { Team, League, Journalist } from "@/lib/types";
import { LEAGUE_LABEL, ALL_TIERS } from "@/lib/types";
import { tierColor, tierLabel, tierStyle } from "@/lib/format";
import { TeamCrest } from "./TeamCrest";
import { ScrollRail } from "./ScrollRail";
import { Close } from "./icons";
import { FunnelSimple, GlobeHemisphereWest, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import { pressPop, rollNumber, useBeforePaint } from "@/lib/motion";

/**
 * Marks the control that was just pressed.
 *
 * Every chip here navigates, so the gap between the click and the new feed is a
 * server round trip. The bar dims as a whole while that is in flight — which
 * says something is loading, not which of twenty chips you hit.
 */
function press(e: { currentTarget: HTMLElement }) {
  pressPop(e.currentTarget);
}

const LEAGUES: League[] = [
  "EPL",
  "LaLiga",
  "Bundesliga",
  "SerieA",
  "Ligue1",
  "Eredivisie",
  "General",
];

/*
 * Each league by its own mark, from FotMob's image host (free, no key; ids
 * checked by eye: 47 Premier League, 87 LaLiga, 54 Bundesliga, 55 Serie A,
 * 53 Ligue 1, 57 Eredivisie). The dark variants are drawn for a dark page -
 * Ligue 1's is white-on-nothing. A tab someone has to read to find is a tab
 * they miss; a logo is found at a glance.
 */
const LEAGUE_LOGO: Partial<Record<League, number>> = {
  EPL: 47,
  LaLiga: 87,
  Bundesliga: 54,
  SerieA: 55,
  Ligue1: 53,
  Eredivisie: 57,
};

function LeagueMark({ league, on }: { league: League | null; on: boolean }) {
  const id = league ? LEAGUE_LOGO[league] : undefined;
  if (id)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        // The chosen tab is filled white, where the dark variant (a white
        // lion, a white Ligue 1) vanishes - measured on screen - so it takes
        // the light-page mark instead.
        src={`https://images.fotmob.com/image_resources/logo/leaguelogo/${on ? "" : "dark/"}${id}.png`}
        alt=""
        width={18}
        height={18}
        className="size-[18px] shrink-0 object-contain"
      />
    );
  const Icon = league ? GlobeHemisphereWest : SquaresFour;
  return <Icon className="size-[18px] shrink-0" weight="fill" />;
}

type Activity = Record<string, { count: number; bestTier: number | null }>;

/** What the URL currently says, parsed once on the server. */
export interface FilterState {
  tiers: string[];
  teams: string[];
  league: string;
  who: string;
  q: string;
}

export function Filters({
  teams,
  activity,
  leagueActivity,
  journalists,
  journalistActivity,
  state,
}: {
  teams: Team[];
  activity: Activity;
  leagueActivity: Activity;
  journalists: Journalist[];
  journalistActivity: Record<string, number>;
  state: FilterState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  /*
   * Tiers, reporters and clubs live behind one button.
   *
   * They used to stand as three stacked rows over the feed - 278px measured on
   * a laptop, a quarter of a phone screen - before the first story. 요즘IT
   * keeps one row of category tabs over its lists; the league tabs are that
   * row here, and the finer filters open on demand.
   */
  const [panel, setPanel] = useState(false);
  useEffect(() => {
    if (!panel) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && setPanel(false);
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [panel]);

  // Handed down rather than read with useSearchParams. That hook opts its
  // subtree out of server rendering, so the whole bar shipped as a Suspense
  // fallback and only appeared once a streamed chunk was swapped in — which on
  // one browser never happened, leaving a permanent skeleton where the filters
  // should be. The page already parses these on the server.
  const selectedTiers = state.tiers;
  const selectedTeams = state.teams;
  const league = state.league;
  const who = state.who;
  const query = state.q;

  const push = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams();
      if (state.tiers.length) next.set("tier", state.tiers.join(","));
      if (state.teams.length) next.set("team", state.teams.join(","));
      if (state.league) next.set("league", state.league);
      if (state.who) next.set("who", state.who);
      if (state.q) next.set("q", state.q);
      mutate(next);
      // A journalist pick only exists inside the row its tier opens. Drop the
      // tier and that row goes with it — leaving `who` applied to the feed with
      // nothing on screen able to release it, so the tier chip looked broken.
      const picked = next.get("who");
      if (picked) {
        const tiers = (next.get("tier") ?? "").split(",").filter(Boolean);
        const j = journalists.find((x) => x.id === picked);
        if (!j || !tiers.includes(String(j.tier))) next.delete("who");
      }
      startTransition(() => {
        router.push(next.toString() ? `/feed?${next}` : "/feed", { scroll: false });
      });
    },
    [state, router, journalists],
  );

  const toggleIn = (key: string, value: string) =>
    push((p) => {
      const cur = (p.get(key) ?? "").split(",").filter(Boolean);
      const next = cur.includes(value)
        ? cur.filter((v) => v !== value)
        : [...cur, value];
      if (next.length) p.set(key, next.join(","));
      else p.delete(key);
    });

  // The badge counts what the tab returns. Summing the clubs underneath it
  // counts a different set — a league tab selects on the reporter's beat, so
  // a story that names no tracked club sits in the tab with no club badge to
  // be counted in.
  const grouped = useMemo(() => {
    return LEAGUES.map((l) => ({
      league: l,
      members: teams.filter((t) => t.league === l),
      count: leagueActivity[l]?.count ?? 0,
      best: leagueActivity[l]?.bestTier ?? null,
      // A league earns a tab by having stories, not by having tracked clubs.
      // Bundesliga has twenty-four reporters and no crest in the registry, so
      // keying the tabs off club membership hid all of them behind 전체.
    })).filter(
      (g) => g.members.length > 0 || (leagueActivity[g.league]?.count ?? 0) > 0,
    );
  }, [teams, leagueActivity]);

  // Journalists of the picked tiers, busiest first — a flat list of 244 names
  // is unusable, and the ones filing today are the ones worth filtering to.
  const tierReporters = useMemo(() => {
    if (selectedTiers.length === 0) return [];
    return journalists
      .filter((j) => selectedTiers.includes(String(j.tier)))
      .map((j) => ({ j, n: journalistActivity[j.id] ?? 0 }))
      .filter((r) => r.n > 0 || r.j.id === who)
      .sort((a, b) => b.n - a.n || a.j.ko.localeCompare(b.j.ko));
  }, [journalists, journalistActivity, selectedTiers, who]);

  const selected = teams.filter((t) => selectedTeams.includes(t.slug));
  const openGroup = grouped.find((g) => g.league === league) ?? null;
  const activeCount = selectedTiers.length + selectedTeams.length + (who ? 1 : 0);
  const hasAnyFilter =
    selectedTiers.length > 0 ||
    selectedTeams.length > 0 ||
    league ||
    query ||
    who;

  const activeSummary = [
    selectedTiers.length
      ? selectedTiers.map((t) => tierLabel(Number(t))).join(", ")
      : null,
    league ? LEAGUE_LABEL[league as League] : null,
    selected.length ? selected.map((t) => t.ko).join(", ") : null,
    who ? journalists.find((j) => j.id === who)?.ko : null,
    query ? `"${query}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  /*
   * A league's clubs are its children, and picking the league opens them.
   *
   * They used to live only in the 필터 panel, so choosing 프리미어리그 narrowed
   * the feed and left the next step - one of its clubs - behind a second
   * button. Now the open league's clubs sit right under the tabs, the way a
   * category menu opens its sub-menu. A league with no tracked clubs
   * (분데스리가, 종합) has no row to open.
   */
  const subRow = Boolean(openGroup && openGroup.members.length > 0);
  const clubRow = (
    <ScrollRail className="flex items-center gap-2 border-t border-border px-[var(--gutter)] py-3">
  {(openGroup?.members ?? teams).map((t) => {
    const on = selectedTeams.includes(t.slug);
    const act = activity[t.slug];
    return (
      <button
        key={t.slug}
        type="button"
        onClick={(e) => {
          press(e);
          toggleIn("team", t.slug);
        }}
        aria-pressed={on}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full border pr-3.5 pl-2 text-[13.5px] whitespace-nowrap transition-colors ${
          on
            ? "border-accent/50 bg-accent/10 font-semibold text-accent"
            : "border-border text-muted hover:border-border-strong hover:text-text"
        }`}
      >
        <TeamCrest team={t} size={20} />
        {t.ko}
        {act && act.count > 0 && (
          <span className="ml-0.5">
            <CountBadge n={act.count} tier={act.bestTier} />
          </span>
        )}
      </button>
    );
  })}

  {/* Off-league picks stay visible while another tab is open */}
  {openGroup &&
    selected
      .filter((t) => t.league !== openGroup.league)
      .map((t) => (
        <button
          key={t.slug}
          type="button"
          onClick={(e) => {
            press(e);
            toggleIn("team", t.slug);
          }}
          title="선택 해제"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-accent/50 bg-accent/10 pr-3 pl-2 text-[13.5px] font-semibold text-accent"
        >
          <TeamCrest team={t} size={20} />
          {t.ko}
          <Close size={10} className="opacity-70" />
        </button>
      ))}
</ScrollRail>
  );

  return (
    <div
      className={`bg-surface ${pending ? "opacity-60" : ""}`}
    >
      {/* What's currently applied, plus the way out of it */}
      {hasAnyFilter && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/40 px-[var(--gutter)] py-2">
          <span className="min-w-0 flex-1 truncate text-[12px] text-text/80">
            {activeSummary}
          </span>
          <button
            type="button"
            onClick={() =>
              startTransition(() => router.push("/feed", { scroll: false }))
            }
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[12px] text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            <Close size={10} />
            초기화
          </button>
        </div>
      )}

      {/* League tabs, and beside them the way into everything else. */}
      <div className="flex items-stretch">
        <div className="min-w-0 flex-1">
        <ScrollRail className="flex gap-2 px-[var(--gutter)] py-3">
          <LeagueTab
            active={!league}
            league={null}
            onClick={() => push((p) => p.delete("league"))}
          >
            전체
          </LeagueTab>
          {grouped.map((g) => (
            <LeagueTab
              key={g.league}
              league={g.league}
              active={league === g.league}
              badge={g.count > 0 ? g.count : undefined}
              badgeTier={g.best}
              onClick={() =>
                push((p) =>
                  league === g.league
                    ? p.delete("league")
                    : p.set("league", g.league),
                )
              }
            >
              {LEAGUE_LABEL[g.league]}
            </LeagueTab>
          ))}
        </ScrollRail>
        </div>
        <button
          type="button"
          onClick={() => setPanel((v) => !v)}
          aria-expanded={panel}
          aria-controls="feed-filters"
          className={`my-3 mr-[var(--gutter)] flex h-10 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[14px] sm:px-4 font-semibold transition-colors ${
            panel || activeCount > 0
              ? "border-accent/50 bg-accent/10 text-accent"
              : "border-border text-muted hover:border-border-strong hover:text-text"
          }`}
        >
          <FunnelSimple className="size-4" weight="bold" />
          {/* Icon only on a phone, where the league pills need the width. */}
          <span className="sr-only sm:not-sr-only">필터</span>
          {activeCount > 0 && <span className="tnum rounded-full bg-accent px-1.5 text-[11.5px] text-accent-ink">{activeCount}</span>}
        </button>
      </div>

      {subRow && <div className="bg-surface-2/50">{clubRow}</div>}

      {panel && (
        <>
          {/* On a phone the panel is a sheet from the bottom, over a scrim. */}
          <button type="button" aria-label="필터 닫기" onClick={() => setPanel(false)} className="fixed inset-0 z-40 bg-black/50 sm:hidden" />
          <div
            id="feed-filters"
            className="fixed inset-x-0 bottom-0 z-50 max-h-[75vh] overflow-y-auto rounded-t-2xl border-t border-border-strong bg-surface pb-[max(16px,env(safe-area-inset-bottom))] sm:static sm:z-auto sm:max-h-none sm:overflow-visible sm:rounded-none sm:border-border sm:pb-0"
          >
            <div className="flex items-center justify-between px-[var(--gutter)] pt-4 pb-1 sm:hidden">
              <span className="text-[16px] font-bold text-text">필터</span>
              <button type="button" onClick={() => setPanel(false)} aria-label="닫기" className="p-1 text-muted hover:text-text">
                <Close size={16} />
              </button>
            </div>

      {/* Who filed it is the spine of the app, so the tiers lead — one hue at
          five strengths rather than five unrelated colours. Labelled by what
          they rank, not by the abstraction: "신뢰도" of what was never said. */}
      <ScrollRail className="flex items-center gap-1.5 px-[var(--gutter)] py-3">
        <span className="shrink-0 pr-1.5 text-[12px] font-semibold tracking-wide text-muted">
          기자 티어
        </span>
        {ALL_TIERS.map((t) => {
          const key = String(t);
          const on = selectedTiers.includes(key);
          const st = tierStyle(t);
          return (
            <button
              key={key}
              type="button"
              onClick={(e) => {
                press(e);
                toggleIn("tier", key);
              }}
              aria-pressed={on}
              className="shrink-0 rounded-[6px] border px-2.5 py-1 text-[12px] font-semibold transition-colors"
              // Unselected chips still carry their hue: the rail is where you
              // learn which colour means which tier, and five identical grey
              // pills teach nothing. Dimming with opacity rather than mixing
              // toward grey keeps all five equally legible against the black.
              style={
                on
                  ? {
                      backgroundColor: st.bg,
                      borderColor: st.border,
                      color: st.ink,
                    }
                  : {
                      backgroundColor: "transparent",
                      borderColor: `color-mix(in srgb, ${st.color} 30%, transparent)`,
                      color: st.color,
                      opacity: 0.78,
                    }
              }
            >
              {tierLabel(t)}
            </button>
          );
        })}
      </ScrollRail>

      {selectedTiers.length > 0 && (
        <ScrollRail className="flex items-center gap-1.5 border-t border-border px-3 py-2.5">
          <span className="shrink-0 pr-1 text-[12px] font-semibold tracking-wide text-muted">
            이름
          </span>
          {tierReporters.length === 0 ? (
            <span className="text-[12px] text-muted">
              최근 기사가 있는 기자가 없습니다
            </span>
          ) : (
            tierReporters.map(({ j, n }) => {
              const on = who === j.id;
              return (
                <button
                  key={j.id}
                  type="button"
                  onClick={(e) => {
                    press(e);
                    push((p) => (on ? p.delete("who") : p.set("who", j.id)));
                  }}
                  aria-pressed={on}
                  title={`${j.en}${j.outlet ? ` · ${j.outlet}` : ""}`}
                  className={`flex shrink-0 items-center gap-1.5 rounded-[6px] border px-2.5 py-1 text-[12px] whitespace-nowrap transition-colors ${
                    on
                      ? "border-accent/50 bg-accent/10 font-semibold text-accent"
                      : "border-border text-muted hover:border-border-strong hover:text-text"
                  }`}
                >
                  {j.ko}
                  <CountBadge n={n} tier={j.tier} />
                </button>
              );
            })
          )}
        </ScrollRail>
      )}

        {/* Every club, while no league is open. Once one is, its own clubs
            sit under the tabs instead (see clubRow). */}
        {!subRow && teams.length > 0 && clubRow}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * A count with a colour. The number says how much is behind the filter; the
 * colour says how trustworthy the best of it is — a league sitting on a 0-tier
 * scoop should not look the same as one with forty 3-tier rumours.
 */
function CountBadge({ n, tier }: { n: number; tier: number | null }) {
  const color = tierColor(tier);
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(n);

  // A filter change lands a new number in every badge at once. Rewinding to the
  // old value and running up to the new one costs nothing visually — this is
  // before paint, so the old number is never shown — and turns a silent swap
  // into a readable amount of change.
  useBeforePaint(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = n;
    rollNumber(el, from, n);
  }, [n]);

  return (
    <span
      ref={ref}
      className="tnum rounded-full px-1.5 py-[1px] text-[11.5px] font-semibold"
      style={{
        color,
        backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)`,
      }}
    >
      {n}
    </span>
  );
}

function LeagueTab({
  active,
  league,
  badge,
  badgeTier,
  onClick,
  children,
}: {
  active: boolean;
  league: League | null;
  badge?: number;
  badgeTier?: number | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        pressPop(e.currentTarget);
        onClick();
      }}
      aria-pressed={active}
      // SofaScore's category pills: icon and name, and the chosen one filled
      // solid white, which is the one state on a dark page nobody misses. The
      // earlier 13px grey text with a 2px underline was read past.
      className={`flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-[15px] font-semibold transition-colors ${
        active ? "bg-text text-bg" : "bg-surface-2 text-muted hover:bg-surface-3 hover:text-text"
      }`}
    >
      <LeagueMark league={league} on={active} />
      {children}
      {badge !== undefined && <CountBadge n={badge} tier={badgeTier ?? null} />}
    </button>
  );
}
