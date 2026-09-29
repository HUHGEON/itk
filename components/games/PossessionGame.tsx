"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { Copy, Globe, Users, DeviceMobile } from "@phosphor-icons/react/dist/ssr";
import { makeBoard, type BoardCell } from "@/lib/games/board";
import { cellId, neighbours } from "@/lib/games/hex";
import { tally } from "@/lib/games/rules";
import { newMatch, play, tick, type MatchState, type Side } from "@/lib/games/possession";
import { reducedMotion } from "@/lib/motion";
import { HexBoard, type HexLook } from "./HexBoard";
import { PlayerPicker } from "./PlayerPicker";
import { useGrid, type GridPick } from "./useGrid";
import { roomCode, useMatchmaking, useRoom, type Role, type RoomSettings } from "./useRoom";

const SIDE: Record<Side, { name: string; colour: string }> = {
  p1: { name: "블루", colour: "var(--p1)" },
  p2: { name: "레드", colour: "var(--p2)" },
};

const LENGTHS = [
  { ms: 240_000, label: "4분", sub: "기본" },
  { ms: 300_000, label: "5분", sub: "길게" },
  { ms: 0, label: "무제한", sub: "시계 없음" },
];

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Mode =
  | { kind: "menu" }
  | { kind: "local" }
  | { kind: "online"; code: string; role: Role; random: boolean }
  | { kind: "searching" };

/**
 * Possession Play: the menu and the three ways to play it.
 *
 * With a friend (a room and a code to share), against a stranger (a lobby
 * pairs whoever is waiting), or two people on one screen - the original's
 * three modes. All three play the same match, from lib/games/possession.
 */
