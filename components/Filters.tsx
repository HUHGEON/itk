"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import type { Team, League, Journalist } from "@/lib/types";
import { LEAGUE_LABEL, ALL_TIERS } from "@/lib/types";
import { tierColor, tierLabel } from "@/lib/format";
import { TeamCrest } from "./TeamCrest";
import { ScrollRail } from "./ScrollRail";

const LEAGUES: League[] = ["EPL", "LaLiga", "Bundesliga", "SerieA", "Ligue1", "Eredivisie"];

type Activity = Record<string, { count: number; bestTier: number | null }>;

export function Filters({
  teams,
  activity,
  journalists,
  journalistActivity,
}: {
  teams: Team[];
  activity: Activity;
  journalists: Journalist[];
  journalistActivity: Record<string, number>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();

  const selectedTiers = (params.get("tier") ?? "").split(",").filter(Boolean);
  const selectedTeams = (params.get("team") ?? "").split(",").filter(Boolean);
  const league = params.get("league") ?? "";
  const who = params.get("who") ?? "";
  const [query, setQuery] = useState(params.get("q") ?? "");

  const push = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const next = new URLSearchParams(params.toString());
      mutate(next);
      startTransition(() => {
        router.push(next.toString() ? `/?${next}` : "/", { scroll: false });
      });
    },
    [params, router],
  );

  const toggleIn = (key: string, value: string) =>
    push((p) => {
      const cur = (p.get(key) ?? "").split(",").filter(Boolean);
      const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
      if (next.length) p.set(key, next.join(","));
      else p.delete(key);
    });

  const grouped = useMemo(() => {
    return LEAGUES.map((l) => {
      const members = teams.filter((t) => t.league === l);
      const count = members.reduce((n, t) => n + (activity[t.slug]?.count ?? 0), 0);
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
    selectedTiers.length > 0 || selectedTeams.length > 0 || league || query || who;

  const activeSummary = [
    selectedTiers.length ? selectedTiers.map((t) => tierLabel(Number(t))).join(", ") : null,
    league ? LEAGUE_LABEL[league as League] : null,
    selected.length ? selected.map((t) => t.ko).join(", ") : null,
    who ? journalists.find((j) => j.id === who)?.ko : null,
    query ? `"${query}"` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className={`border-b border-border bg-surface ${pending ? "opacity-60" : ""}`}>
      {/* What's currently applied, plus the way out of it */}
      {hasAnyFilter && (
        <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[12px] text-muted">
            {activeSummary}
          </span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              startTransition(() => router.push("/", { scroll: false }));
            }}
            className="shrink-0 text-[11px] text-muted hover:text-text"
          >
            초기화
          </button>
        </div>
      )}

      {/* Tier chips */}
      <ScrollRail className="flex items-center gap-1.5 px-3 py-2.5">
        <span className="shrink-0 pr-1 text-[11px] font-semibold text-muted">신뢰도</span>
        {ALL_TIERS.map((t) => {
          const key = String(t);
          const on = selectedTiers.includes(key);
          const color = tierColor(t);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleIn("tier", key)}
              aria-pressed={on}
              className="shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold"
              style={{
                color: on ? "#0e0f12" : color,
                backgroundColor: on ? color : "transparent",
                borderColor: on ? color : `color-mix(in srgb, ${color} 40%, transparent)`,
              }}
            >
              {tierLabel(t)}
            </button>
          );
        })}
      </ScrollRail>

      {selectedTiers.length > 0 && (
        <ScrollRail className="flex items-center gap-1.5 border-t border-border px-3 py-2.5">
          <span className="shrink-0 pr-1 text-[11px] font-semibold text-muted">기자</span>
          {tierReporters.length === 0 ? (
            <span className="text-[12px] text-muted">최근 기사가 있는 기자가 없습니다</span>
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
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] whitespace-nowrap ${
                    on
                      ? "border-accent bg-accent/15 font-semibold text-accent"
                      : "border-border bg-surface-2 text-muted hover:text-text"
                  }`}
                >
                  {j.ko}
                  <span
                    className="rounded-full px-1.5 text-[10px] font-bold"
                    style={{
                      color: tierColor(j.tier),
                      backgroundColor: `color-mix(in srgb, ${tierColor(j.tier)} 18%, transparent)`,
                    }}
                  >
                    {n}
                  </span>
                </button>
              );
            })
          )}
        </ScrollRail>
      )}

      {/* League tabs across the top; picking one drops its clubs in below. */}
      <div className="border-t border-border">
        <ScrollRail className="flex gap-1 px-3 pt-2">
          <LeagueTab active={!league} onClick={() => push((p) => p.delete("league"))}>
            전체
          </LeagueTab>
          {grouped.map((g) => (
            <LeagueTab
              key={g.league}
              active={league === g.league}
              badge={g.count > 0 ? g.count : undefined}
              badgeColor={tierColor(g.best)}
              onClick={() =>
                push((p) =>
                  league === g.league ? p.delete("league") : p.set("league", g.league),
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
          <ScrollRail className="flex items-center gap-1.5 px-3 py-2.5">
            {(openGroup?.members ?? selected).map((t) => {
              const on = selectedTeams.includes(t.slug);
              const act = activity[t.slug];
              return (
                <button
                  key={t.slug}
                  type="button"
                  onClick={() => toggleIn("team", t.slug)}
                  aria-pressed={on}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1.5 text-[12px] whitespace-nowrap ${
                    on
                      ? "border-accent bg-accent/15 font-semibold text-accent"
                      : "border-border bg-surface-2 text-muted hover:text-text"
                  }`}
                >
                  <TeamCrest team={t} size={16} />
                  {t.ko}
                  {act && act.count > 0 && (
                    <span
                      className="ml-0.5 rounded-full px-1.5 text-[10px] font-bold"
                      style={{
                        color: tierColor(act.bestTier),
                        backgroundColor: `color-mix(in srgb, ${tierColor(act.bestTier)} 18%, transparent)`,
                      }}
                    >
                      {act.count}
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
                    className="flex shrink-0 items-center gap-1 rounded-full border border-accent bg-accent/15 py-1 pr-2 pl-1.5 text-[12px] font-semibold text-accent"
                  >
                    <TeamCrest team={t} size={16} />
                    {t.ko}
                    <span aria-hidden className="opacity-70">
                      ×
                    </span>
                  </button>
                ))}
          </ScrollRail>
        )}
      </div>

      {/* Search */}
      <div className="flex items-center gap-2 border-t border-border px-3 py-2.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            push((p) => (query ? p.set("q", query) : p.delete("q")));
          }}
          placeholder="선수·팀·키워드 검색 후 Enter"
          className="min-w-0 flex-1 rounded-lg border border-border bg-surface-2 px-3 py-2 text-[13px] outline-none placeholder:text-muted focus:border-accent"
        />
      </div>
    </div>
  );
}

function LeagueTab({
  active,
  badge,
  badgeColor,
  onClick,
  children,
}: {
  active: boolean;
  badge?: number;
  badgeColor?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex shrink-0 items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-[13px] font-semibold ${
        active ? "border-accent text-text" : "border-transparent text-muted hover:text-text"
      }`}
    >
      {children}
      {badge !== undefined && (
        <span
          className="rounded-full px-1.5 text-[10px] font-bold"
          style={{
            color: badgeColor,
            backgroundColor: `color-mix(in srgb, ${badgeColor} 18%, transparent)`,
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
