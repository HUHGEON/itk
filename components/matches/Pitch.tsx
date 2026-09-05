import type { Lineup, MatchSide } from "@/lib/matches";
import { kitColours, shortName, spots, type Spot } from "@/lib/pitch";

/**
 * Both elevens on a pitch.
 *
 * The home side defends the bottom edge and the away side the top, which is how
 * a formation is drawn everywhere and means the two shapes meet in the middle
 * the way they do in the match.
 *
 * There are no player photographs. Measured before building this: the source
 * publishes no headshot for a footballer at any endpoint - not on the athlete
 * record, not on the roster entry, and the usual headshot path 404s for every
 * player tried. What it does publish is a rendered shirt in the club's colours
 * carrying the squad number, and that number in the club's colour is what a
 * token is here. It is a quarter of a megabyte per player as an image, so the
 * colour and the number are drawn rather than fetched.
 */
function Token({
  p,
  color,
  away,
  face,
}: {
  p: Spot;
  color: string;
  away: boolean;
  /** Cut-out photograph, when one could be confirmed for this player. */
  face?: string;
}) {
  const bg = `#${color}`;
  /*
   * Held clear of the touchlines.
   *
   * A token is centred on its point, so a goalkeeper on his own goal line lost
   * half of himself off the edge of the pitch. The band is inset four per cent
   * at the back and stops short of halfway, which also keeps the two strikers
   * from landing on each other in the centre circle.
   */
  const top = away ? 4 + p.y * 44 : 96 - p.y * 44;
  return (
    <li
      className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={{ left: `${p.x * 100}%`, top: `${top}%` }}
    >
      {/*
       * The number rides outside the disc, not on top of it.
       *
       * Laid over a photograph it sat on the player's chin and the disc's own
       * clipping cut it in half. Outside, it reads at a glance and the face
       * keeps the whole circle.
       */}
      <span className="relative">
        <span
          className="flex size-9 items-center justify-center overflow-hidden rounded-full ring-2 ring-black/25 sm:size-11"
          style={{ background: bg }}
        >
          {face ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={face}
              alt=""
              width={44}
              height={44}
              loading="lazy"
              decoding="async"
              className="size-full object-cover object-top"
            />
          ) : (
            <span
              className="tnum text-[13px] font-bold text-white sm:text-[15px]"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,.55)" }}
            >
              {p.jersey || "-"}
            </span>
          )}
        </span>
        {face && p.jersey && (
          <span
            className="tnum absolute -right-1.5 -bottom-1 rounded-full px-[4px] text-[9.5px] leading-[1.5] font-bold text-white ring-1 ring-black/40"
            style={{ background: bg }}
          >
            {p.jersey}
          </span>
        )}
      </span>
      <span className="max-w-[74px] truncate rounded-[3px] bg-black/50 px-1 text-[10px] leading-[1.4] font-medium text-white sm:max-w-[92px] sm:text-[11px]">
        {shortName(p.name)}
      </span>
      {p.subbedOut && (
        <span
          title="교체 아웃"
          className="absolute -top-1 -right-1 text-[9px] text-red-300"
        >
          ▼
        </span>
      )}
    </li>
  );
}

export function Pitch({
  home,
  away,
  homeSide,
  awaySide,
  faces = {},
}: {
  home: Lineup | null;
  away: Lineup | null;
  homeSide: MatchSide;
  awaySide: MatchSide;
  /** Photographs by player name. Absent names fall back to their number. */
  faces?: Record<string, string>;
}) {
  const h = home ? spots(home) : null;
  const a = away ? spots(away) : null;
  const kit = kitColours(homeSide, awaySide);
  // Only a pitch both shapes can be read onto. One side missing leaves half a
  // diagram, which says less than the lists below it.
  if (!h || !a) return null;

  return (
    <div className="px-[var(--gutter)] pb-4">
      <div className="flex items-center justify-between pb-2 text-[11.5px]">
        <span className="flex items-center gap-1.5 text-muted">
          {awaySide.name}
          <span className="tnum text-faint">{away?.formation}</span>
        </span>
        <span className="flex items-center gap-1.5 text-muted">
          <span className="tnum text-faint">{home?.formation}</span>
          {homeSide.name}
        </span>
      </div>

      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-[8px] border border-border sm:aspect-[4/3]"
        style={{
          background:
            "repeating-linear-gradient(to bottom, #14532d 0 8.333%, #166534 8.333% 16.666%)",
        }}
      >
        {/* Markings. Drawn rather than imaged so they stay crisp at any size. */}
        <span
          aria-hidden
          className="absolute inset-2 rounded-[2px] border border-white/25"
        />
        <span
          aria-hidden
          className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/25"
        />
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 size-[18%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25"
        />
        <span
          aria-hidden
          className="absolute top-2 left-1/2 h-[13%] w-[44%] -translate-x-1/2 border border-t-0 border-white/25"
        />
        <span
          aria-hidden
          className="absolute bottom-2 left-1/2 h-[13%] w-[44%] -translate-x-1/2 border border-b-0 border-white/25"
        />

        <ul className="absolute inset-0">
          {a.map((p) => (
            <Token
              key={`a${p.name}${p.jersey}`}
              p={p}
              color={kit.away}
              face={faces[p.name]}
              away
            />
          ))}
          {h.map((p) => (
            <Token
              key={`h${p.name}${p.jersey}`}
              p={p}
              color={kit.home}
              face={faces[p.name]}
              away={false}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
