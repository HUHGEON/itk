"use client";

import type { FmPlayer, FmTeam } from "@/lib/fotmob";
import { role } from "@/lib/pitch";
import { AssistIcon, GoalIcon } from "./MatchIcons";

/**
 * What happened to the bench, and who was not available at all.
 *
 * The eleven are not listed here. They are already on the pitch above, in their
 * positions, with their numbers and their faces - repeating them as a column of
 * text says nothing the diagram has not already said better. What the diagram
 * cannot show is who came on, who never got off the bench, and who was missing.
 *
 * They are cards rather than rows because that is what they are: a face, a
 * name, a position, and for a substitute the minute he arrived and how he did.
 * A row would put all of that on one line and make the face incidental.
 */
function tone(r: number): string {
  if (r >= 7.5) return "bg-emerald-500 text-black";
  if (r >= 6.5) return "bg-amber-500 text-black";
  return "bg-zinc-600 text-white";
}

function Card({
  p,
  onOpen,
  showMinute,
}: {
  p: FmPlayer;
  onOpen?: (id: number) => void;
  /** Substitutes carry the minute they came on; the unused bench does not. */
  showMinute?: boolean;
}) {
  const body = (
    <>
      <span className="relative">
        <span className="block size-12 overflow-hidden rounded-full bg-surface-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={p.image}
            alt=""
            width={48}
            height={48}
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-top"
          />
        </span>

        {showMinute && p.onAt != null && (
          <span className="tnum absolute -top-1 -left-2 rounded-[4px] bg-surface-2 px-1 text-[9.5px] leading-[1.6] font-bold text-emerald-400 ring-1 ring-border">
            {p.onAt}&apos;
          </span>
        )}
        {p.rating != null && (
          <span
            className={`tnum absolute -top-1 -right-2 rounded-[4px] px-1 text-[9.5px] leading-[1.6] font-bold ${tone(p.rating)}`}
          >
            {p.rating.toFixed(1)}
          </span>
        )}
        {p.goals > 0 && (
          <span className="absolute -right-1 -bottom-1 flex items-center rounded-full bg-white px-[3px] py-[1px] text-black">
            <GoalIcon count={p.goals} size={10} />
          </span>
        )}
        {p.goals === 0 && p.assists > 0 && (
          <span className="absolute -right-1 -bottom-1 flex items-center rounded-full bg-sky-400 px-[3px] py-[1px] text-black">
            <AssistIcon count={p.assists} size={10} />
          </span>
        )}
      </span>

      <span className="flex max-w-full items-baseline gap-1">
        <span className="tnum shrink-0 text-[10.5px] text-faint">
          {p.jersey}
        </span>
        <span className="truncate text-[12px] font-medium text-text">
          {p.name.split(" ").slice(-1)[0]}
        </span>
      </span>
      <span className="text-[10.5px] text-faint">{role(p.position)}</span>
    </>
  );

  return (
    <li className="min-w-0">
      {p.id && onOpen ? (
        <button
          type="button"
          onClick={() => onOpen(p.id)}
          title={`${p.name} 기록 보기`}
          className="flex w-full flex-col items-center gap-1 rounded-[6px] px-1 py-2 transition-colors hover:bg-surface-2/50"
        >
          {body}
        </button>
      ) : (
        <span className="flex w-full flex-col items-center gap-1 px-1 py-2">
          {body}
        </span>
      )}
    </li>
  );
}

function Side({
  title,
  players,
  onOpen,
  showMinute,
}: {
  title: string;
  players: FmPlayer[];
  onOpen?: (id: number) => void;
  showMinute?: boolean;
}) {
  if (players.length === 0) return null;
  return (
    <div className="min-w-0">
      <h3 className="truncate pb-1 text-[11.5px] font-semibold text-muted">
        {title}
      </h3>
      <ul className="grid grid-cols-3 gap-x-1 border-t border-border/60 pt-1 sm:grid-cols-4">
        {players.map((p) => (
          <Card
            key={p.name + p.jersey}
            p={p}
            onOpen={onOpen}
            showMinute={showMinute}
          />
        ))}
      </ul>
    </div>
  );
}

function Block({
  title,
  home,
  away,
  homeName,
  awayName,
  onOpen,
  showMinute,
}: {
  title: string;
  home: FmPlayer[];
  away: FmPlayer[];
  homeName: string;
  awayName: string;
  onOpen?: (id: number) => void;
  showMinute?: boolean;
}) {
  if (home.length + away.length === 0) return null;
  return (
    <section className="pt-4">
      <h2 className="pb-2 text-[12px] font-semibold text-muted">{title}</h2>
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        <Side title={homeName} players={home} onOpen={onOpen} showMinute={showMinute} />
        <Side title={awayName} players={away} onOpen={onOpen} showMinute={showMinute} />
      </div>
    </section>
  );
}

export function Lineups({
  home,
  away,
  homeName,
  awayName,
  onOpen,
}: {
  home: FmTeam | null;
  away: FmTeam | null;
  homeName: string;
  awayName: string;
  onOpen?: (id: number) => void;
}) {
  if (!home && !away) return null;

  const used = (t: FmTeam | null) =>
    (t?.subs ?? [])
      .filter((p) => p.onAt != null)
      .sort((a, b) => (a.onAt ?? 0) - (b.onAt ?? 0));
  const unused = (t: FmTeam | null) =>
    (t?.subs ?? []).filter((p) => p.onAt == null);

  return (
    <div className="px-[var(--gutter)] pb-5">
      <Block
        title="교체"
        home={used(home)}
        away={used(away)}
        homeName={homeName}
        awayName={awayName}
        onOpen={onOpen}
        showMinute
      />
      <Block
        title="벤치"
        home={unused(home)}
        away={unused(away)}
        homeName={homeName}
        awayName={awayName}
        onOpen={onOpen}
      />

      {(home?.unavailable.length || away?.unavailable.length) && (
        <section className="pt-5">
          <h2 className="pb-2 text-[12px] font-semibold text-muted">결장</h2>
          <div className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
            {[
              [homeName, home?.unavailable ?? []] as const,
              [awayName, away?.unavailable ?? []] as const,
            ].map(([name, list]) =>
              list.length === 0 ? null : (
                <div key={name} className="min-w-0">
                  <h3 className="truncate pb-1 text-[11.5px] font-semibold text-muted">
                    {name}
                  </h3>
                  <ul className="divide-y divide-border/50 border-t border-border/60">
                    {list.map((u) => (
                      <li
                        key={u.name}
                        className="flex items-baseline justify-between gap-3 py-1.5"
                      >
                        <span className="truncate text-[12.5px] text-muted">
                          {u.name}
                        </span>
                        <span className="shrink-0 text-[11px] text-faint">
                          {u.reason}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}
