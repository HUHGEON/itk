"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import type { Team, League, Journalist } from "@/lib/types";
import { LEAGUE_LABEL, ALL_TIERS } from "@/lib/types";
import { tierColor, tierLabel, tierStyle } from "@/lib/format";
import { TeamCrest } from "./TeamCrest";
import { ScrollRail } from "./ScrollRail";
import { Close, Search } from "./icons";

const LEAGUES: League[] = [
  "EPL",
  "LaLiga",
  "Bundesliga",
  "SerieA",
  "Ligue1",
  "Eredivisie",
];

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
  journalists,
  journalistActivity,
  state,
}: {
  teams: Team[];
  activity: Activity;
  journalists: Journalist[];
  journalistActivity: Record<string, number>;
  state: FilterState;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Handed down rather than read with useSearchParams. That hook opts its
  // subtree out of server rendering, so the whole bar shipped as a Suspense
  // fallback and only appeared once a streamed chunk was swapped in — which on
  // one browser never happened, leaving a permanent skeleton where the filters
  // should be. The page already parses these on the server.
  const selectedTiers = state.tiers;
  const selectedTeams = state.teams;
  const league = state.league;
  const who = state.who;
  const [query, setQuery] = useState(state.q);

  const push = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams();
      if (state.tiers.length) next.set("tier", state.tiers.join(","));
      if (state.teams.length) next.set("team", state.teams.join(","));
      if (state.league) next.set("league", state.league);
      if (state.who) next.set("who", state.who);
      if (state.q) next.set("q", state.q);
      mutate(next);
      startTransition(() => {
        router.push(next.toString() ? `/?${next}` : "/", { scroll: false });
      });
    },
    [state, router],
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

  const grouped = useMemo(() => {
    return LEAGUES.map((l) => {
      const members = teams.filter((t) => t.league === l);
      const count = members.reduce(
        (n, t) => n + (activity[t.slug]?.count ?? 0),
        0,
      );
      const best = members.reduce<number | null>((b, t) => {
        const bt = activity[t.slug]?.bestTier;
        if (bt === null || bt === undefined) return b;
        return b === null ? bt : Math.min(b, bt);
      }, null);
      return { league: l, members, count, best };
    }).filter((g) => g.members.length > 0);
  }, [teams, activity]);

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

  return (
    <div
      className={`border-b border-border bg-surface ${pending ? "opacity-60" : ""}`}
    >
      {/* What's currently applied, plus the way out of it */}
      {hasAnyFilter && (
        <div className="flex items-center gap-2 border-b border-border bg-surface-2/40 px-4 py-2 sm:px-5">
          <span className="min-w-0 flex-1 truncate text-[12px] text-text/80">
            {activeSummary}
          </span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              startTransition(() => router.push("/", { scroll: false }));
            }}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted transition-colors hover:border-border-strong hover:text-text"
          >
            <Close size={10} />
            초기화
          </button>
        </div>
      )}

      {/* Trust is the spine of the app, so it leads — one hue at five
          strengths rather than five unrelated colours. */}
      <ScrollRail className="flex items-center gap-1.5 px-4 py-3 sm:px-5">
        <span className="shrink-0 pr-1.5 text-[11px] tracking-wide text-faint">
          신뢰도
        </span>
        {ALL_TIERS.map((t) => {
          const key = String(t);
          const on = selectedTiers.includes(key);
          const st = tierStyle(t);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleIn("tier", key)}
              aria-pressed={on}
              className="shrink-0 rounded-[4px] border px-2.5 py-1 text-[12px] font-medium transition-colors"
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
          <span className="shrink-0 pr-1 text-[11px] font-semibold text-muted">
            기자
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
                  onClick={() =>
                    push((p) => (on ? p.delete("who") : p.set("who", j.id)))
                  }
                  aria-pressed={on}
                  title={`${j.en}${j.outlet ? ` · ${j.outlet}` : ""}`}
                  className={`flex shrink-0 items-center gap-1.5 rounded-[4px] border px-2.5 py-1 text-[12px] whitespace-nowrap transition-colors ${
                    on
                      ? "border-accent/50 bg-accent/10 font-medium text-accent"
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

      {/* League tabs across the top; picking one drops its clubs in below. */}
      <div className="border-t border-border">
        <ScrollRail className="flex gap-0.5 px-4 sm:px-5">
          <LeagueTab
            active={!league}
            onClick={() => push((p) => p.delete("league"))}
          >
            전체
          </LeagueTab>
          {grouped.map((g) => (
            <LeagueTab
              key={g.league}
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

        {/* Clubs of the open league — plus any picks made in another league, so
            a selection never disappears when the tab changes. */}
        {(openGroup || selected.length > 0) && (
          <ScrollRail className="flex items-center gap-1.5 border-t border-border px-4 py-3 sm:px-5">
            {(openGroup?.members ?? selected).map((t) => {
              const on = selectedTeams.includes(t.slug);
              const act = activity[t.slug];
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => toggleIn("team", t.slug)}
                  aria-pressed={on}
                  className={`flex shrink-0 items-center gap-1.5 rounded-[4px] border py-1 pr-2.5 pl-1.5 text-[12px] whitespace-nowrap transition-colors ${
                    on
                      ? "border-accent/50 bg-accent/10 font-medium text-accent"
                      : "border-border text-muted hover:border-border-strong hover:text-text"
                  }`}
                >
                  <TeamCrest team={t} size={16} />
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
                    onClick={() => toggleIn("team", t.slug)}
                    title="선택 해제"
                    className="flex shrink-0 items-center gap-1 rounded-[4px] border border-accent/50 bg-accent/10 py-1 pr-2 pl-1.5 text-[12px] font-medium text-accent"
                  >
                    <TeamCrest team={t} size={16} />
                    {t.ko}
                    <Close size={10} className="opacity-70" />
                  </button>
                ))}
          </ScrollRail>
        )}
      </div>

      {/* Search */}
      <div className="border-t border-border px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5 rounded-[5px] border border-border bg-surface-2 px-3 py-2 transition-colors focus-within:border-border-strong">
          <Search className="shrink-0 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              push((p) => (query ? p.set("q", query) : p.delete("q")));
            }}
            placeholder="선수·팀·키워드"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                push((p) => p.delete("q"));
              }}
              aria-label="검색어 지우기"
              className="shrink-0 text-faint hover:text-text"
            >
              <Close size={12} />
            </button>
          )}
        </div>
      </div>
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
  return (
    <span
      className="tnum rounded-full px-1.5 py-[1px] text-[10px] font-semibold"
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
  badge,
  badgeTier,
  onClick,
  children,
}: {
  active: boolean;
  badge?: number;
  badgeTier?: number | null;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-[13px] transition-colors ${
        active
          ? "border-accent font-semibold text-text"
          : "border-transparent text-muted hover:text-text"
      }`}
    >
      {children}
      {badge !== undefined && <CountBadge n={badge} tier={badgeTier ?? null} />}
    </button>
  );
}
