import type { Lineup, MatchSide } from "@/lib/matches";
import { kitColours, shortName, spots, type Spot } from "@/lib/pitch";

/**
 * Both elevens on a pitch.
 *
 * The two halves face each other: on a phone the pitch stands up and the home
 * side holds the bottom, on a wider screen it lies down and the home side holds
 * the left, which is the order the scoreline above already put them in.
 *
 * There are no player ratings here. The reference computes its own and does not
 * publish them; nothing in the free data carries a rating for a footballer.
 * What the source does carry per player is goals and assists, so those are the
 * marks on a token - a fact rather than a judgement.
 *
 * Photographs come from elsewhere and only when the club could be confirmed;
 * a player without one keeps his number in a disc of the club's colour.
 */
function Token({
  p,
  color,
  away,
  face,
  minute,
}: {
  p: Spot;
  color: string;
  away: boolean;
  /** Portrait, when one could be confirmed for this player. */
  face?: string;
  /** Minute he came off, for the substitution marker. */
  minute?: string;
}) {
  const bg = `#${color}`;
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


  return (
    <li
      className="pitch-token flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
      style={
        {
          // Standing: away at the top, home at the bottom.
          "--vx": across,
          "--vy": away ? near : far,
          // Lying down: home on the left, away on the right.
          "--hx": away ? far : near,
          "--hy": across,
        } as React.CSSProperties
      }
    >
      <span className="relative">
        {/*
         * A portrait in a circle, which is how every board that has faces
         * draws them.
         *
         * The disc behind is neutral, not the club's colour: a photograph
         * sitting on a red or blue fill reads as pasted on, and the two halves
         * of the pitch already say which side a player is on. A player with no
         * portrait keeps his number here instead.
         */}
        <span
          className="flex size-10 items-center justify-center overflow-hidden rounded-full sm:size-12"
          style={{ background: face ? "#3f3f46" : bg }}
        >
          {face ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={face}
              alt=""
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
              className="size-full object-cover object-top"
            />
          ) : (
            <span
              className="tnum text-[14px] font-bold text-white sm:text-[16px]"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,.55)" }}
            >
              {p.jersey || "-"}
            </span>
          )}
        </span>

        {p.goals > 0 && (
          <span
            title={`${p.goals}골`}
            className="absolute -right-1 -bottom-1 flex items-center gap-[1px] rounded-full bg-white px-[3px] text-[9px] leading-[1.5] font-bold text-black ring-1 ring-black/30"
          >
            ⚽{p.goals > 1 && <span className="tnum">{p.goals}</span>}
          </span>
        )}
        {p.goals === 0 && p.assists > 0 && (
          <span
            title={`도움 ${p.assists}`}
            className="tnum absolute -right-1 -bottom-1 rounded-full bg-sky-400 px-[3.5px] text-[9px] leading-[1.6] font-bold text-black ring-1 ring-black/30"
          >
            A{p.assists > 1 ? p.assists : ""}
          </span>
        )}
        {p.subbedOut && (
          <span
            title={minute ? `${minute} 교체 아웃` : "교체 아웃"}
            className="tnum absolute -top-1 -left-1 rounded-full bg-zinc-800 px-[3px] text-[8.5px] leading-[1.6] font-bold text-red-300 ring-1 ring-black/40"
          >
            ←{minute ?? ""}
          </span>
        )}
      </span>

      {/* Number and surname on one line, the way a team sheet is read. */}
      <span className="flex max-w-[86px] items-baseline gap-1 sm:max-w-[104px]">
        <span className="tnum shrink-0 text-[10px] font-semibold text-white/60">
          {p.jersey}
        </span>
        <span className="truncate text-[10.5px] leading-[1.4] font-medium text-white sm:text-[11.5px]">
          {shortName(p.name)}
        </span>
      </span>
    </li>
  );
}

/** One club's name and shape, as a label beside the pitch. */
function Badge({ side, formation }: { side: MatchSide; formation?: string | null }) {
  return (
    <span className="flex items-center gap-1.5 text-muted">
      <span className="truncate">{side.name}</span>
      {formation && <span className="tnum text-faint">{formation}</span>}
    </span>
  );
}

export function Pitch({
  home,
  away,
  homeSide,
  awaySide,
  faces = {},
  minutes = {},
}: {
  home: Lineup | null;
  away: Lineup | null;
  homeSide: MatchSide;
  awaySide: MatchSide;
  /** Photographs by player name. Absent names fall back to their number. */
  faces?: Record<string, string>;
  /** Substitution minute by player name. */
  minutes?: Record<string, string>;
}) {
  const h = home ? spots(home) : null;
  const a = away ? spots(away) : null;
  const kit = kitColours(homeSide, awaySide);
  // Only a pitch both shapes can be read onto. One side missing leaves half a
  // diagram, which says less than the lists below it.
  if (!h || !a) return null;

  return (
    <div className="px-[var(--gutter)] pb-4">
      {/* Standing, the away side is at the top; lying down, the home side is on
          the left. The labels follow the pitch rather than contradicting it. */}
      <div className="flex items-center justify-between pb-2 text-[11.5px] sm:hidden">
        <Badge side={awaySide} formation={away?.formation} />
        <Badge side={homeSide} formation={home?.formation} />
      </div>
      <div className="hidden items-center justify-between pb-2 text-[11.5px] sm:flex">
        <Badge side={homeSide} formation={home?.formation} />
        <Badge side={awaySide} formation={away?.formation} />
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
        {/* Markings, drawn rather than imaged so they stay crisp at any size.
            The halfway line and the two boxes turn with the pitch. */}
        <span
          aria-hidden
          className="absolute inset-2 rounded-[2px] border border-white/15"
        />
        <span
          aria-hidden
          className="absolute inset-x-2 top-1/2 h-px -translate-y-1/2 bg-white/15 sm:hidden"
        />
        <span
          aria-hidden
          className="absolute inset-y-2 left-1/2 hidden w-px -translate-x-1/2 bg-white/15 sm:block"
        />
        <span
          aria-hidden
          className="absolute top-1/2 left-1/2 size-[16%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/15 sm:size-[22%]"
        />
        <span
          aria-hidden
          className="absolute top-2 left-1/2 h-[13%] w-[44%] -translate-x-1/2 border border-t-0 border-white/15 sm:hidden"
        />
        <span
          aria-hidden
          className="absolute bottom-2 left-1/2 h-[13%] w-[44%] -translate-x-1/2 border border-b-0 border-white/15 sm:hidden"
        />
        <span
          aria-hidden
          className="absolute top-1/2 left-2 hidden h-[52%] w-[14%] -translate-y-1/2 border border-l-0 border-white/15 sm:block"
        />
        <span
          aria-hidden
          className="absolute top-1/2 right-2 hidden h-[52%] w-[14%] -translate-y-1/2 border border-r-0 border-white/15 sm:block"
        />

        <ul className="absolute inset-0">
          {a.map((p) => (
            <Token
              key={`a${p.name}${p.jersey}`}
              p={p}
              color={kit.away}
              face={faces[p.name]}
              minute={minutes[p.name]}
              away
            />
          ))}
          {h.map((p) => (
            <Token
              key={`h${p.name}${p.jersey}`}
              p={p}
              color={kit.home}
              face={faces[p.name]}
              minute={minutes[p.name]}
              away={false}
            />
          ))}
        </ul>
      </div>
    </div>
  );
}
