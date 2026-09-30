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
 * The mix of kinds is the original's, measured rather than guessed: twelve of
 * its daily boards (games 93-104), counted by category type. Each board here
 * takes one of those twelve as its recipe - clubs, trophies, nations and
 * regions, leagues, groups - so the spread from board to board is the
 * original's spread too, not an average.
 */
type Family = "club" | "trophy" | "country" | "league" | "group";
const FAMILY: Record<CatKind, Family> = {
  club: "club",
  trophy: "trophy",
  nation: "country",
  region: "country",
  league: "league",
  group: "group",
};
const RECIPES: Record<Family, number>[] = [
  [15, 7, 4, 3, 1], [15, 8, 6, 1, 0], [15, 6, 4, 2, 3], [16, 7, 1, 6, 0],
  [18, 5, 3, 2, 2], [17, 5, 5, 1, 2], [19, 4, 6, 0, 1], [17, 7, 4, 2, 0],
  [13, 9, 4, 2, 2], [18, 5, 4, 1, 2], [16, 7, 4, 2, 1], [17, 7, 3, 2, 1],
].map(([club, trophy, country, league, group]) => ({ club, trophy, country, league, group }));

/*
 * A nation and a region that holds it are one question asked twice: every
 * Scotland answer is also a 켈트 국가 answer, and the two side by side on a
 * board were called out as odd. Measured from the players rather than listed
 * by hand - a nation is "inside" a region when 90% or more of its players are
 * in the region too - and the pair never shares a board.
 */
const inside = new WeakMap<Grid, Map<number, Set<number>>>();
function nested(grid: Grid): Map<number, Set<number>> {
  const hit = inside.get(grid);
  if (hit) return hit;
  const nations = grid.cats.flatMap((c, i) => (c.kind === "nation" ? [i] : []));
  const regions = grid.cats.flatMap((c, i) => (c.kind === "region" ? [i] : []));
  const both = new Map<string, number>();
  const size = new Map<number, number>();
  for (const p of grid.players) {
    for (const n of nations) {
      if (!p.cats.has(n)) continue;
      size.set(n, (size.get(n) ?? 0) + 1);
      for (const r of regions) if (p.cats.has(r)) both.set(`${n}:${r}`, (both.get(`${n}:${r}`) ?? 0) + 1);
    }
  }
  const out = new Map<number, Set<number>>();
  const link = (a: number, b: number) => (out.get(a) ?? out.set(a, new Set()).get(a)!).add(b);
  for (const n of nations)
    for (const r of regions)
      if ((both.get(`${n}:${r}`) ?? 0) >= 0.9 * (size.get(n) ?? Infinity)) {
        link(n, r);
        link(r, n);
      }
  inside.set(grid, out);
  return out;
}

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
  /** keep a nation and its region apart (see `nested`); off only to replay old daily boards unchanged */
  separateNested = true,
): BoardCell[] {
  for (let k = 0; k < 50; k++) {
    const board = tryBoard(grid, seed + k * 7919, skip, separateNested);
    if (board) return board;
  }
  throw new Error("could not lay out a board");
}

