import type { Lineup, LineupPlayer } from "@/lib/matches";

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
function Player({ p }: { p: LineupPlayer }) {
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
      {p.subbedOut && (
        <span title="교체 아웃" className="shrink-0 text-[10px] text-red-400/80">
          ▼
        </span>
      )}
      {p.subbedIn && (
        <span title="교체 인" className="shrink-0 text-[10px] text-emerald-400/80">
          ▲
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

function Column({ name, lineup }: { name: string; lineup: Lineup }) {
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
          <Player key={p.name + p.jersey} p={p} />
        ))}
      </ul>
      {lineup.bench.length > 0 && (
        <>
          <h4 className="pt-3 pb-1 text-[11px] font-medium text-faint">교체 명단</h4>
          <ul className="border-t border-border/60 pt-1.5">
            {lineup.bench.map((p) => (
              <Player key={p.name + p.jersey} p={p} />
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
  bare = false,
}: {
  home: Lineup | null;
  away: Lineup | null;
  homeName: string;
  awayName: string;
  /** The pitch above already carries the heading and the section rule. */
  bare?: boolean;
}) {
  if (!home && !away) return null;

  const inner = (
    <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
      {home && <Column name={homeName} lineup={home} />}
      {away && <Column name={awayName} lineup={away} />}
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
