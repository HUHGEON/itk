import { cells, cellId, neighbours, type Cell } from "./hex";
import { pairKey, type Grid, type CatKind } from "./data";
import { rng, shuffle } from "./seed";

/**
 * Laying categories out on the hexes.
 *
 * Every pair of touching hexes has to share at least two players, which is the
 * rule the original ships as `neighbourMinPlayerLimit: 2`. Without it the
 * whole point of the game - one answer spilling into the hexes around it -
 * would be impossible on half the board. The pairs are precomputed at build
 * time, so this is a constraint search over a lookup table.
 *
 * The mix is bounded per kind so a board reads like the original's: mostly
 * clubs, a handful of nations, a couple of leagues, one or two of the rest.
 */
const QUOTA: Record<CatKind, number> = {
  club: 15,
  nation: 7,
  league: 4,
  region: 2,
  award: 2,
  decade: 2,
  position: 1,
};

export interface BoardCell extends Cell {
  cat: number;
}

/**
 * A board for a seed, always.
 *
 * About one seed in twelve paints itself into a corner (measured: 17 of 200),
 * usually with a scarce award or region left for the last cells. A daily board
 * cannot fail, so a stuck seed hands over to the next one in a fixed sequence -
 * still the same board for everyone on the same day.
 */
export function makeBoard(
  grid: Grid,
  seed: number,
  skip?: { q: number; r: number },
): BoardCell[] {
  for (let k = 0; k < 50; k++) {
    const board = tryBoard(grid, seed + k * 7919, skip);
    if (board) return board;
  }
  throw new Error("could not lay out a board");
}

function tryBoard(
  grid: Grid,
  seed: number,
  skip?: { q: number; r: number },
): BoardCell[] | null {
  const layout = cells(skip);
  const byId = new Map(layout.map((c) => [c.id, c]));
  const random = rng(seed);

  // Well-known categories more often: a hex nobody can answer is dead weight.
  const weighted = shuffle(
    grid.cats.map((c, i) => ({ i, kind: c.kind, w: Math.log(c.n + 1) * (0.6 + random()) })),
    random,
  ).sort((a, b) => b.w - a.w);

  for (let attempt = 0; attempt < 40; attempt++) {
    const placed = new Map<string, number>();
    const used = new Set<number>();
    const count: Partial<Record<CatKind, number>> = {};
    let ok = true;

    for (const cell of layout) {
      const touching = neighbours(cell)
        .map((n) => placed.get(cellId(n)))
        .filter((x): x is number => x !== undefined);
      const pool = weighted.filter(
        (c) =>
          !used.has(c.i) &&
          (count[c.kind] ?? 0) < QUOTA[c.kind] &&
          touching.every((t) => grid.pairs.has(pairKey(t, c.i))),
      );
      if (pool.length === 0) {
        ok = false;
        break;
      }
      // Some randomness beyond the ordering, so two boards from nearby seeds
      // do not open with the same corner.
      const pick = pool[Math.floor(random() ** 2 * Math.min(pool.length, 12))];
      placed.set(cell.id, pick.i);
      used.add(pick.i);
      count[pick.kind] = (count[pick.kind] ?? 0) + 1;
    }
    if (ok) return layout.map((c) => ({ ...byId.get(c.id)!, cat: placed.get(c.id)! }));
  }
  return null;
}
