"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Globe, Users, DeviceMobile, User, X as XIcon } from "@phosphor-icons/react/dist/ssr";
import { makeBoard, poolGrid, POOLS, type BoardCell, type Pool } from "@/lib/games/board";
import type { Grid } from "@/lib/games/data";
import { cellId, neighbours } from "@/lib/games/hex";
import { possessionMove, tally, type Owner } from "@/lib/games/rules";
import {
  cleanUp,
  newMatch,
  play,
  project,
  tick,
  RANDOM_TURN_MS,
  type MatchState,
  type Side,
} from "@/lib/games/possession";
import { ACCENT, HexBoard, OWNER, over, type HexLook } from "./HexBoard";
import { MobileSheet } from "./MobileSheet";
import { PlayerPicker } from "./PlayerPicker";
import { TechnicalArea } from "./TechnicalArea";
import { HAPTIC, Toast, buzz, useToast } from "./Toast";
import { useGrid, type GridPick } from "./useGrid";
import {
  rememberRole,
  rememberedRole,
  roomCode,
  useMatchmaking,
  useRoom,
  type Role,
  type RoomSettings,
} from "./useRoom";

/* The original's scoreboard colours: blue-200 and rose-200 on the names and
   score, blue-600 and rose-500 in the bar. */
const INK: Record<Side, string> = { p1: "#BFDBFE", p2: "#FECDD3" };
const LOCAL_NAME: Record<Side, string> = { p1: "블루", p2: "레드" };

const LENGTHS = [
  { ms: 240_000, label: "4분", sub: "기본" },
  { ms: 300_000, label: "5분", sub: "길게" },
  { ms: 0, label: "무제한", sub: "시계 없음" },
];

