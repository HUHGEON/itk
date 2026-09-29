import { cellId, neighbours } from "./hex";
import type { BoardCell } from "./board";
import type { GridPlayer } from "./data";

/**
 * The two hex games' rules, as the original implements them.
 *
 * Read from its shipped code rather than inferred from playing it, because the
 * two disagree in places a player would not notice: whether a touching hex
 * already owned by the mover is re-counted, what happens to a stolen hex under
 * chaining, and that The Heatmap takes a point off for a wrong answer.
 */

export type Owner = "none" | "p1" | "p2";

const matches = (p: GridPlayer, c: BoardCell) => p.cats.has(c.cat);

function touching(board: Map<string, BoardCell>, c: BoardCell): BoardCell[] {
  return neighbours(c)
    .map((n) => board.get(cellId(n)))
    .filter((x): x is BoardCell => !!x);
}

/**
 * Every cell connected to `start` through cells the player matches.
 * Breadth-first, so the cells come back in the order the claim spreads - which
 * is the order they flip.
 */
function chain(board: Map<string, BoardCell>, start: BoardCell, p: GridPlayer): BoardCell[] {
  const seen = new Set<string>();
  const out: BoardCell[] = [];
  const queue = [start];
  while (queue.length) {
    const c = queue.shift()!;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    if (!matches(p, c)) continue;
    out.push(c);
    for (const n of touching(board, c)) if (!seen.has(n.id)) queue.push(n);
  }
  return out;
}

export interface PossessionMove {
  valid: boolean;
  /** cells that changed hands, in the order they should flip */
  claimed: string[];
  /** the subset taken from the opponent */
  stolen: string[];
}

/**
 * Possession Play.
 *
 * The selected hex must be neutral and must match. Then every touching hex the
 * player also matches is taken - neutral ones and the opponent's alike - and
 * with chaining on, the claim keeps spreading through matching hexes from
 * there. A hex the mover already owns is never "claimed" again.
 */
export function possessionMove(
  board: Map<string, BoardCell>,
  owners: Map<string, Owner>,
  selected: string,
  p: GridPlayer,
  mover: "p1" | "p2",
  chaining: boolean,
): PossessionMove {
  const cell = board.get(selected);
  if (!cell || owners.get(selected) !== "none" || !matches(p, cell)) {
    return { valid: false, claimed: [], stolen: [] };
  }
  const reach = chaining ? chain(board, cell, p) : [cell, ...touching(board, cell)];
  const other = mover === "p1" ? "p2" : "p1";
  const claimed: string[] = [];
  const stolen: string[] = [];
  for (const c of reach) {
    if (!matches(p, c) || owners.get(c.id) === mover) continue;
    if (owners.get(c.id) === other) stolen.push(c.id);
    claimed.push(c.id);
  }
  return { valid: true, claimed, stolen };
}

export function tally(owners: Map<string, Owner>) {
  let p1 = 0;
  let p2 = 0;
  let none = 0;
  for (const o of owners.values()) {
    if (o === "p1") p1++;
    else if (o === "p2") p2++;
    else none++;
  }
  // The bar shows the share of what has been claimed, not of the whole board,
  // so it starts at 50-50 and the first answer swings it to 100-0.
  const taken = p1 + p2;
  const share = taken === 0 ? 50 : Math.round((p1 / taken) * 100);
  return { p1, p2, none, share };
}

export interface HeatMove {
  valid: boolean;
  fresh: string[];
  reheated: string[];
  points: number;
}

/** 1, 3, 6, 10 … for 1, 2, 3, 4 … new cells in one move. */
export const combo = (n: number) => (n * (n + 1)) / 2;

/**
 * The Heatmap.
 *
 * The selected hex must be unclaimed and must match. Touching hexes the player
 * matches are claimed too if they are new, and "reheated" if they were
 * already claimed - worth a point each and a step hotter on the board. New
 * cells score as a combo, so one answer that opens four hexes is worth ten.
 */
export function heatMove(
  board: Map<string, BoardCell>,
  heat: Map<string, number>,
  selected: string,
  p: GridPlayer,
): HeatMove {
  const cell = board.get(selected);
  if (!cell || (heat.get(selected) ?? 0) > 0 || !matches(p, cell)) {
    return { valid: false, fresh: [], reheated: [], points: 0 };
  }
  const fresh = [cell.id];
  const reheated: string[] = [];
  for (const n of touching(board, cell)) {
    if (!matches(p, n)) continue;
    if ((heat.get(n.id) ?? 0) > 0) reheated.push(n.id);
    else fresh.push(n.id);
  }
  return { valid: true, fresh, reheated, points: combo(fresh.length) + reheated.length };
}

/** Heat shown on the board is capped at seven steps, as the original does. */
export const heatLevel = (h: number) => Math.max(0, Math.min(7, h));