function tryBoard(
  grid: Grid,
  seed: number,
  skip: { q: number; r: number } | undefined,
  separateNested: boolean,
): BoardCell[] | null {
  const layout = cells(skip);
  const byId = new Map(layout.map((c) => [c.id, c]));
  const random = rng(seed);
  const clash = separateNested ? nested(grid) : new Map<number, Set<number>>();

  // Well-known categories more often: a hex nobody can answer is dead weight.
  const weighted = shuffle(
    grid.cats
      .map((c, i) => ({ i, family: FAMILY[c.kind], n: c.n, w: Math.log(c.n + 1) * (0.6 + random()) }))
      // A pool can leave a category with almost nobody in it (a sub-grid
      // recounts `n`), and a hex three people can answer is not a hex.
      .filter((c) => c.n >= 3),
    random,
  ).sort((a, b) => b.w - a.w);

  const recipe = { ...RECIPES[Math.floor(random() * RECIPES.length)] };
  // The recipes are for thirty hexes; a thirty-one-hex board gets one more club.
  recipe.club += layout.length - 30;

  for (let attempt = 0; attempt < 60; attempt++) {
    // Past twenty tries, let each family run one over its share.
    const slack = attempt < 20 ? 0 : 1;
    const placed = new Map<string, number>();
    const used = new Set<number>();
    const count: Record<Family, number> = { club: 0, trophy: 0, country: 0, league: 0, group: 0 };
    let ok = true;

    for (const cell of layout) {
      const touching = neighbours(cell)
        .map((n) => placed.get(cellId(n)))
        .filter((x): x is number => x !== undefined);
      const fits = weighted.filter(
        (c) =>
          !used.has(c.i) &&
          ![...(clash.get(c.i) ?? [])].some((x) => used.has(x)) &&
          touching.every((t) => grid.pairs.has(pairKey(t, c.i))),
      );
      // Which family this hex is for: the ones still short, in proportion to
      // how short they are.
      const need = (Object.keys(count) as Family[])
        .map((f) => ({ f, k: recipe[f] + slack - count[f] }))
        .filter(({ f, k }) => k > 0 && fits.some((c) => c.family === f));
      if (need.length === 0) {
        ok = false;
        break;
      }
      let r = random() * need.reduce((a, x) => a + x.k, 0);
      const family = need.find((x) => (r -= x.k) < 0)?.f ?? need[need.length - 1].f;
      const pool = fits.filter((c) => c.family === family);
      // Some randomness beyond the ordering, so two boards from nearby seeds
      // do not open with the same corner.
      const pick = pool[Math.floor(random() ** 2 * Math.min(pool.length, 8))];
      placed.set(cell.id, pick.i);
      used.add(pick.i);
      count[family]++;
    }
    if (ok) return layout.map((c) => ({ ...byId.get(c.id)!, cat: placed.get(c.id)! }));
  }
  return null;
}

/**
 * Which players a match draws on - the original's "player pool" choice,
 * Global or English Top Flight.
 */
export type Pool = "all" | "eng";
export const POOLS: { id: Pool; label: string; sub: string }[] = [
  { id: "all", label: "전체", sub: "모든 선수" },
  { id: "eng", label: "잉글랜드 1부", sub: "EPL에서 뛴 선수만" },
];

const pooled = new WeakMap<Grid, Map<Pool, Grid>>();

/**
 * The grid narrowed to one pool: only its players, every category's count
 * redone over them, and the touching-pair table rebuilt, because two clubs
 * that share a dozen players worldwide may share one in England. The league
 * that defines the pool is dropped - everyone in it would fit.
 */
export function poolGrid(grid: Grid, pool: Pool): Grid {
  if (pool === "all") return grid;
  let byPool = pooled.get(grid);
  if (!byPool) pooled.set(grid, (byPool = new Map()));
  const hit = byPool.get(pool);
  if (hit) return hit;

  const defining = grid.cats.findIndex((c) => c.id === "lg-eng");
  const players = grid.players.filter((p) => p.cats.has(defining));
  const n = new Array(grid.cats.length).fill(0);
  const shared = new Map<string, number>();
  for (const p of players) {
    const v = [...p.cats].filter((c) => c !== defining);
    for (const a of v) n[a]++;
    for (let i = 0; i < v.length; i++)
      for (let j = i + 1; j < v.length; j++) {
        const k = pairKey(v[i], v[j]);
        shared.set(k, (shared.get(k) ?? 0) + 1);
      }
  }
  const out: Grid = {
    ...grid,
    cats: grid.cats.map((c, i) => ({ ...c, n: i === defining ? 0 : n[i] })),
    pairs: new Set([...shared].filter(([, k]) => k >= 2).map(([key]) => key)),
    players,
  };
  byPool.set(pool, out);
  return out;
}
