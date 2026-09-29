import type { BoardCell, Pool } from "./board";
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
  /** the clock ran out on a per-turn match and the turn passed with no answer */
  missed?: boolean;
  /** this side's game clock ran out; the other plays on alone */
  flagged?: boolean;
}

export interface MatchState {
  seed: number;
  owners: Record<string, Owner>;
  turn: Side;
  /** ms left on each clock at the moment the state was produced */
  time: Record<Side, number>;
  lengthMs: number;
  /**
   * Random matches: a clock per turn rather than per game. The original gives
   * 30 seconds, passes the turn when they run out and forfeits the second
   * miss ("You missed a turn. Miss one more and you forfeit.").
   */
  turnMs: number;
  /** ms spent on the current turn; an untimed game shows it counting up */
  spent: number;
  misses: Record<Side, number>;
  /** ms left on the kick-off countdown; no one moves until it reaches 0 */
  kickoff: number;
  chaining: boolean;
  /** which players the board was drawn from; absent means all */
  pool?: Pool;
  /**
   * Clean-up: the opponent forfeited with hexes still neutral, and the winner
   * fills the rest alone - the original's "Clean Up". The turn never passes.
   */
  solo?: Side;
  /**
   * A side whose game clock has run out. It makes no more moves; the other
   * side keeps playing the neutral hexes on its own clock, and the game ends
   * when the board is full or that clock runs out too - decided on hexes, not
   * on who ran out first. (The original ends it on the spot for the side with
   * time left; players here found that a win for a clock rather than a board.)
   */
  flagged?: Side;
  status: "live" | "over";
  result: { winner: Side | null; reason: "board" | "time" | "forfeit" } | null;
  last: LastMove | null;
  /** increments on every change, so a receiver can drop stale snapshots */
  seq: number;
}

export const other = (s: Side): Side => (s === "p1" ? "p2" : "p1");

export const KICKOFF_MS = 3000;
export const RANDOM_TURN_MS = 30_000;

export function newMatch(
  board: BoardCell[],
  seed: number,
  lengthMs: number,
  chaining: boolean,
  turnMs = 0,
  pool: Pool = "all",
): MatchState {
  return {
    seed,
    owners: Object.fromEntries(board.map((c) => [c.id, "none" as Owner])),
    // Either side may kick off, as in the original; the seed decides, so both
    // browsers agree.
    turn: seed & 1 ? "p2" : "p1",
    time: { p1: lengthMs, p2: lengthMs },
    lengthMs,
    turnMs,
    spent: 0,
    misses: { p1: 0, p2: 0 },
    kickoff: KICKOFF_MS,
    chaining,
    pool,
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
  if (s.status !== "live" || s.kickoff > 0) return s;
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
  if (!move.valid) {
    if (s.solo || s.flagged) return { ...s, last, seq: s.seq + 1 };
    return { ...s, turn: other(s.turn), spent: 0, last, seq: s.seq + 1 };
  }

  for (const id of move.claimed) owners.set(id, s.turn);
  const t = tally(owners);
  const next: MatchState = { ...s, owners: Object.fromEntries(owners), last, seq: s.seq + 1 };
  if (t.none === 0) return { ...next, status: "over", result: { winner: leader(next), reason: "board" } };
  if (s.solo || s.flagged) return next;
  return { ...next, turn: other(s.turn), spent: 0 };
}

/**
 * Time passes. The kick-off countdown first; then the side to move spends it,
 * from its game clock if there is one and from its turn clock if there is one.
 */
export function tick(s: MatchState, dt: number): MatchState {
  if (s.status !== "live") return s;
  if (s.kickoff > 0) return { ...s, kickoff: Math.max(0, s.kickoff - dt) };
  const spent = s.spent + dt;

  if (s.turnMs && spent >= s.turnMs) {
    const misses = { ...s.misses, [s.turn]: s.misses[s.turn] + 1 };
    const last: LastMove = { by: s.turn, player: "", cell: "", claimed: [], stolen: [], wrong: false, missed: true };
    if (misses[s.turn] >= 2) {
      return { ...s, misses, spent, last, status: "over", result: { winner: other(s.turn), reason: "time" }, seq: s.seq + 1 };
    }
    return { ...s, misses, spent: 0, last, turn: other(s.turn), seq: s.seq + 1 };
  }

  if (!s.lengthMs) return { ...s, spent };
  const left = s.time[s.turn] - dt;
  if (left > 0) return { ...s, spent, time: { ...s.time, [s.turn]: left } };
  const time = { ...s.time, [s.turn]: 0 };
  const last: LastMove = { by: s.turn, player: "", cell: "", claimed: [], stolen: [], wrong: false, flagged: true };
  // Both clocks gone: the board decides.
  if (s.flagged) {
    return { ...s, spent, time, last, status: "over", result: { winner: leader(s), reason: "time" }, seq: s.seq + 1 };
  }
  // One gone: the other plays on alone.
  return { ...s, spent: 0, time, last, flagged: s.turn, turn: other(s.turn), seq: s.seq + 1 };
}

/** Who holds more hexes, or null on a tie. */
function leader(s: MatchState): Side | null {
  const t = tally(new Map(Object.entries(s.owners)));
  return t.p1 === t.p2 ? null : t.p1 > t.p2 ? "p1" : "p2";
}

export function forfeit(s: MatchState, loser: Side): MatchState {
  if (s.status !== "live") return s;
  return { ...s, status: "over", result: { winner: other(loser), reason: "forfeit" }, seq: s.seq + 1 };
}

/** The forfeit winner carries on alone to fill the board. */
export function cleanUp(s: MatchState, side: Side): MatchState {
  return {
    ...s,
    solo: side,
    turn: side,
    lengthMs: 0,
    turnMs: 0,
    spent: 0,
    kickoff: 0,
    status: "live",
    result: null,
    last: null,
    seq: s.seq + 1,
  };
}

/**
 * The same state `dt` later, for drawing only: clocks run down, but nothing
 * that belongs to the referee - a missed turn, a flag falling - happens here.
 * The guest draws its clocks with this between the host's snapshots.
 */
export function project(s: MatchState, dt: number): MatchState {
  if (s.status !== "live" || dt <= 0) return s;
  const k = Math.min(s.kickoff, dt);
  const rest = dt - k;
  return {
    ...s,
    kickoff: s.kickoff - k,
    spent: s.turnMs ? Math.min(s.turnMs, s.spent + rest) : s.spent + rest,
    time: s.lengthMs ? { ...s.time, [s.turn]: Math.max(0, s.time[s.turn] - rest) } : s.time,
  };
}
