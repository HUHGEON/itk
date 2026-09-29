"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { makeBoard, type BoardCell } from "@/lib/games/board";
import { cellId, neighbours } from "@/lib/games/hex";
import { possessionMove, tally, type Owner } from "@/lib/games/rules";
import { reducedMotion } from "@/lib/motion";
import { HexBoard, type HexLook } from "./HexBoard";
import { PlayerPicker } from "./PlayerPicker";
import { useGrid, type GridPick } from "./useGrid";

type Side = "p1" | "p2";

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

/**
 * Possession Play, two players on one screen.
 *
 * Take turns picking a neutral hex and naming a player who fits it. The answer
 * also takes every touching hex it fits - including the opponent's. Each side
 * has its own clock that only runs on its turn; a wrong answer loses the turn;
 * running out of time loses the game; otherwise the board fills up and more
 * hexes wins.
 */
export function PossessionGame() {
  const { grid, items, error } = useGrid();
  const [lengthMs, setLengthMs] = useState(240_000);
  const [chaining, setChaining] = useState(false);
  const [phase, setPhase] = useState<"setup" | "play" | "over">("setup");

  const [board, setBoard] = useState<BoardCell[]>([]);
  const [owners, setOwners] = useState<Map<string, Owner>>(new Map());
  const [turn, setTurn] = useState<Side>("p1");
  const [time, setTime] = useState<Record<Side, number>>({ p1: 0, p2: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [flip, setFlip] = useState({ ids: [] as string[], nonce: 0 });
  const [shake, setShake] = useState({ id: "", nonce: 0 });
  const [log, setLog] = useState<string>("");
  const [result, setResult] = useState<{ winner: Side | null; reason: "board" | "time" } | null>(null);

  const byId = useMemo(() => new Map(board.map((c) => [c.id, c])), [board]);
  const count = tally(owners);
  const bar = useRef<HTMLDivElement>(null);

  const start = () => {
    if (!grid) return;
    const b = makeBoard(grid, (Math.random() * 2 ** 31) | 0);
    setBoard(b);
    setOwners(new Map(b.map((c) => [c.id, "none" as Owner])));
    setTurn("p1");
    setTime({ p1: lengthMs, p2: lengthMs });
    setSelected(null);
    setResult(null);
    setLog("블루부터 시작합니다. 중립 칸을 하나 고르세요.");
    setPhase("play");
  };

  // The running clock: only the side to move, only while the game is live.
  // Read and written through a ref so the timeout is decided outside a state
  // updater - an updater may run twice, and a game should end once.
  const timeRef = useRef(time);
  timeRef.current = time;
  useEffect(() => {
    if (phase !== "play" || !lengthMs) return;
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const left = timeRef.current[turn] - (now - last);
      last = now;
      if (left <= 0) {
        setTime({ ...timeRef.current, [turn]: 0 });
        setResult({ winner: turn === "p1" ? "p2" : "p1", reason: "time" });
        setPhase("over");
        return;
      }
      setTime({ ...timeRef.current, [turn]: left });
    }, 100);
    return () => window.clearInterval(id);
  }, [phase, turn, lengthMs]);

  // The possession bar slides rather than jumps: it is the score, and a swing
  // from 70-30 to 40-60 is the story of a steal.
  useEffect(() => {
    if (!bar.current || reducedMotion()) return;
    animate(bar.current, { width: `${count.share}%`, duration: 700, ease: "outExpo" });
  }, [count.share]);

  const select = (id: string) => {
    if (phase !== "play" || owners.get(id) !== "none") return;
    setSelected((s) => (s === id ? null : id));
  };

  const answer = useCallback(
    (p: GridPick) => {
      if (phase !== "play") return;
      if (!selected) {
        setLog("칸을 먼저 고르세요.");
        return;
      }
      const cat = grid!.cats[byId.get(selected)!.cat];
      const move = possessionMove(byId, owners, selected, p, turn, chaining);
      const next: Side = turn === "p1" ? "p2" : "p1";
      if (!move.valid) {
        setShake({ id: selected, nonce: Date.now() });
        setLog(`${p.ko} — ${cat.short} 조건에 맞지 않습니다. ${SIDE[next].name} 차례.`);
        setSelected(null);
        setTurn(next);
        return;
      }
      const after = new Map(owners);
      for (const id of move.claimed) after.set(id, turn);
      setOwners(after);
      setFlip({ ids: move.claimed, nonce: Date.now() });
      setLog(
        `${SIDE[turn].name}: ${p.ko} — ${move.claimed.length}칸` +
          (move.stolen.length ? `, 그중 ${move.stolen.length}칸 뺏음` : ""),
      );
      setSelected(null);
      const t = tally(after);
      if (t.none === 0) {
        setResult({ winner: t.p1 === t.p2 ? null : t.p1 > t.p2 ? "p1" : "p2", reason: "board" });
        setPhase("over");
        return;
      }
      setTurn(next);
    },
    [phase, selected, grid, byId, owners, turn, chaining],
  );

  // Which touching hexes the selected one could also take, for the preview rim.
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
      disabled: phase !== "play",
    };
  };

  if (error) return <p className="py-16 text-center text-muted">게임 데이터를 불러오지 못했습니다.</p>;

  if (phase === "setup") {
    return (
      <div className="mx-auto max-w-[520px] space-y-4">
        <section className="rounded-[10px] border border-border bg-surface p-4">
          <h2 className="text-[14px] font-semibold text-text">경기 시간</h2>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {LENGTHS.map((l) => (
              <button
                key={l.ms}
                type="button"
                data-press
                onClick={() => setLengthMs(l.ms)}
                aria-pressed={lengthMs === l.ms}
                className={`rounded-[6px] border px-3 py-2.5 text-left transition-colors ${
                  lengthMs === l.ms
                    ? "border-accent bg-accent/15 text-text"
                    : "border-border text-muted hover:border-border-strong hover:text-text"
                }`}
              >
                <span className="block text-[14px] font-semibold">{l.label}</span>
                <span className="block text-[11.5px] opacity-80">{l.sub}</span>
              </button>
            ))}
          </div>
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-3">
            <span>
              <span className="block text-[14px] font-semibold text-text">연쇄 점령</span>
              <span className="block text-[12px] text-muted">
                조건이 맞는 칸이 이어져 있으면 끝까지 따라가며 가져옵니다
              </span>
            </span>
            <input
              type="checkbox"
              checked={chaining}
              onChange={(e) => setChaining(e.target.checked)}
              className="size-5 shrink-0 accent-[var(--accent)]"
            />
          </label>
        </section>
        <button
          type="button"
          data-press
          disabled={!grid}
          onClick={start}
          className="w-full rounded-[10px] py-3.5 text-[15px] font-semibold text-accent-ink disabled:opacity-50"
          style={{ background: "var(--ribbon)" }}
        >
          {grid ? "한 화면에서 둘이 하기" : "선수 데이터 불러오는 중…"}
        </button>
        <HowTo />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[520px]">
      {/* Scoreboard: each side's clock under its name, possession between. */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
        {(["p1", "p2"] as Side[]).map((s, i) => (
          <div key={s} className={`${i === 0 ? "order-1 text-left" : "order-3 text-right"}`}>
            <div
              className={`flex items-center gap-1.5 text-[12px] font-bold tracking-wide ${i ? "justify-end" : ""}`}
              style={{ color: SIDE[s].colour }}
            >
              {turn === s && phase === "play" && (
                <span className="live-badge size-2 rounded-full" style={{ background: SIDE[s].colour }} />
              )}
              {SIDE[s].name}
            </div>
            <div
              className={`tnum text-[26px] leading-none font-bold ${
                turn === s && phase === "play" ? "text-text" : "text-faint"
              }`}
            >
              {lengthMs ? clock(time[s]) : "∞"}
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
        <HexBoard board={board} cats={grid!.cats} look={look} onSelect={select} flip={flip} shake={shake} />
      </div>

      <div className="mt-4">
        {phase === "play" ? (
          <PlayerPicker
            items={items}
            onPick={answer}
            disabled={!selected}
            autoFocus
            placeholder={
              selected
                ? `${SIDE[turn].name} — ${grid!.cats[byId.get(selected)!.cat].short}에 맞는 선수`
                : `${SIDE[turn].name} 차례 — 칸을 먼저 고르세요`
            }
          />
        ) : (
          <Result result={result!} count={count} onAgain={() => setPhase("setup")} />
        )}
        <p className="mt-2 min-h-[1.4em] text-[13px] text-muted" aria-live="polite">
          {log}
        </p>
      </div>
    </div>
  );
}

function Result({
  result,
  count,
  onAgain,
}: {
  result: { winner: Side | null; reason: "board" | "time" };
  count: { p1: number; p2: number };
  onAgain: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current || reducedMotion()) return;
    animate(box.current, { scale: [0.9, 1], opacity: [0, 1], duration: 500, ease: "outBack(1.4)" });
  }, []);
  const w = result.winner;
  return (
    <div ref={box} className="rounded-[10px] border border-border-strong bg-surface p-4 text-center">
      <p className="text-[12px] font-bold tracking-[0.2em] text-faint">
        {result.reason === "time" ? "시간 종료" : "경기 종료"}
      </p>
      <p className="mt-1 text-[22px] font-bold" style={{ color: w ? SIDE[w].colour : "var(--text)" }}>
        {w ? `${SIDE[w].name} 승리` : "무승부"}
      </p>
      <p className="tnum mt-0.5 text-[14px] text-muted">
        {result.reason === "time" && w ? `${SIDE[w === "p1" ? "p2" : "p1"].name}의 시간이 다 됐습니다 · ` : ""}
        {count.p1} - {count.p2}
      </p>
      <button
        type="button"
        data-press
        onClick={onAgain}
        className="mt-3 rounded-[6px] border border-border-strong px-4 py-2 text-[13px] font-semibold text-text hover:bg-surface-2"
      >
        다시 하기
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
        <li>그 선수가 <b className="text-text">맞닿은 칸의 조건에도 맞으면</b> 그 칸들도 같이 가져옵니다. 상대 칸이어도 뺏습니다.</li>
        <li>틀리면 칸을 못 가져오고 차례가 넘어갑니다.</li>
        <li>시계는 자기 차례에만 흐르고, 먼저 다 쓰는 쪽이 집니다.</li>
        <li>31칸이 모두 차면 더 많이 가진 쪽이 이깁니다.</li>
      </ol>
      <p className="mt-2 text-[12px] text-faint">한글·영문·초성으로 검색할 수 있습니다 (손흥민 · Son · ㅅㅎㅁ).</p>
    </section>
  );
}