/** m:ss, rounding up - a clock counting down shows 0:01 until it is gone. */
const down = (ms: number) => {
  const s = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
/** m:ss, rounding down - elapsed time. */
const up = (ms: number) => {
  const s = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Mode =
  | { kind: "menu" }
  | { kind: "local" }
  | { kind: "online"; code: string; role: Role; random: boolean }
  | { kind: "searching" };

interface Settings extends RoomSettings {
  pool: Pool;
}

const SEARCH_MS = 240_000;
const RANDOM: Settings = { lengthMs: 0, chaining: false, turnMs: RANDOM_TURN_MS, pool: "all" };

/**
 * Possession Play: the menu and the ways to play it.
 *
 * With a friend (a room and a code to share), against a stranger (a lobby
 * pairs whoever is waiting, 30 seconds a turn), or two people on one screen.
 * All of them play the same match, from lib/games/possession.
 */
export function PossessionGame() {
  const { grid, error } = useGrid();
  const [settings, setSettings] = useState<Settings>({ lengthMs: 240_000, chaining: false, pool: "all" });
  const [mode, setMode] = useState<Mode>({ kind: "menu" });
  const [joinCode, setJoinCode] = useState("");
  const expired = useToast();

  // A random search that finds nobody ends with the original's "Search
  // expired". There the server decides when; its timing is not in the client
  // code, so four minutes here is a choice, not a copy.
  useEffect(() => {
    if (mode.kind !== "searching") return;
    const id = window.setTimeout(() => {
      setMode({ kind: "menu" });
      expired.show("검색 시간이 끝났습니다. 다시 시도하세요.");
    }, SEARCH_MS);
    return () => window.clearTimeout(id);
  }, [mode.kind]); // eslint-disable-line react-hooks/exhaustive-deps

  // A shared link opens straight into the room - as whoever this tab was in
  // it, so a reload is a return rather than a second guest.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("room")?.toUpperCase();
    if (code) setMode({ kind: "online", code, role: rememberedRole(code) ?? "guest", random: false });
  }, []);

  const { waiting } = useMatchmaking(mode.kind === "searching", (code, role) => {
    rememberRole(code, role);
    window.history.replaceState(null, "", `?room=${code}`);
    setMode({ kind: "online", code, role, random: true });
  });

  const toMenu = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setMode({ kind: "menu" });
  };

  const join = (code: string, role: Role) => {
    rememberRole(code, role);
    window.history.replaceState(null, "", `?room=${code}`);
    setMode({ kind: "online", code, role, random: false });
  };

  if (error) return <p className="py-16 text-center text-muted">게임 데이터를 불러오지 못했습니다.</p>;

  if (mode.kind === "local" && grid) return <LocalMatch grid={grid} settings={settings} onMenu={toMenu} />;
  if (mode.kind === "online" && grid)
    return (
      <OnlineMatch
        key={mode.code}
        grid={grid}
        code={mode.code}
        role={mode.role}
        random={mode.random}
        settings={mode.random ? RANDOM : settings}
        onMenu={toMenu}
      />
    );

  const ready = !!grid;
  const card =
    "flex w-full items-center gap-3 rounded-[10px] border border-border bg-surface p-4 text-left transition-colors enabled:hover:border-border-strong enabled:hover:bg-surface-2 disabled:opacity-50";

  return (
    <div className="mx-auto max-w-[520px] space-y-3">
      <Toast message={expired.message} />
      {mode.kind === "searching" ? (
        <div className="rounded-[10px] border border-border-strong bg-surface p-5 text-center">
          <p className="live-badge text-[15px] font-semibold text-text">상대를 찾는 중…</p>
          <p className="tnum mt-1 text-[12.5px] text-muted">지금 대기 중 {waiting}명</p>
          <button type="button" onClick={toMenu} className="mt-3 text-[13px] text-muted underline underline-offset-2 hover:text-text">
            취소
          </button>
        </div>
      ) : (
        <>
          {/* The original puts the code box first: someone holding a code
              should not have to read past three other ways to play. */}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const code = joinCode.trim().toUpperCase();
              if (code.length >= 4) join(code, "guest");
            }}
          >
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="방 코드"
              aria-label="방 코드"
              className="tnum min-w-0 flex-1 rounded-[10px] border border-border-strong bg-surface px-4 py-3 text-[15px] tracking-[0.2em] text-text outline-none placeholder:tracking-normal placeholder:text-faint focus:border-accent"
            />
            <button type="submit" className="rounded-[10px] border border-border-strong px-4 text-[14px] font-semibold text-text hover:bg-surface-2">
              참가
            </button>
          </form>

          <button type="button" disabled={!ready} onClick={() => setMode({ kind: "searching" })} className={card}>
            <Globe className="size-7 shrink-0 text-emerald-400" weight="duotone" />
            <span>
              <span className="block text-[15px] font-semibold text-text">온라인 상대 찾기</span>
              <span className="block text-[12.5px] text-muted">기다리는 사람과 바로 붙습니다. 한 수에 30초입니다.</span>
            </span>
          </button>
          <button type="button" disabled={!ready} onClick={() => join(roomCode(), "host")} className={card}>
            <Users className="size-7 shrink-0 text-[#60A5FA]" weight="duotone" />
            <span>
              <span className="block text-[15px] font-semibold text-text">친구와 하기</span>
              <span className="block text-[12.5px] text-muted">방을 만들고 링크나 코드를 보냅니다</span>
            </span>
          </button>
          <button type="button" disabled={!ready} onClick={() => setMode({ kind: "local" })} className={card}>
            <DeviceMobile className="size-7 shrink-0 text-[#FB7185]" weight="duotone" />
            <span>
              <span className="block text-[15px] font-semibold text-text">한 화면에서 둘이</span>
              <span className="block text-[12.5px] text-muted">한 기기를 번갈아 씁니다</span>
            </span>
          </button>
          <Link href="/games/heatmap" className={card}>
            <User className="size-7 shrink-0 text-amber-400" weight="duotone" />
            <span>
              <span className="block text-[15px] font-semibold text-text">혼자 하기</span>
              <span className="block text-[12.5px] text-muted">같은 보드를 혼자 채우는 히트맵으로</span>
            </span>
          </Link>

          <section className="rounded-[10px] border border-border bg-surface p-4">
            <h2 className="text-[13px] font-semibold text-text">방 설정 (친구와 하기, 한 화면에서 둘이)</h2>
            <p className="mt-2 text-[12px] font-semibold text-muted">시간</p>
            <div className="mt-1 grid grid-cols-3 gap-1.5">
              {LENGTHS.map((l) => (
                <Choice
                  key={l.ms}
                  on={settings.lengthMs === l.ms}
                  onClick={() => setSettings((s) => ({ ...s, lengthMs: l.ms }))}
                  label={l.label}
                  sub={l.sub}
                />
              ))}
            </div>
            <p className="mt-3 text-[12px] font-semibold text-muted">선수 풀</p>
            <div className="mt-1 grid grid-cols-2 gap-1.5">
              {POOLS.map((p) => (
                <Choice
                  key={p.id}
                  on={settings.pool === p.id}
                  onClick={() => setSettings((s) => ({ ...s, pool: p.id }))}
                  label={p.label}
                  sub={p.sub}
                />
              ))}
            </div>
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3">
              <span>
                <span className="block text-[14px] font-semibold text-text">연쇄 점령</span>
                <span className="block text-[12px] text-muted">조건이 맞는 칸이 이어져 있으면 끝까지 따라가며 가져옵니다</span>
              </span>
              <input
                type="checkbox"
                checked={settings.chaining}
                onChange={(e) => setSettings((s) => ({ ...s, chaining: e.target.checked }))}
                className="size-5 shrink-0 accent-[var(--accent)]"
              />
            </label>
          </section>
          <HowTo />
        </>
      )}
    </div>
  );
}

function Choice({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button
      type="button"
      data-press
      onClick={onClick}
      aria-pressed={on}
      className={`rounded-[6px] border px-3 py-2 text-left transition-colors ${
        on ? "border-accent bg-accent/15 text-text" : "border-border text-muted hover:border-border-strong hover:text-text"
      }`}
    >
      <span className="block text-[14px] font-semibold">{label}</span>
      <span className="block text-[11.5px] opacity-80">{sub}</span>
    </button>
  );
}

/* ------------------------------------------------------------------ */

/** Runs a match's clocks on this device: the one-screen game, or a clean-up. */
function useLocalClock(state: MatchState, set: (f: (s: MatchState) => MatchState) => void) {
  useEffect(() => {
    if (state.status !== "live") return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      set((s) => tick(s, dt));
    }, 100);
    return () => window.clearInterval(id);
  }, [state.status, state.seed, state.solo]); // eslint-disable-line react-hooks/exhaustive-deps
}