export function PossessionGame() {
  const { grid, items, error } = useGrid();
  const [settings, setSettings] = useState<RoomSettings>({ lengthMs: 240_000, chaining: false });
  const [mode, setMode] = useState<Mode>({ kind: "menu" });
  const [joinCode, setJoinCode] = useState("");

  // A shared link opens straight into the room.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("room");
    if (code) setMode({ kind: "online", code: code.toUpperCase(), role: "guest", random: false });
  }, []);

  const { waiting } = useMatchmaking(mode.kind === "searching", (code, role) =>
    setMode({ kind: "online", code, role, random: true }),
  );

  const toMenu = () => {
    window.history.replaceState(null, "", window.location.pathname);
    setMode({ kind: "menu" });
  };

  if (error) return <p className="py-16 text-center text-muted">게임 데이터를 불러오지 못했습니다.</p>;

  if (mode.kind === "local" && grid) return <LocalMatch grid={grid} items={items} settings={settings} onMenu={toMenu} />;
  if (mode.kind === "online" && grid)
    return (
      <OnlineMatch
        key={mode.code}
        grid={grid}
        items={items}
        code={mode.code}
        role={mode.role}
        random={mode.random}
        settings={mode.random ? { lengthMs: 240_000, chaining: false } : settings}
        onMenu={toMenu}
      />
    );

  const ready = !!grid;
  const card =
    "flex w-full items-center gap-3 rounded-[10px] border border-border bg-surface p-4 text-left transition-colors enabled:hover:border-border-strong enabled:hover:bg-surface-2 disabled:opacity-50";

  return (
    <div className="mx-auto max-w-[520px] space-y-3">
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
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              const code = roomCode();
              window.history.replaceState(null, "", `?room=${code}`);
              setMode({ kind: "online", code, role: "host", random: false });
            }}
            className={card}
          >
            <Users className="size-7 shrink-0 text-[var(--p1)]" weight="duotone" />
            <span>
              <span className="block text-[15px] font-semibold text-text">친구와 하기</span>
              <span className="block text-[12.5px] text-muted">방을 만들고 링크나 코드를 보냅니다</span>
            </span>
          </button>
          <button type="button" disabled={!ready} onClick={() => setMode({ kind: "searching" })} className={card}>
            <Globe className="size-7 shrink-0 text-emerald-400" weight="duotone" />
            <span>
              <span className="block text-[15px] font-semibold text-text">온라인 상대 찾기</span>
              <span className="block text-[12.5px] text-muted">기다리는 다른 사람과 바로 붙습니다 (4분 · 기본 규칙)</span>
            </span>
          </button>
          <button type="button" disabled={!ready} onClick={() => setMode({ kind: "local" })} className={card}>
            <DeviceMobile className="size-7 shrink-0 text-[var(--p2)]" weight="duotone" />
            <span>
              <span className="block text-[15px] font-semibold text-text">한 화면에서 둘이</span>
              <span className="block text-[12.5px] text-muted">한 기기를 번갈아 씁니다</span>
            </span>
          </button>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const code = joinCode.trim().toUpperCase();
              if (code.length < 4) return;
              window.history.replaceState(null, "", `?room=${code}`);
              setMode({ kind: "online", code, role: "guest", random: false });
            }}
          >
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 5))}
              placeholder="받은 방 코드 입력"
              className="tnum min-w-0 flex-1 rounded-[10px] border border-border-strong bg-surface px-4 py-3 text-[15px] tracking-[0.2em] text-text outline-none placeholder:tracking-normal placeholder:text-faint focus:border-accent"
            />
            <button type="submit" className="rounded-[10px] border border-border-strong px-4 text-[14px] font-semibold text-text hover:bg-surface-2">
              참가
            </button>
          </form>

          <section className="rounded-[10px] border border-border bg-surface p-4">
            <h2 className="text-[13px] font-semibold text-text">방 설정 (친구와 · 한 화면)</h2>
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {LENGTHS.map((l) => (
                <button
                  key={l.ms}
                  type="button"
                  data-press
                  onClick={() => setSettings((s) => ({ ...s, lengthMs: l.ms }))}
                  aria-pressed={settings.lengthMs === l.ms}
                  className={`rounded-[6px] border px-3 py-2 text-left transition-colors ${
                    settings.lengthMs === l.ms
                      ? "border-accent bg-accent/15 text-text"
                      : "border-border text-muted hover:border-border-strong hover:text-text"
                  }`}
                >
                  <span className="block text-[14px] font-semibold">{l.label}</span>
                  <span className="block text-[11.5px] opacity-80">{l.sub}</span>
                </button>
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

/* ------------------------------------------------------------------ */

function LocalMatch({
  grid,
  items,
  settings,
  onMenu,
}: {
  grid: NonNullable<ReturnType<typeof useGrid>["grid"]>;
  items: GridPick[];
  settings: RoomSettings;
  onMenu: () => void;
}) {
  const newGame = () => {
    const seed = (Math.random() * 2 ** 31) | 0;
    return newMatch(makeBoard(grid, seed), seed, settings.lengthMs, settings.chaining);
  };
  const [state, setState] = useState<MatchState>(newGame);
  const board = useMemo(() => makeBoard(grid, state.seed), [grid, state.seed]);
  const byId = useMemo(() => new Map(board.map((c) => [c.id, c])), [board]);

  useEffect(() => {
    if (state.status !== "live" || !state.lengthMs) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      setState((s) => tick(s, dt));
    }, 100);
    return () => window.clearInterval(id);
  }, [state.status, state.lengthMs]);

  return (
    <MatchView
      grid={grid}
      items={items}
      board={board}
      state={state}
      canMove={state.status === "live"}
      moverLabel={SIDE[state.turn].name}
      time={state.time}
      onAnswer={(cell, p) => setState((s) => play(s, byId, cell, p))}
      onAgain={() => setState(newGame())}
      onMenu={onMenu}
    />
  );
}

function OnlineMatch({
  grid,
  items,
  code,
  role,
  random,
  settings,
  onMenu,
}: {
  grid: NonNullable<ReturnType<typeof useGrid>["grid"]>;
  items: GridPick[];
  code: string;
  role: Role;
  random: boolean;
  settings: RoomSettings;
  onMenu: () => void;
}) {
  const room = useRoom({ code, role, grid, settings });
  const [copied, setCopied] = useState(false);

  // The guest's clocks run on locally between the host's snapshots.
  const [, setNow] = useState(0);
  useEffect(() => {
    if (role !== "guest" || room.phase !== "live") return;
    const id = window.setInterval(() => setNow(performance.now()), 200);
    return () => window.clearInterval(id);
  }, [role, room.phase]);
  const time = (() => {
    const s = room.state;
    if (!s) return { p1: 0, p2: 0 };
    if (role === "host" || s.status !== "live" || !s.lengthMs) return s.time;
    const spent = performance.now() - room.receivedAt;
    return { ...s.time, [s.turn]: Math.max(0, s.time[s.turn] - spent) };
  })();

  const link = typeof window === "undefined" ? "" : `${window.location.origin}/games/possession?room=${code}`;

  if (room.phase === "error")
    return <Notice title="연결하지 못했습니다" body="실시간 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도하세요." onMenu={onMenu} />;
  if (room.phase === "full")
    return <Notice title="방이 꽉 찼습니다" body={`${code} 방에는 이미 두 사람이 있습니다.`} onMenu={onMenu} />;

  if (!room.state) {
    return (
      <div className="mx-auto max-w-[520px] rounded-[10px] border border-border-strong bg-surface p-5 text-center">
        {role === "host" && !random ? (
          <>
            <p className="text-[13px] text-muted">친구에게 이 코드나 링크를 보내세요</p>
            <p className="tnum mt-2 text-[34px] font-bold tracking-[0.3em] text-text">{code}</p>
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
              className="mt-3 inline-flex items-center gap-1.5 rounded-[6px] border border-border-strong px-3.5 py-2 text-[13px] font-semibold text-text hover:bg-surface-2"
            >
              <Copy className="size-4" />
              {copied ? "링크를 복사했습니다" : "초대 링크 복사"}
            </button>
            <p className="live-badge mt-4 text-[13px] text-muted">
              {room.phase === "connecting" ? "방을 여는 중…" : "친구를 기다리는 중…"}
            </p>
          </>
        ) : (
          <p className="live-badge text-[14px] text-muted">
            {room.phase === "connecting" ? `${code} 방에 연결하는 중…` : "상대를 기다리는 중…"}
          </p>
        )}
        <button type="button" onClick={onMenu} className="mt-4 text-[13px] text-muted underline underline-offset-2 hover:text-text">
          나가기
        </button>
      </div>
    );
  }

  const s = room.state;
  const mine = s.turn === room.mySide;
  const gone = room.goneSince ? Math.max(0, 20 - Math.floor((Date.now() - room.goneSince) / 1000)) : null;

  return (
    <MatchView
      grid={grid}
      items={items}
      board={room.board}
      state={s}
      mySide={room.mySide}
      canMove={s.status === "live" && mine}
      moverLabel={mine ? "내" : "상대"}
      time={time}
      banner={
        gone !== null && s.status === "live"
          ? `상대 연결이 끊겼습니다 — ${gone}초 안에 돌아오지 않으면 기권승`
          : `방 ${code} · 나는 ${SIDE[room.mySide].name}`
      }
      onAnswer={room.answer}
      onAgain={room.rematch}
      onMenu={onMenu}
    />
  );
}

/* ------------------------------------------------------------------ */

/**
 * The board, the scoreboard and the answer box - the same for every mode.
 *
 * The flip and the shake are read off `state.last` when `state.seq` moves, so
 * an answer made in another browser animates here exactly as a local one does.
 */
function MatchView({
  grid,
  items,
  board,
  state,
  mySide,
  canMove,
  moverLabel,
  time,
  banner,
  onAnswer,
  onAgain,
  onMenu,
}: {
  grid: NonNullable<ReturnType<typeof useGrid>["grid"]>;
  items: GridPick[];
  board: BoardCell[];
  state: MatchState;
  /** online: which side this browser plays */
  mySide?: Side;
  canMove: boolean;
  moverLabel: string;
  time: Record<Side, number>;
  banner?: string;
  onAnswer: (cell: string, p: GridPick) => void;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [flip, setFlip] = useState({ ids: [] as string[], nonce: 0 });
  const [shake, setShake] = useState({ id: "", nonce: 0 });
  const byId = useMemo(() => new Map(board.map((c) => [c.id, c])), [board]);
  const owners = useMemo(() => new Map(Object.entries(state.owners)), [state.owners]);
  const count = tally(owners);
  const bar = useRef<HTMLDivElement>(null);

  const lastSeq = useRef(state.seq);
  useEffect(() => {
    if (state.seq === lastSeq.current) return;
    lastSeq.current = state.seq;
    const l = state.last;
    if (!l) return;
    if (l.wrong) setShake({ id: l.cell, nonce: state.seq });
    else setFlip({ ids: l.claimed, nonce: state.seq });
    setSelected(null);
  }, [state.seq, state.last]);

  // A new match (rematch) resets the selection.
  useEffect(() => setSelected(null), [state.seed]);

  useEffect(() => {
    if (!bar.current || reducedMotion()) return;
    animate(bar.current, { width: `${count.share}%`, duration: 700, ease: "outExpo" });
  }, [count.share]);

  const around = useMemo(() => {
    const cell = selected ? byId.get(selected) : undefined;
    return new Set(cell ? neighbours(cell).map(cellId) : []);
  }, [selected, byId]);

  const look = (cell: BoardCell): HexLook => {
    const o = owners.get(cell.id) ?? "none";
    if (o !== "none") return { fill: SIDE[o].colour, ink: "#fff", label: `${SIDE[o].name} 소유`, disabled: true };
    return {
      fill: "var(--surface-3)",
      ink: "var(--text)",
      selected: selected === cell.id,
      preview: around.has(cell.id),
      disabled: !canMove,
    };
  };

  const l = state.last;
  const log = !l
    ? `${SIDE.p1.name}부터 시작합니다.`
    : l.wrong
      ? `${SIDE[l.by].name}: ${l.player} — ${grid.cats[byId.get(l.cell)?.cat ?? 0]?.short} 조건에 맞지 않습니다. 차례가 넘어갑니다.`
      : `${SIDE[l.by].name}: ${l.player} — ${l.claimed.length}칸${l.stolen.length ? `, 그중 ${l.stolen.length}칸 뺏음` : ""}`;

  return (
    <div className="mx-auto max-w-[520px]">
      {banner && <p className="mb-2 text-center text-[12.5px] text-muted">{banner}</p>}
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        {(["p1", "p2"] as Side[]).map((sd, i) => (
          <div key={sd} className={i === 0 ? "order-1 text-left" : "order-3 text-right"}>
            <div className={`flex items-center gap-1.5 text-[12px] font-bold tracking-wide ${i ? "justify-end" : ""}`} style={{ color: SIDE[sd].colour }}>
              {state.turn === sd && state.status === "live" && (
                <span className="live-badge size-2 rounded-full" style={{ background: SIDE[sd].colour }} />
              )}
              {SIDE[sd].name}
              {mySide === sd && <span className="text-[10.5px] font-semibold text-faint">(나)</span>}
            </div>
            <div className={`tnum text-[26px] leading-none font-bold ${state.turn === sd && state.status === "live" ? "text-text" : "text-faint"}`}>
              {state.lengthMs ? clock(time[sd]) : "∞"}
            </div>
          </div>
        ))}
        <div className="tnum order-2 pb-0.5 text-[26px] leading-none font-bold">
          <span style={{ color: SIDE.p1.colour }}>{count.p1}</span>
          <span className="px-1 text-faint">-</span>
          <span style={{ color: SIDE.p2.colour }}>{count.p2}</span>
        </div>
      </div>
      <div className="mt-2.5 flex h-2 overflow-hidden rounded-full" style={{ background: SIDE.p2.colour }}>
        <div ref={bar} className="h-full" style={{ width: `${count.share}%`, background: SIDE.p1.colour }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] font-semibold text-faint">
        <span className="tnum">{count.share}%</span>
        <span>점유율</span>
        <span className="tnum">{100 - count.share}%</span>
      </div>

      <div className="mt-4">
        <HexBoard
          board={board}
          cats={grid.cats}
          look={look}
          onSelect={(id) => canMove && owners.get(id) === "none" && setSelected((x) => (x === id ? null : id))}
          flip={flip}
          shake={shake}
        />
      </div>

      <div className="mt-4">
        {state.status === "live" ? (
          <PlayerPicker
            items={items}
            onPick={(p) => selected && onAnswer(selected, p)}
            disabled={!canMove || !selected}
            autoFocus
            placeholder={
              !canMove
                ? "상대 차례입니다…"
                : selected
                  ? `${moverLabel} 차례 — ${grid.cats[byId.get(selected)!.cat].short}에 맞는 선수`
                  : `${moverLabel} 차례 — 칸을 먼저 고르세요`
            }
          />
        ) : (
          <Result state={state} count={count} mySide={mySide} onAgain={onAgain} onMenu={onMenu} />
        )}
        <p className="mt-2 min-h-[1.4em] text-[13px] text-muted" aria-live="polite">
          {log}
        </p>
      </div>
    </div>
  );
}

function Result({
  state,
  count,
  mySide,
  onAgain,
  onMenu,
}: {
  state: MatchState;
  count: { p1: number; p2: number };
  mySide?: Side;
  onAgain: () => void;
  onMenu: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current || reducedMotion()) return;
    animate(box.current, { scale: [0.9, 1], opacity: [0, 1], duration: 500, ease: "outBack(1.4)" });
  }, []);
  const r = state.result!;
  const w = r.winner;
  const headline = !w ? "무승부" : mySide ? (w === mySide ? "승리!" : "패배") : `${SIDE[w].name} 승리`;
  const why =
    r.reason === "time"
      ? `${SIDE[w === "p1" ? "p2" : "p1"].name}의 시간이 다 됐습니다`
      : r.reason === "forfeit"
        ? "상대가 나갔습니다"
        : "31칸이 모두 찼습니다";
  return (
    <div ref={box} className="rounded-[10px] border border-border-strong bg-surface p-4 text-center">
      <p className="text-[12px] font-bold tracking-[0.2em] text-faint">{r.reason === "time" ? "시간 종료" : "경기 종료"}</p>
      <p className="mt-1 text-[22px] font-bold" style={{ color: w ? SIDE[w].colour : "var(--text)" }}>
        {headline}
      </p>
      <p className="tnum mt-0.5 text-[14px] text-muted">
        {why} · {count.p1} - {count.p2}
      </p>
      <div className="mt-3 flex justify-center gap-2">
        <button type="button" data-press onClick={onAgain} className="rounded-[6px] border border-border-strong px-4 py-2 text-[13px] font-semibold text-text hover:bg-surface-2">
          다시 하기
        </button>
        <button type="button" data-press onClick={onMenu} className="rounded-[6px] px-4 py-2 text-[13px] text-muted hover:text-text">
          처음으로
        </button>
      </div>
    </div>
  );
}

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
      <ol className="list-decimal space-y-1 pl-4">
        <li>번갈아 가며 중립 칸을 하나 고르고, 그 칸 조건에 맞는 선수를 댑니다.</li>
        <li>
          그 선수가 <b className="text-text">맞닿은 칸의 조건에도 맞으면</b> 그 칸들도 같이 가져옵니다. 상대 칸이어도 뺏습니다.
        </li>
        <li>틀리면 칸을 못 가져오고 차례가 넘어갑니다.</li>
        <li>시계는 자기 차례에만 흐르고, 먼저 다 쓰는 쪽이 집니다.</li>
        <li>31칸이 모두 차면 더 많이 가진 쪽이 이깁니다.</li>
      </ol>
      <p className="mt-2 text-[12px] text-faint">한글·영문·초성으로 검색할 수 있습니다 (손흥민 · Son · ㅅㅎㅁ).</p>
    </section>
  );
}
