import type { MatchSide } from "@/lib/matches";

/**
 * Both elevens on a pitch.
 *
 * The two halves face each other: on a phone the pitch stands up and the home
 * side holds the bottom, on a wider screen it lies down and the home side holds
 * the left, which is the order the scoreline above already put them in.
 *
 * Positions are given rather than guessed wherever the richer source has the
 * match. Where it does not, they are worked out from the formation string and
 * the position codes, which is close but not exact - a diagram built from a
 * guess is worth having, and worth replacing when the real thing turns up.
 */
export interface PitchPlayer {
  name: string;
  jersey: string;
  /** 0-1 across the pitch, 0-1 from this team's own goal line to halfway. */
  x: number;
  y: number;
  rating: number | null;
  image: string | null;
  goals: number;
  assists: number;
  /** Minute he went off, if he did. */
  offAt: number | null;
}

/** Surname only. Eleven full names do not fit across a pitch. */
function short(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : parts[parts.length - 1];
}

/**
 * A rating's colour.
 *
 * The number alone makes a reader do arithmetic against a scale they have to
 * remember. Three bands do the reading for them: a poor match, an ordinary one,
 * and a good one.
 */
function ratingTone(r: number): string {
  if (r >= 7.5) return "bg-emerald-500 text-black";
  if (r >= 6.5) return "bg-amber-500 text-black";
  return "bg-zinc-500 text-white";
}

function Token({ p, tint }: { p: PitchPlayer; tint: string }) {
  /*
   * Held clear of the touchlines.
   *
   * A token is centred on its point, so a goalkeeper on his own goal line lost
   * half of himself off the edge. The band is inset four per cent at the back
   * and stops short of halfway, which also keeps the two strikers from landing
   * on each other in the centre circle.
   */
  const near = `${4 + p.y * 44}%`;
  const far = `${96 - p.y * 44}%`;
  const across = `${p.x * 100}%`;
  const away = tint === "away";

  return (
    <li
      className="pitch-token flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={
        {
          "--vx": across,
          "--vy": away ? near : far,
          "--hx": away ? far : near,
          "--hy": across,
        } as React.CSSProperties
      }
    >
      <span className="relative">
        <span className="flex size-10 items-center justify-center overflow-hidden rounded-full bg-zinc-700 sm:size-12">
          {p.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.image}
              alt=""
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
              className="size-full object-cover object-top"
            />
          ) : (
            <span className="tnum text-[14px] font-bold text-white sm:text-[16px]">
              {p.jersey || "-"}
            </span>
          )}
        </span>

        {p.rating != null && (
          <span
            className={`tnum absolute -right-1.5 -bottom-1 rounded-[4px] px-[3.5px] text-[9.5px] leading-[1.55] font-bold ${ratingTone(p.rating)}`}
          >
            {p.rating.toFixed(1)}
          </span>
        )}

        {p.goals > 0 && (
          <span
            title={`${p.goals}골`}
            className="absolute -top-1 -left-1.5 flex items-center gap-[1px] rounded-full bg-white px-[3px] text-[9px] leading-[1.5] font-bold text-black"
          >
            ⚽{p.goals > 1 && <span className="tnum">{p.goals}</span>}
          </span>
        )}
        {p.goals === 0 && p.assists > 0 && (
          <span
            title={`도움 ${p.assists}`}
            className="tnum absolute -top-1 -left-1.5 rounded-full bg-sky-400 px-[3.5px] text-[9px] leading-[1.6] font-bold text-black"
          >
            A{p.assists > 1 ? p.assists : ""}
          </span>
        )}
        {p.offAt != null && (
          <span
            title={`${p.offAt}분 교체 아웃`}
            className="tnum absolute -top-1 -right-1.5 rounded-full bg-zinc-800 px-[3px] text-[8.5px] leading-[1.6] font-bold text-red-300"
          >
            ←{p.offAt}&apos;
          </span>
        )}
      </span>

      <span className="flex max-w-[86px] items-baseline gap-1 sm:max-w-[104px]">
        <span className="tnum shrink-0 text-[10px] font-semibold text-white/60">
          {p.jersey}
        </span>
        <span className="truncate text-[10.5px] leading-[1.4] font-medium text-white sm:text-[11.5px]">
          {short(p.name)}
        </span>
      </span>
    </li>
  );
}

