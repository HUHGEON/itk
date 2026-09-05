import type { Lineup, LineupPlayer, MatchEvent } from "@/lib/matches";

/**
 * Both teams' selections.
 *
 * Formation first, because that is the one thing about a lineup that is read
 * before the names. Then the eleven in the order the source lists them, which
 * is goalkeeper outward, then the bench.
 *
 * Substitutions are marked on the players themselves rather than repeated from
 * the timeline: a name with an arrow beside it answers "did he play" without
 * making anyone cross-reference two sections.
 */
function Player({ p, minute }: { p: LineupPlayer; minute?: string }) {
  return (
    <li className="flex items-baseline gap-2 py-[3px]">
      <span className="tnum w-5 shrink-0 text-right text-[11px] text-faint">
        {p.jersey}
      </span>
      <span
        className={`min-w-0 truncate text-[12.5px] ${
          p.subbedOut ? "text-muted" : "text-text"
        }`}
      >
        {p.name}
      </span>
      {p.goals > 0 && (
        <span title={`${p.goals}골`} className="shrink-0 text-[10px]">
          ⚽{p.goals > 1 ? p.goals : ""}
        </span>
      )}
      {p.assists > 0 && (
        <span
          title={`도움 ${p.assists}`}
          className="tnum shrink-0 text-[9.5px] font-bold text-sky-400"
        >
          A{p.assists > 1 ? p.assists : ""}
        </span>
      )}
      {p.subbedOut && (
        <span
          title={minute ? `${minute} 교체 아웃` : "교체 아웃"}
          className="tnum shrink-0 text-[10px] text-red-400/80"
        >
          ▼{minute ?? ""}
        </span>
      )}
      {p.subbedIn && (
        <span
          title={minute ? `${minute} 교체 인` : "교체 인"}
          className="tnum shrink-0 text-[10px] text-emerald-400/80"
        >
          ▲{minute ?? ""}
        </span>
      )}
      {/* The source labels every bench player "SUB", which the heading above
          them already says. Only a real position earns the column. */}
      {p.position && p.position !== "SUB" && (
        <span className="ml-auto shrink-0 text-[10.5px] text-faint">
          {p.position}
        </span>
      )}
    </li>
  );
}

function Column({
  name,
  lineup,
  minutes,
}: {
  name: string;
  lineup: Lineup;
  minutes: Record<string, string>;
}) {
  return (
    <div className="min-w-0">
      <h3 className="flex items-baseline justify-between gap-2 pb-2">
        <span className="truncate text-[13px] font-semibold text-text">
          {name}
        </span>
        {lineup.formation && (
          <span className="tnum shrink-0 rounded-[3px] bg-surface-3 px-1.5 py-[1px] text-[11px] font-medium text-muted">
            {lineup.formation}
          </span>
        )}
      </h3>
      <ul className="border-t border-border/60 pt-1.5">
        {lineup.starters.map((p) => (
          <Player key={p.name + p.jersey} p={p} minute={minutes[p.name]} />
        ))}
      </ul>
      {lineup.bench.length > 0 && (
        <>
          <h4 className="pt-3 pb-1 text-[11px] font-medium text-faint">교체 명단</h4>
          <ul className="border-t border-border/60 pt-1.5">
            {lineup.bench.map((p) => (
              <Player key={p.name + p.jersey} p={p} minute={minutes[p.name]} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function Lineups({
  home,
  away,
  homeName,
  awayName,
  events = [],
  bare = false,
}: {
  home: Lineup | null;
  away: Lineup | null;
  homeName: string;
  awayName: string;
  /** Used to put the minute on each substitution. */
  events?: MatchEvent[];
  /** The pitch above already carries the heading and the section rule. */
  bare?: boolean;
}) {
  if (!home && !away) return null;

  /*
   * When each substitution happened, taken from the timeline rather than
   * carried separately: the roster says a player was replaced but not when,
   * and the timeline already has both names against a minute.
   */
  const minutes: Record<string, string> = {};
  for (const e of events) {
    if (e.kind !== "sub") continue;
    if (e.player) minutes[e.player] = e.minute;
    if (e.second) minutes[e.second] = e.minute;
  }

  const inner = (
    <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
      {home && <Column name={homeName} lineup={home} minutes={minutes} />}
      {away && <Column name={awayName} lineup={away} minutes={minutes} />}
    </div>
  );

  if (bare) return <div className="px-[var(--gutter)] pb-5">{inner}</div>;
  return (
    <section className="border-b border-border px-[var(--gutter)] py-5 last:border-b-0">
      <h2 className="pb-3 text-[12px] font-semibold text-muted">선수 명단</h2>
      {inner}
    </section>
  );
}
