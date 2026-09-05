import type { Lineup, LineupPlayer, MatchEvent } from "@/lib/matches";
import { role } from "@/lib/pitch";

/**
 * What happened to the bench.
 *
 * The eleven are not listed here. They are already on the pitch above, in their
 * positions, with their numbers and their faces - repeating them as a column of
 * text says nothing the diagram has not already said better. What the diagram
 * cannot show is who came off for whom, and who never got on, so that is what
 * is underneath it.
 */
function Face({ face }: { face?: string }) {
  return (
    <span className="size-[26px] shrink-0 overflow-hidden rounded-full bg-surface-3">
      {face && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={face}
          alt=""
          width={26}
          height={26}
          loading="lazy"
          decoding="async"
          className="size-full object-cover object-top"
        />
      )}
    </span>
  );
}

/** One substitution: who came on, who came off, and when. */
function Swap({
  on,
  off,
  minute,
  faces,
}: {
  on: string;
  off: string | null;
  minute: string;
  faces: Record<string, string>;
}) {
  return (
    <li className="flex items-center gap-2 py-1.5">
      <Face face={faces[on]} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="shrink-0 text-[10px] text-emerald-400">▲</span>
          <span className="truncate text-[12.5px] text-text">{on}</span>
        </div>
        {off && (
          <div className="flex items-baseline gap-1.5">
            <span className="shrink-0 text-[10px] text-red-400/80">▼</span>
            <span className="truncate text-[11.5px] text-muted">{off}</span>
          </div>
        )}
      </div>
      <span className="tnum shrink-0 text-[11.5px] font-semibold text-faint">
        {minute}
      </span>
    </li>
  );
}

function Benched({ p, face }: { p: LineupPlayer; face?: string }) {
  return (
    <li className="flex items-center gap-2 py-1">
      <Face face={face} />
      <span className="tnum w-5 shrink-0 text-right text-[11px] text-faint">
        {p.jersey}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
        {p.name}
      </span>
      <span className="shrink-0 text-[10.5px] text-faint">
        {role(p.position)}
      </span>
    </li>
  );
}

function Side({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <h4 className="truncate pb-1 text-[11.5px] font-semibold text-muted">
        {title}
      </h4>
      <ul className="divide-y divide-border/50 border-t border-border/60">
        {children}
      </ul>
    </div>
  );
}

export function Lineups({
  home,
  away,
  homeName,
  awayName,
  events = [],
  faces = {},
}: {
  home: Lineup | null;
  away: Lineup | null;
  homeName: string;
  awayName: string;
  /** Where the substitutions and their minutes come from. */
  events?: MatchEvent[];
  /** Portraits by player name, shared with the pitch. */
  faces?: Record<string, string>;
}) {
  if (!home && !away) return null;

  const subs = (side: "home" | "away") =>
    events.filter((e) => e.kind === "sub" && e.side === side && e.player);

  // Someone who never came on. A bench of nine where five were used leaves four
  // worth listing; repeating the five would duplicate the section above.
  const unused = (l: Lineup | null) =>
    (l?.bench ?? []).filter((p) => !p.subbedIn);

  const anySub = subs("home").length + subs("away").length > 0;
  const anyBench = unused(home).length + unused(away).length > 0;
  if (!anySub && !anyBench) return null;

  return (
    <div className="px-[var(--gutter)] pb-5">
      {anySub && (
        <section className="pt-4">
          <h3 className="pb-2 text-[12px] font-semibold text-muted">교체</h3>
          <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
            <Side title={homeName}>
              {subs("home").map((e) => (
                <Swap
                  key={e.id}
                  on={e.player!}
                  off={e.second}
                  minute={e.minute}
                  faces={faces}
                />
              ))}
            </Side>
            <Side title={awayName}>
              {subs("away").map((e) => (
                <Swap
                  key={e.id}
                  on={e.player!}
                  off={e.second}
                  minute={e.minute}
                  faces={faces}
                />
              ))}
            </Side>
          </div>
        </section>
      )}

      {anyBench && (
        <section className="pt-5">
          <h3 className="pb-2 text-[12px] font-semibold text-muted">벤치</h3>
          <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
            <Side title={homeName}>
              {unused(home).map((p) => (
                <Benched key={p.name + p.jersey} p={p} face={faces[p.name]} />
              ))}
            </Side>
            <Side title={awayName}>
              {unused(away).map((p) => (
                <Benched key={p.name + p.jersey} p={p} face={faces[p.name]} />
              ))}
            </Side>
          </div>
        </section>
      )}
    </div>
  );
}
