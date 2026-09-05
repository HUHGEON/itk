import type { Lineup, LineupPlayer } from "@/lib/matches";

/**
 * Where each player stands.
 *
 * The source does not give coordinates. It gives a formation string and a
 * position code per player, and `formationPlace` turns out not to be a layout
 * order at all - measured on a 4-2-3-1, place 4 was the left midfielder while
 * places 5 and 6 were the two centre-backs. So the position codes are what the
 * shape is built from.
 *
 * Two readings do it. Depth comes from the position family, which sorts the
 * eleven from goalkeeper to striker; the formation string then says how many
 * belong on each line, so the sorted list is simply sliced by those numbers.
 * Verified against both teams of a finished match: Liverpool's 4-2-3-1 sliced
 * to G / RB-LB-CD-R-CD-L / LM-RM / AM-R-AM-AM-L / F, and Forest's 3-4-2-1 to
 * G / three centre-backs / four midfielders / two CFs / F. Both exact.
 *
 * Width comes from the suffix: a code ending -L stands left of one ending -R,
 * and a bare code stands between them. Full-backs and wide midfielders carry
 * their side in the code itself.
 */

/** Sort key from goalkeeper forward. Unknown codes land in midfield. */
function depth(pos: string): number {
  const p = pos.toUpperCase();
  if (p === "G" || p.startsWith("GK")) return 0;
  if (/^(C?D|CB|[LR]B|[LR]D|[LR]WB|SW)/.test(p)) return 10;
  if (p.startsWith("DM") || p.startsWith("CDM")) return 20;
  if (/^(CM|[LR]M|M)/.test(p)) return 30;
  if (p.startsWith("AM") || p.startsWith("CAM") || /^[LR]W/.test(p)) return 40;
  if (p.startsWith("CF")) return 45;
  if (/^(F|S|ST)/.test(p)) return 50;
  return 30;
}

/** Negative is the viewer's left, positive the right, zero the middle. */
function side(pos: string): number {
  const p = pos.toUpperCase();
  if (p.endsWith("-L")) return -1;
  if (p.endsWith("-R")) return 1;
  if (/^L/.test(p)) return -2;
  if (/^R/.test(p)) return 2;
  return 0;
}

export interface Spot extends LineupPlayer {
  /** 0 at the left touchline, 1 at the right. */
  x: number;
  /** 0 on this team's own goal line, 1 at the halfway line. */
  y: number;
}

/**
 * Turns an eleven into pitch positions, or null when the shape cannot be read.
 *
 * A formation whose numbers do not add up to the players present is not forced
 * into a diagram - a wrong picture of a lineup is worse than a list, and the
 * list is what the caller falls back to.
 */
export function spots(lineup: Lineup): Spot[] | null {
  const eleven = lineup.starters;
  const lines = (lineup.formation ?? "")
    .split("-")
    .map((n) => Number(n.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (lines.length === 0) return null;
  if (lines.reduce((a, b) => a + b, 0) + 1 !== eleven.length) return null;

  const ordered = [...eleven].sort(
    (a, b) => depth(a.position) - depth(b.position),
  );
  const keeper = ordered[0];
  const rest = ordered.slice(1);

  // Bands are laid between the goal line and the halfway line, with the
  // goalkeeper on his line and the front band short of the halfway line so the
  // two teams' attackers do not collide in the middle.
  const out: Spot[] = [
    { ...keeper, x: 0.5, y: 0.06 },
  ];
  let taken = 0;
  lines.forEach((count, band) => {
    const row = rest.slice(taken, taken + count);
    taken += count;
    const y = 0.2 + (band / Math.max(lines.length - 1, 1)) * 0.72;
    const across = [...row].sort((a, b) => side(a.position) - side(b.position));
    // A pair holds the middle rather than the touchlines: a double pivot in a
    // 4-2-3-1 is labelled LM and RM, and spreading it to the flanks drew two
    // holding midfielders standing on the wings.
    const spread = count <= 2 ? 0.42 : 0.76;
    across.forEach((p, i) => {
      const x = count === 1 ? 0.5 : 0.5 - spread / 2 + (i / (count - 1)) * spread;
      out.push({ ...p, x, y });
    });
  });
  return out;
}

/** Surname only. Eleven full names do not fit across a pitch. */
export function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0] : parts[parts.length - 1];
}

/**
 * Two colours that will not be mistaken for each other.
 *
 * Clubs pick their own first colour and neighbours often land on the same one:
 * measured on Liverpool against Nottingham Forest, the source gives d11317 and
 * c8102e, two reds nineteen units apart, which drew twenty-two identical
 * tokens. When the first colours are that close the away side falls back to its
 * change colour, and failing that to a neutral slate, so the two elevens are
 * always told apart.
 */
export function kitColours(
  home: { color: string | null; color2: string | null },
  away: { color: string | null; color2: string | null },
): { home: string; away: string } {
  const h = home.color ?? "334155";
  const dist = (a: string, b: string) => {
    const n = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
    return (
      Math.abs(n(a, 0) - n(b, 0)) +
      Math.abs(n(a, 2) - n(b, 2)) +
      Math.abs(n(a, 4) - n(b, 4))
    );
  };
  const TOO_CLOSE = 120;
  for (const c of [away.color, away.color2, "e2e8f0", "334155"]) {
    if (c && dist(h, c) >= TOO_CLOSE) return { home: h, away: c };
  }
  return { home: h, away: away.color ?? "334155" };
}