function LocalMatch({ grid: all, settings, onMenu }: { grid: Grid; settings: Settings; onMenu: () => void }) {
  const grid = useMemo(() => poolGrid(all, settings.pool), [all, settings.pool]);
  const newGame = () => {
    const seed = (Math.random() * 2 ** 31) | 0;
    return newMatch(makeBoard(grid, seed), seed, settings.lengthMs, settings.chaining);
  };
  const [state, setState] = useState<MatchState>(newGame);
  const board = useMemo(() => makeBoard(grid, state.seed), [grid, state.seed]);
  const byId = useMemo(() => new Map(board.map((c) => [c.id, c])), [board]);
  useLocalClock(state, setState);

  return (
    <MatchView
      grid={grid}
      board={board}
      state={state}
      canMove={state.status === "live" && state.kickoff === 0}
      names={LOCAL_NAME}
      onAnswer={(cell, p) => setState((s) => play(s, byId, cell, p))}
      actions={{ again: () => setState(newGame()), againLabel: "새 게임", leave: onMenu, leaveLabel: "나가기" }}
    />
  );
}

function OnlineMatch({
  grid: all,
  code,
  role,
  random,
  settings,
  onMenu,
}: {
  grid: Grid;
  code: string;
  role: Role;
  random: boolean;
  settings: Settings;
  onMenu: () => void;
}) {
  // The pool is the host's to choose; the guest reads it off the match.
  const room = useRoom({ code, role, grid: all, settings, pool: settings.pool });
  const asked = useToast();
  useEffect(() => {
    if (room.rematchAsk.them && !room.rematchAsk.me) asked.show("상대가 재대결을 원합니다");
  }, [room.rematchAsk.them]); // eslint-disable-line react-hooks/exhaustive-deps
  const grid = useMemo(() => poolGrid(all, room.state?.pool ?? settings.pool), [all, room.state?.pool, settings.pool]);
  const [copied, setCopied] = useState(false);
  const [solo, setSolo] = useState<MatchState | null>(null);
  const soloBoard = useMemo(() => (solo ? makeBoard(grid, solo.seed) : []), [grid, solo?.seed]); // eslint-disable-line react-hooks/exhaustive-deps
  const soloById = useMemo(() => new Map(soloBoard.map((c) => [c.id, c])), [soloBoard]);
  useLocalClock(solo ?? ({ status: "over" } as MatchState), (f) => setSolo((s) => (s ? f(s) : s)));

  // The guest's clocks run on between the host's snapshots.
  const [, setNow] = useState(0);
  useEffect(() => {
    if (role !== "guest" || room.phase !== "live") return;
    const id = window.setInterval(() => setNow(performance.now()), 200);
    return () => window.clearInterval(id);
  }, [role, room.phase]);

  const leave = () => {
    room.leave();
    onMenu();
  };

  const link = typeof window === "undefined" ? "" : `${window.location.origin}/games/possession?room=${code}`;

  if (room.phase === "error")
    return <Notice title="연결하지 못했습니다" body="실시간 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도하세요." onMenu={leave} />;
  if (room.phase === "full")
    return <Notice title="이미 누군가 들어간 방입니다" body={`${code} 방에는 이미 두 사람이 있습니다.`} onMenu={leave} />;

  if (solo) {
    return (
      <MatchView
        grid={grid}
        board={soloBoard}
        state={solo}
        mySide={room.mySide}
        canMove={solo.status === "live"}
        names={{ p1: room.mySide === "p1" ? "나" : "상대", p2: room.mySide === "p2" ? "나" : "상대" }}
        onAnswer={(cell, p) => setSolo((s) => (s ? play(s, soloById, cell, p) : s))}
        actions={{ leave, leaveLabel: "나가기" }}
      />
    );
  }

  if (!room.state) {
    return (
      <div className="mx-auto max-w-[520px] rounded-[10px] border border-border-strong bg-surface p-5 text-center">
        {role === "host" && !random ? (
          <>
            <p className="text-[12px] font-bold tracking-[0.2em] text-muted">방 코드:</p>
            <p className="tnum mt-1 text-[34px] font-bold tracking-[0.3em] text-text">{code}</p>
            <p className="mt-3 text-[13px] text-muted">친구에게 이 링크를 보내세요:</p>
            <button
              type="button"
              data-press
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
              className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-[6px] border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-text hover:bg-surface-2"
            >
              <Copy className="size-4 shrink-0" />
              <span className="truncate">{copied ? "링크를 복사했습니다" : link.replace(/^https?:\/\//, "")}</span>
            </button>
            <p className="live-badge mt-4 text-[13px] text-muted">
              {room.phase === "connecting" ? "방을 여는 중…" : "친구가 들어오면 게임이 시작됩니다"}
            </p>
          </>
        ) : (
          <p className="live-badge text-[14px] text-muted">
            {room.phase === "connecting" ? `${code} 방에 연결하는 중…` : "상대를 기다리는 중…"}
          </p>
        )}
        <button type="button" onClick={leave} className="mt-4 text-[13px] text-muted underline underline-offset-2 hover:text-text">
          나가기
        </button>
      </div>
    );
  }

  const s = role === "guest" ? project(room.state, performance.now() - room.receivedAt) : room.state;
  const mine = s.turn === room.mySide;
  const gone = room.goneSince ? Math.max(0, 20 - Math.floor((Date.now() - room.goneSince) / 1000)) : null;
  const result = s.result;
  const canClean =
    s.status === "over" &&
    result?.reason === "forfeit" &&
    result.winner === room.mySide &&
    Object.values(s.owners).some((o) => o === "none");

  return (
    <>
      <Toast message={asked.message} variant="success" />
      <MatchView
        grid={grid}
        board={room.board}
        state={s}
        mySide={room.mySide}
        online={{ me: room.connected, opponent: room.opponentHere }}
        canMove={s.status === "live" && s.kickoff === 0 && mine}
        names={{ p1: room.mySide === "p1" ? "나" : "상대", p2: room.mySide === "p2" ? "나" : "상대" }}
        banner={gone !== null && s.status === "live" ? `상대 연결이 끊겼습니다. ${gone}초 안에 돌아오지 않으면 기권승입니다.` : undefined}
        onAnswer={room.answer}
        actions={{
          again: canClean ? () => setSolo(cleanUp(s, room.mySide)) : result?.reason === "forfeit" ? undefined : room.rematch,
          againLabel: canClean
            ? "정리하기"
            : !room.opponentHere
              ? "상대가 나감"
              : room.rematchAsk.me
                ? "기다리는 중…"
                : room.rematchAsk.them
                  ? "재대결 수락"
                  : "재대결",
          againDisabled: !canClean && (!room.opponentHere || room.rematchAsk.me),
          leave,
          leaveLabel: random ? "새 상대" : "나가기",
        }}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */

/** Hex distances from one cell over the whole board. */
function distances(board: BoardCell[], from: string): Map<string, number> {
  const byId = new Map(board.map((c) => [c.id, c]));
  const dist = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const id = queue.shift()!;
    const c = byId.get(id);
    if (!c) continue;
    for (const n of neighbours(c)) {
      const nid = cellId(n);
      if (byId.has(nid) && !dist.has(nid)) {
        dist.set(nid, dist.get(id)! + 1);
        queue.push(nid);
      }
    }
  }
  return dist;
}

/** The original's pre-flip hold on an opponent's move, and its spread per hex of distance. */
const OPPONENT_HOLD_MS = 1500;
const CHAIN_STEP_MS = 180;
/** chain preview: each ring of distance pulses this much later */
const PULSE_STEP_MS = 280;

/**
 * The board, the scoreboard and the answer box - the same for every mode.
 *
 * The flip, the shake and the alerts are read off `state.last` when
 * `state.seq` moves, so an answer made in another browser plays out here
 * exactly as a local one does.
 */
function MatchView({
  grid,
  board,
  state,
  mySide,
  online,
  canMove,
  names,
  banner,
  onAnswer,
  actions,
}: {
  grid: Grid;
  board: BoardCell[];
  state: MatchState;
  /** online: which side this browser plays */
  mySide?: Side;
  online?: { me: boolean; opponent: boolean };
  canMove: boolean;
  names: Record<Side, string>;
  banner?: string;
  onAnswer: (cell: string, p: GridPick) => void;
  actions: { again?: () => void; againLabel?: string; againDisabled?: boolean; leave: () => void; leaveLabel: string };
}) {
  const items = useMemo<GridPick[]>(
    () => grid.players.map((p) => ({ ...p, key: p.id, sub: p.born ? `${p.born}년생` : undefined })),
    [grid],
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [shake, setShake] = useState({ id: "", nonce: 0 });
  const [endOpen, setEndOpen] = useState(false);
  const toast = useToast();
  const byId = useMemo(() => new Map(board.map((c) => [c.id, c])), [board]);
  const owners = useMemo(() => new Map(Object.entries(state.owners)) as Map<string, Owner>, [state.owners]);
  const count = tally(owners);
  const live = state.status === "live" && state.kickoff === 0;
  const l = state.last;
  const theirs = !!mySide && !!l && l.by !== mySide;

  /*
   * The flip, worked out in the same render as the new owners, so the board
   * never paints the new colours flat before turning them over. An opponent's
   * move waits 1.5s under its reveal before it turns; on chains each hex
   * waits 180ms more per step from the answered one. One's own move turns at
   * once; on one screen, one hex after another, 170ms apart.
   */
  const flip = useMemo(() => {
    if (!l || l.wrong || l.missed || l.claimed.length === 0) return { ids: [] as string[], nonce: state.seq };
    if (!mySide) return { ids: l.claimed, nonce: state.seq };
    const hold = theirs ? OPPONENT_HOLD_MS : 0;
    const dist = state.chaining ? distances(board, l.cell) : null;
    const delays = Object.fromEntries(l.claimed.map((id) => [id, hold + (dist ? (dist.get(id) ?? 0) * CHAIN_STEP_MS : 0)]));
    return { ids: l.claimed, nonce: state.seq, delays };
  }, [state.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only for a move seen arriving: a reload should not replay the last one.
  const firstSeq = useRef(state.seq);
  const reveal =
    theirs && l && !l.wrong && !l.missed && state.seq !== firstSeq.current
      ? { id: l.cell, text: l.player, nonce: state.seq }
      : null;

  const lastSeq = useRef(state.seq);
  useEffect(() => {
    if (state.seq === lastSeq.current) return;
    lastSeq.current = state.seq;
    setSelected(null);
    if (l?.wrong) {
      setShake({ id: l.cell, nonce: state.seq });
      if (!theirs) {
        buzz(HAPTIC.error);
        toast.show(state.solo ? "틀렸습니다. 다른 수를 두세요." : "틀렸습니다. 차례가 넘어갑니다.");
      }
    }
    if (l?.flagged) {
      toast.show(
        !mySide
          ? `${names[l.by]} 시간이 끝났습니다. 남은 칸은 ${names[l.by === "p1" ? "p2" : "p1"]} 혼자 둡니다.`
          : theirs
            ? "상대 시간이 끝났습니다. 남은 칸을 계속 채우세요."
            : "시간이 끝났습니다. 남은 칸은 상대가 둡니다.",
      );
    }
    if (l?.missed && !theirs) {
      toast.show(
        state.status === "over"
          ? "두 번째로 시간을 넘겨 기권패했습니다."
          : mySide
            ? "시간 초과로 차례를 놓쳤습니다. 한 번 더 놓치면 기권패입니다."
            : `${names[l.by]} 시간 초과로 차례가 넘어갑니다.`,
      );
    }
    if (mySide && state.status === "live" && state.turn === mySide && theirs) buzz(HAPTIC.nudge);
    if (state.status === "over") {
      // After the last hexes have turned over.
      const flipEnd = flip.ids.length
        ? Math.max(...flip.ids.map((id, i) => flip.delays?.[id] ?? i * 170)) + 1100
        : 0;
      const t = window.setTimeout(() => setEndOpen(true), flipEnd + 300);
      return () => window.clearTimeout(t);
    }
  }, [state.seq]); // eslint-disable-line react-hooks/exhaustive-deps

  // A new match (rematch, clean-up) closes the result and the selection.
  useEffect(() => {
    setSelected(null);
    setEndOpen(false);
  }, [state.seed, state.solo]);

  const around = useMemo(() => {
    const cell = selected ? byId.get(selected) : undefined;
    return new Set(cell && !state.chaining ? neighbours(cell).map(cellId) : []);
  }, [selected, byId, state.chaining]);

  const pulse = useMemo(() => {
    if (!selected || !state.chaining || !canMove) return null;
    const delays: Record<string, number> = {};
    distances(board, selected).forEach((d, id) => {
      if (d > 0) delays[id] = (d - 1) * PULSE_STEP_MS;
    });
    return { delays, accent: ACCENT[state.turn], key: `${state.seq}:${selected}` };
  }, [selected, state.chaining, state.turn, state.seq, canMove, board]);

  const look = (cell: BoardCell): HexLook => {
    const o = owners.get(cell.id) ?? "none";
    const base = OWNER[o];
    const accent = ACCENT[state.turn];
    let fill: string = base.fill;
    if (o === "none" && live) {
      // Neutral hexes take a tenth of the mover's colour, and a watcher's
      // board is dimmed while the other side thinks.
      fill = over(fill, accent.tint);
      if (!canMove) fill = over(fill, "rgba(15, 23, 42, 0.2)");
    }
    return {
      fill,
      ink: base.ink,
      open: o === "none" && canMove,
      selected: selected === cell.id,
      highlighted: around.has(cell.id),
      accent,
      label: o === "none" ? "중립" : `${names[o]} 소유`,
    };
  };

  const clock = (sd: Side) => {
    const current = state.turn === sd && state.status === "live";
    if (state.turnMs) return current ? down(state.turnMs - state.spent) : down(state.turnMs);
    if (!state.lengthMs) return current ? up(state.spent) : "0:00";
    return down(state.time[sd]);
  };

  const cat = selected ? grid.cats[byId.get(selected)!.cat] : null;
  const placeholder = (mobile: boolean) =>
    !canMove
      ? state.flagged === mySide
        ? "시간이 끝났습니다. 남은 칸은 상대가 둡니다"
        : "상대 차례를 기다리세요…"
      : selected
        ? `${cat!.short}에 맞는 선수를 찾으세요…`
        : mobile
          ? "중립 칸을 골라 시작하세요…"
          : "칸을 골라 시작하세요…";
  const pick = (p: GridPick) => selected && onAnswer(selected, p);
  const badges = selected ? [selected, ...around].filter((id) => owners.get(id) === "none" || id === selected) : [];

  return (
    <div className="mx-auto max-w-[405px]">
      <Toast message={toast.message} />
      {banner && <p className="mb-2 text-center text-[12.5px] text-muted">{banner}</p>}

      <Scoreboard
        names={names}
        count={count}
        clock={clock}
        state={state}
        online={online}
        mySide={mySide}
      />

      <div className="relative mt-3">
        <HexBoard
          board={board}
          cats={grid.cats}
          look={look}
          onSelect={(id) => canMove && owners.get(id) === "none" && setSelected((x) => (x === id ? null : id))}
          flip={flip}
          shake={shake}
          reveal={reveal}
          pulse={pulse}
        />
        {state.status === "live" && state.kickoff > 0 && (
          <Kickoff left={state.kickoff} starter={state.turn} name={names[state.turn]} mine={mySide === state.turn} local={!mySide} />
        )}
      </div>

      <div className="mt-3">
        {state.status === "live" ? (
          <>
            <div className="hidden sm:block">
              <PlayerPicker
                key={`${state.seq}:${state.turn}`}
                items={items}
                onPick={pick}
                disabled={!canMove || !selected}
                autoFocus={!!selected}
                placeholder={placeholder(false)}
              />
            </div>
            {selected && canMove && (
              <MobileSheet onClose={() => setSelected(null)} badges={badges.map((id) => ({ id, label: grid.cats[byId.get(id)!.cat].short, on: id === selected }))}>
                <PlayerPicker items={items} onPick={pick} autoFocus placeholder={placeholder(true)} />
              </MobileSheet>
            )}
            <p className="mt-2 text-center text-[12.5px] text-muted sm:hidden">{placeholder(true)}</p>
          </>
        ) : (
          !endOpen && (
            <button
              type="button"
              data-press
              onClick={() => setEndOpen(true)}
              className="w-full rounded-[10px] border border-border-strong py-3 text-[14px] font-semibold text-text hover:bg-surface-2"
            >
              결과 보기
            </button>
          )
        )}
      </div>

      <TechnicalArea grid={grid} board={board} />

      {endOpen && state.result && (
        <FullTime
          state={state}
          count={count}
          names={names}
          mySide={mySide}
          board={board}
          grid={grid}
          onClose={() => setEndOpen(false)}
          actions={actions}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Where the bar splits. The original keeps a 12px sliver for a side with
 * nothing and never lets the leader fill the bar edge to edge, so both
 * colours always show.
 */
const SEAM = 6;
const split = (a: number, b: number) =>
  a === 0 ? "12px" : a === 100 && b === 0 ? `calc(100% - ${12 + SEAM}px)` : `clamp(0px, calc(${a}% - ${SEAM / 2}px), 100%)`;

function Dot({ on }: { on: boolean }) {
  return (
    <span
      aria-label={on ? "연결됨" : "연결 끊김"}
      className={`inline-block size-2.5 shrink-0 rounded-full ${on ? "bg-emerald-400" : "bg-slate-500"}`}
    />
  );
}

function Scoreboard({
  names,
  count,
  clock,
  state,
  online,
  mySide,
}: {
  names: Record<Side, string>;
  count: { p1: number; p2: number; share: number };
  clock: (s: Side) => string;
  state: MatchState;
  online?: { me: boolean; opponent: boolean };
  mySide?: Side;
}) {
  const pct = { p1: count.share, p2: 100 - count.share };
  const dot = (sd: Side) => (online ? <Dot on={sd === mySide ? online.me : online.opponent} /> : null);
  const side = (sd: Side) => {
    const right = sd === "p2";
    const current = state.turn === sd;
    return (
      <div className={right ? "text-right" : "text-left"}>
        <div
          className={`flex items-center gap-2 text-sm font-black tracking-widest uppercase ${right ? "justify-end" : ""}`}
          style={{ color: INK[sd] }}
        >
          {!right && dot(sd)}
          <span className="truncate">{names[sd]}</span>
          {right && dot(sd)}
        </div>
        <div
          className={`tnum text-lg font-black transition-opacity sm:text-xl ${
            state.status === "live" && !current ? "text-text/60" : "text-text"
          }`}
        >
          {clock(sd)}
        </div>
      </div>
    );
  };
  const spring = "cubic-bezier(0.34, 1.25, 0.64, 1)";
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-3">
        {side("p1")}
        <div className="tnum flex items-center text-center text-3xl leading-none font-black">
          <span style={{ color: INK.p1 }}>{count.p1}</span>
          <span className="px-1 text-text/55">-</span>
          <span style={{ color: INK.p2 }}>{count.p2}</span>
        </div>
        {side("p2")}
      </div>
      <div className="mt-2 overflow-hidden rounded">
        <div className="relative h-4 w-full overflow-hidden bg-[#0f172a]">
          <div className="absolute inset-0 bg-[#f43f5e]" />
          <div
            className="absolute inset-y-0 left-0 bg-[#2563eb]"
            style={{ width: split(pct.p1, pct.p2), transition: `width 600ms ${spring}` }}
          />
          <div
            className="absolute inset-y-0 bg-[#0f172a]"
            style={{ left: split(pct.p1, pct.p2), width: SEAM, transition: `left 600ms ${spring}` }}
          />
        </div>
      </div>
      <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center text-[10px] font-black tracking-[0.18em] uppercase sm:text-[11px]">
        <div className="tnum text-left" style={{ color: INK.p1 }}>
          {pct.p1}%
        </div>
        <div className="text-[#DCE6F2]">점유율</div>
        <div className="tnum text-right" style={{ color: INK.p2 }}>
          {pct.p2}%
        </div>
      </div>
    </div>
  );
}

/* The original's kick-off card: a hex, tinted by who starts, over the board. */
const KICK_HEX = "polygon(50% 6%, 90% 28%, 90% 72%, 50% 94%, 10% 72%, 10% 28%)";
const KICK_TONE: Record<Side, { border: string; glow: string; tint: string; head: string; sub: string }> = {
  p1: { border: "rgba(186, 230, 253, 0.72)", glow: "rgba(56, 189, 248, 0.16)", tint: "rgba(14, 116, 144, 0.16)", head: "#A5F3FC", sub: "#BFDBFE" },
  p2: { border: "rgba(254, 205, 211, 0.72)", glow: "rgba(244, 63, 94, 0.16)", tint: "rgba(159, 18, 57, 0.16)", head: "#FFE4E6", sub: "#FECDD3" },
};

function Kickoff({ left, starter, name, mine, local }: { left: number; starter: Side; name: string; mine: boolean; local: boolean }) {
  const t = KICK_TONE[starter];
  const stage = left <= 650 ? "GO" : left > 2000 ? "3" : left > 1000 ? "2" : "1";
  const who = local ? `${name} 선공` : mine ? "내가 먼저 시작합니다" : "상대가 먼저 시작합니다";
  return (
    <div role="status" aria-live="polite" className="absolute inset-0 z-30 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-950/20" />
      <div
        className="relative h-[226px] w-[236px] shrink-0 sm:h-[248px] sm:w-[264px]"
        style={{ animation: "kickoff-in 360ms cubic-bezier(0.22, 1, 0.36, 1) both" }}
      >
        <div
          className="absolute inset-0"
          style={{
            clipPath: KICK_HEX,
            boxShadow: `0 18px 45px rgba(2, 6, 23, 0.34), 0 0 18px ${t.glow}`,
            background: `linear-gradient(180deg, rgba(15,23,42,0.84) 0%, rgba(2,6,23,0.8) 100%), linear-gradient(180deg, ${t.tint} 0%, ${t.tint} 100%)`,
          }}
        />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polygon points="50,6 90,28 90,72 50,94 10,72 10,28" fill="none" stroke={t.border} strokeWidth="1.75" strokeLinejoin="round" />
        </svg>
        <div className="relative flex h-full flex-col items-center justify-center px-8 text-center text-white sm:px-10" style={{ clipPath: KICK_HEX }}>
          <div className="text-[0.68rem] font-black tracking-[0.34em] uppercase" style={{ color: t.head }}>
            KICK OFF
          </div>
          <div className="mt-3 text-sm font-semibold sm:text-[0.95rem]" style={{ color: t.sub }}>
            {who}
          </div>
          <div className="mt-2 flex min-h-[5.5rem] w-full items-center justify-center">
            <div
              key={stage}
              className={`flex w-full items-center justify-center text-center leading-none font-black text-white ${
                stage === "GO" ? "-mt-3 text-[2.75rem] tracking-[0.08em] sm:text-[3rem]" : "tnum text-[4.9rem] sm:text-[5.5rem]"
              }`}
              style={{
                animation:
                  stage === "GO"
                    ? "kickoff-go 420ms cubic-bezier(0.22, 1, 0.36, 1) both"
                    : "kickoff-num 280ms cubic-bezier(0.22, 1, 0.36, 1) both",
              }}
            >
              {stage}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The best single answers the board allowed: every player at every hex he
 * fits, scored by how many hexes that answer takes from an empty board. The
 * original's "Show Best Moves".
 */
function bestMoves(grid: Grid, board: BoardCell[], chaining: boolean) {
  const byId = new Map(board.map((c) => [c.id, c]));
  const empty = new Map(board.map((c) => [c.id, "none" as Owner]));
  const onBoard = new Set(board.map((c) => c.cat));
  const best: { name: string; count: number }[] = [];
  for (const p of grid.players) {
    let top = 0;
    for (const c of board) {
      if (!p.cats.has(c.cat) || ![...p.cats].some((x) => onBoard.has(x))) continue;
      top = Math.max(top, possessionMove(byId, empty, c.id, p, "p1", chaining).claimed.length);
    }
    if (top > 0) best.push({ name: p.ko, count: top });
  }
  return best.sort((a, b) => b.count - a.count || 0).slice(0, 5);
}

function FullTime({
  state,
  count,
  names,
  mySide,
  board,
  grid,
  onClose,
  actions,
}: {
  state: MatchState;
  count: { p1: number; p2: number; share: number };
  names: Record<Side, string>;
  mySide?: Side;
  board: BoardCell[];
  grid: Grid;
  onClose: () => void;
  actions: { again?: () => void; againLabel?: string; againDisabled?: boolean; leave: () => void; leaveLabel: string };
}) {
  const [top, setTop] = useState<{ name: string; count: number }[] | null>(null);
  const r = state.result!;
  const w = r.winner;
  const my = mySide ?? "p1";
  const op = my === "p1" ? "p2" : "p1";

  let title = r.reason === "time" ? "종료 휘슬" : r.reason === "forfeit" ? "경기 중단" : "풀타임";
  let message: string;
  if (state.solo) {
    title = "정리 완료";
    message = `상대가 나간 뒤 ${up(state.spent)} 만에 보드를 정리했습니다.`;
  } else if (mySide) {
    const won = w === mySide;
    const score = won ? `${count[my]}-${count[op]}` : `${count[op]}-${count[my]}`;
    // A random match's clock is per turn: two misses lose outright. A game
    // clock running out only ends the game once both have, on the board.
    const byBoard = !w ? `무승부 ${count.p1}-${count.p2}` : won ? `승리 ${score}` : `상대 승리 ${score}`;
    message =
      r.reason === "time" && state.turnMs
        ? won
          ? "상대가 두 번 시간을 넘겨 이겼습니다."
          : "두 번 시간을 넘겨 기권패했습니다."
        : r.reason === "time"
          ? `두 시계가 모두 끝났습니다. ${byBoard}`
          : r.reason === "forfeit"
            ? won
              ? "상대가 나가 기권승했습니다."
              : "기권패했습니다."
            : byBoard;
  } else {
    const loser = w === "p1" ? "p2" : "p1";
    const byBoard = !w ? `무승부 ${count.p1}-${count.p2}` : `${names[w]} 승리 ${count[w]}-${count[loser]}`;
    message = r.reason === "time" ? `두 시계가 모두 끝났습니다. ${byBoard}` : byBoard;
  }
  const pct = { p1: count.share, p2: 100 - count.share };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal aria-labelledby="ft-title">
      <button type="button" aria-label="닫기" onClick={onClose} className="absolute inset-0 bg-gray-900/75" />
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-lg bg-gray-800 px-4 pt-5 pb-4 text-left shadow-xl sm:px-6 sm:pb-6"
        style={{ animation: "kickoff-num 300ms ease-out both" }}
      >
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute top-4 right-4 text-white/80 hover:text-white">
          <XIcon className="size-6" />
        </button>
        <div className="text-center text-white">
          <h3 id="ft-title" className="mt-2 text-xl leading-none font-black uppercase">
            {title}
          </h3>
          <p className="mt-3 text-sm font-medium text-white/70">{message}</p>

          <div className="mt-5 rounded-lg bg-black/20 p-4">
            <div className="relative grid grid-cols-2 items-center gap-3 text-sm font-black tracking-[0.18em] uppercase">
              <div className="truncate pr-6 text-left" style={{ color: INK.p1 }}>
                {names.p1}
              </div>
              <div className="tnum absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-sm text-white/40">
                {count.p1}-{count.p2}
              </div>
              <div className="truncate pl-6 text-right" style={{ color: INK.p2 }}>
                {names.p2}
              </div>
            </div>
            <div className="mt-2 overflow-hidden rounded">
              <div className="relative h-4 w-full bg-slate-900">
                <div className="absolute inset-y-0 left-0 bg-[#2563eb]" style={{ width: `${pct.p1}%` }} />
                <div className="absolute inset-y-0 right-0 bg-[#f43f5e]" style={{ width: `${pct.p2}%` }} />
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center text-[11px] font-black tracking-[0.18em] uppercase">
              <div className="tnum text-left" style={{ color: INK.p1 }}>
                {pct.p1}%
              </div>
              <div className="text-white/50">점유율</div>
              <div className="tnum text-right" style={{ color: INK.p2 }}>
                {pct.p2}%
              </div>
            </div>
          </div>

          {top && top.length > 0 && (
            <div className="mt-4 rounded-lg bg-black/20 p-4 text-left">
              <div className="text-[11px] font-black tracking-[0.18em] text-white/50 uppercase">최선의 수 5개</div>
              <div className="mt-3 space-y-2">
                {top.map((m, i) => {
                  const first = top.findIndex((x) => x.count === m.count);
                  return (
                    <div key={`${m.name}-${i}`} className="flex items-center justify-between gap-3 rounded-md bg-white/5 px-3 py-2">
                      <div className="flex min-w-0 items-center text-sm font-semibold text-white">
                        <span className="mr-2 shrink-0 text-white/40">{first === i ? first + 1 : "-"}</span>
                        <span className="min-w-0 flex-1 truncate">{m.name}</span>
                      </div>
                      <div className="shrink-0 text-xs font-black tracking-[0.14em] text-[#ceff27] uppercase">{m.count}칸</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className={`mt-5 grid gap-2 ${actions.again ? "grid-cols-2" : "grid-cols-1"}`}>
            <button
              type="button"
              onClick={actions.leave}
              className="flex items-center justify-center rounded-md bg-rose-600 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-700 sm:text-base"
            >
              {actions.leaveLabel}
            </button>
            {actions.again && (
              <button
                type="button"
                onClick={actions.again}
                disabled={actions.againDisabled}
                className="flex items-center justify-center rounded-md bg-indigo-600 py-2 text-sm font-bold text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60 sm:text-base"
              >
                {actions.againLabel}
              </button>
            )}
          </div>
          {!top && (
            <button
              type="button"
              onClick={() => setTop(bestMoves(grid, board, state.chaining))}
              className="mt-2 w-full rounded-md bg-[#ceff27] py-2 text-sm font-bold text-slate-900 hover:bg-[#ceff27]/90 sm:text-base"
            >
              최선의 수 보기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Notice({ title, body, onMenu }: { title: string; body: string; onMenu: () => void }) {
  return (
    <div className="mx-auto max-w-[520px] rounded-[10px] border border-border-strong bg-surface p-5 text-center">
      <p className="text-[16px] font-semibold text-text">{title}</p>
      <p className="mt-1 text-[13px] text-muted">{body}</p>
      <button type="button" onClick={onMenu} className="mt-3 text-[13px] text-muted underline underline-offset-2 hover:text-text">
        처음으로
      </button>
    </div>
  );
}

function HowTo() {
  return (
    <section className="rounded-[10px] border border-border p-4 text-[13.5px] leading-relaxed text-muted">
      <h2 className="mb-1.5 text-[14px] font-semibold text-text">하는 법</h2>
      <p>
        번갈아 가며 중립 칸을 하나 고르고, 그 칸 조건에 맞는 선수를 댑니다. 그 선수가{" "}
        <b className="text-text">맞닿은 칸의 조건에도 맞으면</b> 그 칸들도 같이 가져오고, 상대 칸이면 뺏어 옵니다.
      </p>
      <p className="mt-1.5">각자 시계가 있고, 자기 차례에만 흐릅니다.</p>
      <p className="mt-1.5">
        시간이 다 된 쪽은 더 둘 수 없고, 남은 쪽이 혼자 이어서 둡니다. 판이 다 차거나 남은 시계도 끝나면 칸이 많은
        쪽이 이깁니다.
      </p>
      <p className="mt-1.5">랜덤 매치는 한 수에 30초입니다. 두 번 시간을 넘기면 기권패입니다.</p>
      <p className="mt-1.5">31칸이 모두 차면 더 많이 가진 쪽이 이깁니다.</p>
      <p className="mt-2 text-[12px] text-faint">한글, 영문, 초성으로 검색할 수 있습니다. 예: 손흥민, Son, ㅅㅎㅁ</p>
    </section>
  );
}
