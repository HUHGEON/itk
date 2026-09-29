"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { makeBoard, type BoardCell } from "@/lib/games/board";
import type { Grid, GridPlayer } from "@/lib/games/data";
import { forfeit, newMatch, play, tick, type MatchState, type Side } from "@/lib/games/possession";

/**
 * An online Possession Play room, over Supabase Realtime.
 *
 * The host - whoever opened the room - is the referee, as the original's
 * server is: it holds the match, runs the clocks, checks every answer with the
 * same rules as the one-screen game, and sends the result to both sides. The
 * guest only ever sends "I answer this cell with this player" and draws what
 * comes back. Measured on this project's Realtime: a message crosses in about
 * 80ms, and a player who closes the tab drops out of presence at once.
 *
 * Nothing is stored. A room exists while its two browsers are in it.
 */
export type Role = "host" | "guest";

export interface RoomSettings {
  lengthMs: number;
  chaining: boolean;
}

type Phase = "connecting" | "waiting" | "live" | "over" | "full" | "error";

/** Codes without look-alikes (no 0/O, 1/I/L). */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function roomCode(): string {
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  for (const b of bytes) s += ALPHABET[b % ALPHABET.length];
  return s;
}

const clientId = () => crypto.randomUUID().slice(0, 8);

/** How long a vanished opponent has to come back before the game is theirs to lose. */
const GRACE_MS = 20_000;