function Badge({
  side,
  formation,
  rating,
  coach,
}: {
  side: MatchSide;
  formation: string | null;
  rating: number | null;
  coach: string | null;
}) {
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-muted">
      <span className="truncate">{side.name}</span>
      {formation && <span className="tnum shrink-0 text-faint">{formation}</span>}
      {rating != null && (
        <span
          className={`tnum shrink-0 rounded-[3px] px-1 text-[10.5px] font-bold ${ratingTone(rating)}`}
        >
          {rating.toFixed(1)}
        </span>
      )}
      {coach && (
        <span className="hidden truncate text-faint sm:inline">· {coach}</span>
      )}
    </span>
  );
}

export function Pitch({
  home,
  away,
  homeSide,
  awaySide,
  homeMeta,
  awayMeta,
}: {
  home: PitchPlayer[] | null;
  away: PitchPlayer[] | null;
  homeSide: MatchSide;
  awaySide: MatchSide;
  homeMeta: { formation: string | null; rating: number | null; coach: string | null };
  awayMeta: { formation: string | null; rating: number | null; coach: string | null };
}) {
  // Only a pitch both shapes can be read onto. One side missing leaves half a
  // diagram, which says less than the lists below it.
  if (!home || !away) return null;

  return (
    <div className="px-[var(--gutter)] pb-4">
      <div className="flex items-center justify-between gap-3 pb-2 text-[11.5px] sm:hidden">
        <Badge side={awaySide} {...awayMeta} />
        <Badge side={homeSide} {...homeMeta} />
      </div>
      <div className="hidden items-center justify-between gap-3 pb-2 text-[11.5px] sm:flex">
        <Badge side={homeSide} {...homeMeta} />
        <Badge side={awaySide} {...awayMeta} />
      </div>

      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-[8px] border border-border sm:aspect-[16/9]"
        /*
         * A dark, near-neutral ground rather than green grass.
         *
         * Twenty-two photographs on a bright pitch fight the faces for
         * attention, and every board that shows portraits sits them on
         * something quiet. The banding is kept, barely, so it still reads as a
         * pitch rather than a panel.
         */
        style={{
          background:
            "repeating-linear-gradient(to bottom, #1c1c20 0 8.333%, #202024 8.333% 16.666%)",
        }}
      >
        <span aria-hidden className="absolute inset-2 rounded-[2px] border border-white/15" />
        <span aria-hidden className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/15 sm:hidden" />
        <span aria-hidden className="absolute inset-y-2 left-1/2 hidden w-px -translate-x-1/2 bg-white/15 sm:block" />
        <span aria-hidden className="absolute top-1/2 left-1/2 size-[16%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 sm:size-[22%]" />
        <span aria-hidden className="absolute top-2 left-1/2 h-[13%] w-[44%] -translate-x-1/2 border border-t-0 border-white/15 sm:hidden" />
        <span aria-hidden className="absolute bottom-2 left-1/2 h-[13%] w-[44%] -translate-x-1/2 border border-b-0 border-white/15 sm:hidden" />
        <span aria-hidden className="absolute top-1/2 left-2 hidden h-[52%] w-[14%] -translate-y-1/2 border border-l-0 border-white/15 sm:block" />
        <span aria-hidden className="absolute top-1/2 right-2 hidden h-[52%] w-[14%] -translate-y-1/2 border border-r-0 border-white/15 sm:block" />

        <ul className="absolute inset-0">
          {away.map((p) => (
            <Token key={`a${p.name}${p.jersey}`} p={p} tint="away" />
          ))}
          {home.map((p) => (
            <Token key={`h${p.name}${p.jersey}`} p={p} tint="home" />
          ))}
        </ul>
      </div>
    </div>
  );
}
