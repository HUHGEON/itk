import type { BoardCell } from "./board";
import type { GridPlayer } from "./data";
import { possessionMove, tally, type Owner } from "./rules";

/**
 * A Possession Play match as plain data, so the same state can live on one
 * screen or travel between two browsers.
 *
 * Everything that decides the game is here and nowhere else: the move, the
 * lost turn on a wrong answer, the clock, the end. The local mode applies it
 * directly; the online mode applies it on the host and sends the result. The
 * board itself is not in the state - it is rebuilt from `seed`, which every
 * browser turns into the same 31 hexes.
 */
export type Side = "p1" | "p2";

export interface LastMove {
  by: Side;
  player: string;
  cell: string;
  /** cells that changed hands, in flip order; empty on a wrong answer */
  claimed: string[];
  stolen: string[];
  wrong: boolean;
}

export interface MatchState {
  seed: number;
  owners: Record<string, Owner>;
  turn: Side;
  /** ms left on each clock at the moment the state was produced */
  time: Record<Side, number>;
  lengthMs: number;
  chaining: boolean;
  status: "live" | "over";
  result: { winner: Side | null; reason: "board" | "time" | "forfeit" } | null;
  last: LastMove | null;
  /** increments on every change, so a receiver can drop stale snapshots */
  seq: number;
}

export const other = (s: Side): Side => (s === "p1" ? "p2" : "p1");

export function newMatch(board: BoardCell[], seed: number, lengthMs: number, chaining: boolean): MatchState {
  return {
    seed,
    owners: Object.fromEntries(board.map((c) => [c.id, "none" as Owner])),
    turn: "p1",
    time: { p1: lengthMs, p2: lengthMs },
    lengthMs,
    chaining,
    status: "live",
    result: null,
    last: null,
    seq: 1,
  };
}

/** One answer. A wrong one loses the turn; a right one may end the game. */
export function play(
  s: MatchState,
  byId: Map<string, BoardCell>,
  cell: string,
  p: GridPlayer,
): MatchState {
  if (s.status !== "live") return s;
  const owners = new Map(Object.entries(s.owners));
  const move = possessionMove(byId, owners, cell, p, s.turn, s.chaining);
  const last: LastMove = {
    by: s.turn,
    player: p.ko,
    cell,
    claimed: move.claimed,
    stolen: move.stolen,
    wrong: !move.valid,
  };
  if (!move.valid) return { ...s, turn: other(s.turn), last, seq: s.seq + 1 };

  for (const id of move.claimed) owners.set(id, s.turn);
  const t = tally(owners);
  const next: MatchState = { ...s, owners: Object.fromEntries(owners), last, seq: s.seq + 1 };
  if (t.none === 0) {
    return {
      ...next,
      status: "over",
      result: { winner: t.p1 === t.p2 ? null : t.p1 > t.p2 ? "p1" : "p2", reason: "board" },
    };
  }
  return { ...next, turn: other(s.turn) };
}

/** The side to move spends `dt`; at zero it loses. Untimed games never do. */
export function tick(s: MatchState, dt: number): MatchState {
  if (s.status !== "live" || !s.lengthMs) return s;
  const left = s.time[s.turn] - dt;
  if (left > 0) return { ...s, time: { ...s.time, [s.turn]: left } };
  return {
    ...s,
    time: { ...s.time, [s.turn]: 0 },
    status: "over",
    result: { winner: other(s.turn), reason: "time" },
    seq: s.seq + 1,
  };
}

export function forfeit(s: MatchState, loser: Side): MatchState {
  if (s.status !== "live") return s;
  return { ...s, status: "over", result: { winner: other(loser), reason: "forfeit" }, seq: s.seq + 1 };
}