export function useRoom({
  code,
  role,
  grid,
  settings,
}: {
  code: string;
  role: Role;
  grid: Grid | null;
  settings: RoomSettings;
}) {
  const me = useMemo(clientId, []);
  const mySide: Side = role === "host" ? "p1" : "p2";
  const [state, setState] = useState<MatchState | null>(null);
  const [phase, setPhase] = useState<Phase>("connecting");
  const [opponentHere, setOpponentHere] = useState(false);
  const [goneSince, setGoneSince] = useState<number | null>(null);
  // For the guest: when the last snapshot arrived, so its clock can run on.
  const [receivedAt, setReceivedAt] = useState(0);

  const channel = useRef<RealtimeChannel | null>(null);
  const stateRef = useRef<MatchState | null>(null);
  stateRef.current = state;
  const guestId = useRef<string | null>(null);

  const board: BoardCell[] = useMemo(
    () => (grid && state ? makeBoard(grid, state.seed) : []),
    [grid, state?.seed], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const byId = useMemo(() => new Map(board.map((c) => [c.id, c])), [board]);
  const players = useMemo(() => grid?.players ?? [], [grid]);

  /** Host only: change the match and tell the guest. */
  const commit = useCallback((next: MatchState) => {
    stateRef.current = next;
    setState(next);
    setPhase(next.status === "over" ? "over" : "live");
    channel.current?.send({
      type: "broadcast",
      event: "state",
      payload: { state: next, guest: guestId.current },
    });
  }, []);

  const start = useCallback(() => {
    if (!grid) return;
    const seed = (Math.random() * 2 ** 31) | 0;
    commit(newMatch(makeBoard(grid, seed), seed, settings.lengthMs, settings.chaining));
  }, [grid, settings.lengthMs, settings.chaining, commit]);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb || !grid) {
      if (!sb) setPhase("error");
      return;
    }
    const ch = sb.channel(`pp:${code}`, {
      config: { broadcast: { self: false }, presence: { key: me } },
    });
    channel.current = ch;

    ch.on("presence", { event: "sync" }, () => {
      const here = ch.presenceState<{ role: Role; id: string }>();
      const others = Object.entries(here)
        .filter(([k]) => k !== me)
        .map(([, v]) => v[0]);
      if (role === "host") {
        // The first guest to arrive is the opponent; anyone after is turned away.
        const guest = others.find((o) => o.role === "guest" && (!guestId.current || o.id === guestId.current));
        if (guest && !guestId.current) guestId.current = guest.id;
        const present = !!guest;
        setOpponentHere(present);
        if (present && !stateRef.current) start();
        // A guest who reloads needs the match again.
        else if (present && stateRef.current) commit(stateRef.current);
      } else {
        setOpponentHere(others.some((o) => o.role === "host"));
      }
    });

    ch.on("broadcast", { event: "state" }, ({ payload }) => {
      if (role !== "guest") return;
      const { state: next, guest } = payload as { state: MatchState; guest: string | null };
      if (guest && guest !== me) {
        setPhase("full");
        return;
      }
      if (stateRef.current && next.seed === stateRef.current.seed && next.seq < stateRef.current.seq) return;
      stateRef.current = next;
      setState(next);
      setReceivedAt(performance.now());
      setPhase(next.status === "over" ? "over" : "live");
    });

    ch.on("broadcast", { event: "move" }, ({ payload }) => {
      if (role !== "host") return;
      const { cell, pid, from } = payload as { cell: string; pid: number; from: string };
      const s = stateRef.current;
      if (!s || from !== guestId.current || s.turn !== "p2") return;
      const p = grid.players[pid];
      if (!p) return;
      const b = new Map(makeBoard(grid, s.seed).map((c) => [c.id, c]));
      commit(play(s, b, cell, p));
    });

    ch.on("broadcast", { event: "rematch" }, () => {
      if (role === "host" && stateRef.current?.status === "over") start();
    });

    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ role, id: me });
        setPhase((p) => (p === "connecting" ? "waiting" : p));
      } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        setPhase("error");
      }
    });

    return () => {
      sb.removeChannel(ch);
      channel.current = null;
    };
  }, [code, role, me, grid]); // eslint-disable-line react-hooks/exhaustive-deps

  // The host's clock is the clock. It also re-sends the match every couple of
  // seconds, so the guest's copy of the clocks never drifts far.
  useEffect(() => {
    if (role !== "host" || phase !== "live") return;
    let last = performance.now();
    let sinceSend = 0;
    const id = window.setInterval(() => {
      const s = stateRef.current;
      if (!s) return;
      const now = performance.now();
      const dt = now - last;
      last = now;
      sinceSend += dt;
      const next = tick(s, dt);
      if (next.status !== s.status || sinceSend >= 2000) {
        sinceSend = 0;
        commit(next);
      } else {
        stateRef.current = next;
        setState(next);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [role, phase, commit]);

  // An opponent who disappears mid-game has GRACE_MS to come back.
  useEffect(() => {
    if (phase !== "live") {
      setGoneSince(null);
      return;
    }
    if (opponentHere) {
      setGoneSince(null);
      return;
    }
    const since = Date.now();
    setGoneSince(since);
    const id = window.setTimeout(() => {
      const s = stateRef.current;
      if (!s) return;
      const loser: Side = mySide === "p1" ? "p2" : "p1";
      if (role === "host") commit(forfeit(s, loser));
      else {
        const next = forfeit(s, loser);
        stateRef.current = next;
        setState(next);
        setPhase("over");
      }
    }, GRACE_MS);
    return () => window.clearTimeout(id);
  }, [opponentHere, phase, role, mySide, commit]);

  const answer = useCallback(
    (cell: string, p: GridPlayer) => {
      const s = stateRef.current;
      if (!s || s.status !== "live" || s.turn !== mySide || !grid) return;
      if (role === "host") commit(play(s, byId, cell, p));
      else channel.current?.send({ type: "broadcast", event: "move", payload: { cell, pid: p.id, from: me } });
    },
    [mySide, role, grid, byId, me, commit],
  );

  const rematch = useCallback(() => {
    if (role === "host") start();
    else channel.current?.send({ type: "broadcast", event: "rematch", payload: {} });
  }, [role, start]);

  return { state, phase, board, byId, players, mySide, opponentHere, goneSince, receivedAt, answer, rematch };
}

/**
 * Finding a stranger to play: everyone waiting sits in one presence channel,
 * sorted by when they arrived. The earlier of each pair opens a room and tells
 * the later one its code. Both leave the lobby as soon as they are paired.
 */
export function useMatchmaking(active: boolean, onMatch: (code: string, role: Role) => void) {
  const [waiting, setWaiting] = useState(0);
  const me = useMemo(clientId, []);
  const matched = useRef(false);
  const cb = useRef(onMatch);
  cb.current = onMatch;

  useEffect(() => {
    if (!active) return;
    const sb = supabaseBrowser();
    if (!sb) return;
    matched.current = false;
    const since = Date.now();
    const ch = sb.channel("pp:lobby", { config: { broadcast: { self: false }, presence: { key: me } } });

    const done = (code: string, role: Role) => {
      if (matched.current) return;
      matched.current = true;
      ch.untrack();
      cb.current(code, role);
    };

    ch.on("presence", { event: "sync" }, () => {
      const list = Object.entries(ch.presenceState<{ since: number }>())
        .map(([id, v]) => ({ id, since: v[0].since }))
        .sort((a, b) => a.since - b.since || a.id.localeCompare(b.id));
      setWaiting(list.length);
      const i = list.findIndex((x) => x.id === me);
      if (i >= 0 && i % 2 === 0 && list[i + 1]) {
        const code = roomCode();
        ch.send({ type: "broadcast", event: "match", payload: { guest: list[i + 1].id, code } });
        done(code, "host");
      }
    });
    ch.on("broadcast", { event: "match" }, ({ payload }) => {
      const { guest, code } = payload as { guest: string; code: string };
      if (guest === me) done(code, "guest");
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") ch.track({ since });
    });
    return () => {
      sb.removeChannel(ch);
    };
  }, [active, me]);

  return { waiting };
}
