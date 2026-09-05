import Link from "next/link";
import type { FmTeam } from "@/lib/fotmob";

/**
 * What happened to the bench, and who was not available at all.
 *
 * The eleven are not listed here. They are already on the pitch above, in their
 * positions, with their numbers and their faces - repeating them as a column of
 * text says nothing the diagram has not already said better. What the diagram
 * cannot show is who came off for whom, who never got on, and who was missing.
 */
function Face({ src, jersey }: { src: string | null; jersey?: string }) {
  return (
    <span className="flex size-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-3">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={26}
          height={26}
          loading="lazy"
          decoding="async"
          className="size-full object-cover object-top"
        />
      ) : (
        <span className="tnum text-[10px] font-semibold text-muted">
          {jersey}
        </span>
      )}
    </span>
  );
}

function Rating({ r }: { r: number | null }) {
  if (r == null) return null;
  const tone =
    r >= 7.5
      ? "bg-emerald-500 text-black"
      : r >= 6.5
        ? "bg-amber-500 text-black"
        : "bg-zinc-500 text-white";
  return (
    <span
      className={`tnum shrink-0 rounded-[3px] px-1 text-[10px] font-bold ${tone}`}
    >
      {r.toFixed(1)}
    </span>
  );
}

function Row({
  id,
  name,
  jersey,
  image,
  rating,
  note,
  minute,
}: {
  id?: number;
  name: string;
  jersey: string;
  image: string | null;
  rating: number | null;
  note?: React.ReactNode;
  minute?: number | null;
}) {
  const inner = (
    <>
      <Face src={image} jersey={jersey} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="tnum shrink-0 text-[10.5px] text-faint">{jersey}</span>
          <span className="truncate text-[12.5px] text-text">{name}</span>
        </div>
        {note && <div className="truncate text-[11px] text-muted">{note}</div>}
      </div>
      <Rating r={rating} />
      {minute != null && (
        <span className="tnum shrink-0 text-[11px] font-semibold text-faint">
          {minute}&apos;
        </span>
      )}
    </>
  );

  return (
    <li>
      {id ? (
        <Link
          href={`/matches/player/${id}`}
          title={`${name} 기록 보기`}
          className="-mx-2 flex items-center gap-2 rounded-[6px] px-2 py-1.5 transition-colors hover:bg-surface-2/50"
        >
          {inner}
        </Link>
      ) : (
        <span className="flex items-center gap-2 py-1.5">{inner}</span>
      )}
    </li>
  );
}

function Side({ title, children }: { title: string; children: React.ReactNode }) {
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

function Block({
  title,
  home,
  away,
  homeName,
  awayName,
}: {
  title: string;
  home: React.ReactNode[];
  away: React.ReactNode[];
  homeName: string;
  awayName: string;
}) {
  if (home.length + away.length === 0) return null;
  return (
    <section className="pt-4">
      <h3 className="pb-2 text-[12px] font-semibold text-muted">{title}</h3>
      <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2">
        <Side title={homeName}>{home}</Side>
        <Side title={awayName}>{away}</Side>
      </div>
    </section>
  );
}

export function Lineups({
  home,
  away,
  homeName,
  awayName,
}: {
  home: FmTeam | null;
  away: FmTeam | null;
  homeName: string;
  awayName: string;
}) {
  if (!home && !away) return null;

  /*
   * A substitution is read from the player who came on.
   *
   * The source marks each player's own minute rather than pairing them, so the
   * one going off is found by his minute - the two halves of a swap share it.
   * Where a partner cannot be found the row still stands on its own, which is
   * right for a straight injury replacement with no matching entry.
   */
  const swaps = (t: FmTeam | null) =>
    (t?.subs ?? [])
      .filter((p) => p.onAt != null)
      .sort((a, b) => (a.onAt ?? 0) - (b.onAt ?? 0))
      .map((on) => {
        const off = t?.starters.find((s) => s.offAt === on.onAt);
        return (
          <Row
            key={on.name + on.jersey}
            id={on.id}
            name={on.name}
            jersey={on.jersey}
            image={on.image}
            rating={on.rating}
            minute={on.onAt}
            note={off ? <>▼ {off.name}</> : null}
          />
        );
      });

  const unused = (t: FmTeam | null) =>
    (t?.subs ?? [])
      .filter((p) => p.onAt == null)
      .map((p) => (
        <Row
          key={p.name + p.jersey}
          id={p.id}
          name={p.name}
          jersey={p.jersey}
          image={p.image}
          rating={null}
        />
      ));

  const out = (t: FmTeam | null) =>
    (t?.unavailable ?? []).map((u) => (
      <Row
        key={u.name}
        name={u.name}
        jersey=""
        image={null}
        rating={null}
        note={u.reason}
      />
    ));

  return (
    <div className="px-[var(--gutter)] pb-5">
      <Block
        title="교체"
        home={swaps(home)}
        away={swaps(away)}
        homeName={homeName}
        awayName={awayName}
      />
      <Block
        title="벤치"
        home={unused(home)}
        away={unused(away)}
        homeName={homeName}
        awayName={awayName}
      />
      <Block
        title="결장"
        home={out(home)}
        away={out(away)}
        homeName={homeName}
        awayName={awayName}
      />
    </div>
  );
}
