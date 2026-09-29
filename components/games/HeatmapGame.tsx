"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { makeBoard, type BoardCell } from "@/lib/games/board";
import { heatMove, heatLevel } from "@/lib/games/rules";
import { dayNumber } from "@/lib/games/seed";
import { reducedMotion, rollNumber } from "@/lib/motion";
import { HexBoard, type HexLook } from "./HexBoard";
import { PlayerPicker } from "./PlayerPicker";
import { useGrid, type GridPick } from "./useGrid";
import { share, useDaily } from "./useDaily";

/** The score sits where the middle hex would be, as in the original. */
const SCORE_SLOT = { q: 2, r: 3 };

interface Save {
  heat: Record<string, number>;
  score: number;
  guesses: number;
  best: number;
  done: boolean;
}

const EMPTY: Save = { heat: {}, score: 0, guesses: 0, best: 0, done: false };

/** Hotter hexes, more of the accent: seven steps from a warm tint to full orange. */
function heatFill(h: number): { fill: string; ink: string } {
  if (h <= 0) return { fill: "var(--surface-3)", ink: "var(--text)" };
  // Starts at 45%, not a faint tint: measured on a phone, a first-level hex at
  // a quarter of the accent read as muddy brown and was hard to tell from an
  // empty one, which is the one distinction the board exists to show.
  const pct = [0, 45, 55, 65, 74, 83, 92, 100][heatLevel(h)];
  return {
    fill: `color-mix(in oklab, var(--accent) ${pct}%, var(--surface-3))`,
    ink: pct >= 65 ? "var(--accent-ink)" : "var(--text)",
  };
}

/**
 * The Heatmap: one board a day, filled by yourself.
 *
 * Pick an unclaimed hex and name a player for it. Every touching hex he also
 * fits is claimed in the same move, and the new cells score as a combo - 1, 3,
 * 6, 10 - so one answer that opens four hexes beats four answers that open one
 * each. Touching hexes already claimed are "reheated" for a point apiece and
 * glow hotter. A wrong answer costs a point. The day ends when all thirty are
 * claimed.
 */
export function HeatmapGame() {
  const { grid, items, error } = useGrid();
  const day = dayNumber();
  const [save, setSave] = useDaily<Save>("heatmap", day, EMPTY);
  const [selected, setSelected] = useState<string | null>(null);
  const [flip, setFlip] = useState({ ids: [] as string[], nonce: 0 });
  const [shake, setShake] = useState({ id: "", nonce: 0 });
  const [log, setLog] = useState("");
  const [copied, setCopied] = useState(false);

  const board = useMemo(
    () => (grid ? makeBoard(grid, day * 1009 + 17, SCORE_SLOT) : []),
    [grid, day],
  );
  const byId = useMemo(() => new Map(board.map((c) => [c.id, c])), [board]);
  const heat = useMemo(() => new Map(Object.entries(save.heat)), [save.heat]);

  const scoreEl = useRef<HTMLSpanElement>(null);
  const lastScore = useRef(save.score);
  useEffect(() => {
    if (scoreEl.current && lastScore.current !== save.score) {
      rollNumber(scoreEl.current, lastScore.current, save.score);
    }
    lastScore.current = save.score;
  }, [save.score]);

  const answer = (p: GridPick) => {
    if (!selected || save.done) return;
    const cat = grid!.cats[byId.get(selected)!.cat];
    const move = heatMove(byId, heat, selected, p);
    if (!move.valid) {
      setShake({ id: selected, nonce: Date.now() });
      setSave((s) => ({ ...s, score: Math.max(0, s.score - 1), guesses: s.guesses + 1 }));
      setLog(`${p.ko} — ${cat.short} 조건에 맞지 않습니다. −1점`);
      return;
    }
    const next = { ...save.heat };
    for (const id of move.fresh) next[id] = 1;
    for (const id of move.reheated) next[id] = (next[id] ?? 0) + 1;
    const done = board.every((c) => (next[c.id] ?? 0) > 0);
    setSave((s) => ({
      heat: next,
      score: s.score + move.points,
      guesses: s.guesses + 1,
      best: Math.max(s.best, move.points),
      done,
    }));
    setFlip({ ids: [...move.fresh, ...move.reheated], nonce: Date.now() });
    setLog(
      `${p.ko} — 새로 ${move.fresh.length}칸` +
        (move.reheated.length ? ` · 달굼 ${move.reheated.length}칸` : "") +
        ` → +${move.points}점`,
    );
    setSelected(null);
  };

  const look = (cell: BoardCell): HexLook => {
    const h = heat.get(cell.id) ?? 0;
    return {
      ...heatFill(h),
      selected: selected === cell.id,
      disabled: h > 0 || save.done,
      label: h > 0 ? `열기 ${h}` : undefined,
    };
  };

  if (error) return <p className="py-16 text-center text-muted">게임 데이터를 불러오지 못했습니다.</p>;
  if (!grid) return <p className="py-16 text-center text-muted">선수 데이터 불러오는 중…</p>;

  const claimed = board.filter((c) => (heat.get(c.id) ?? 0) > 0).length;
  const density = board.reduce((a, c) => a + (heat.get(c.id) ?? 0), 0) / board.length;

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="mb-3 flex items-baseline justify-between text-[12.5px] text-muted">
        <span className="font-semibold text-text">#{day}</span>
        <span className="tnum">
          {claimed}/{board.length}칸 · 시도 {save.guesses} · 최고 한 수 {save.best}점
        </span>
      </div>

      <HexBoard
        board={board}
        cats={grid.cats}
        look={look}
        onSelect={(id) => !save.done && !(heat.get(id) ?? 0) && setSelected((s) => (s === id ? null : id))}
        flip={flip}
        shake={shake}
        centreSlot={SCORE_SLOT}
        centre={
          <span className="flex flex-col items-center leading-none">
            <span className="text-[2.3cqw] font-bold tracking-[0.18em] text-faint">SCORE</span>
            <span ref={scoreEl} className="tnum mt-[0.8cqw] text-[7cqw] font-bold text-text">
              {save.score}
            </span>
          </span>
        }
      />

      <div className="mt-4">
        {save.done ? (
          <Finished
            day={day}
            save={save}
            density={density}
            copied={copied}
            onShare={async () => {
              setCopied(
                await share(
                  `ITK+ 히트맵 #${day}\n점수 ${save.score} · 열기 ${density.toFixed(2)} · 시도 ${save.guesses}\nhttps://itkplus.vercel.app/games/heatmap`,
                ),
              );
            }}
          />
        ) : (
          <PlayerPicker
            items={items}
            onPick={answer}
            disabled={!selected}
            autoFocus
            placeholder={
              selected ? `${grid.cats[byId.get(selected)!.cat].short}에 맞는 선수` : "칸을 먼저 고르세요"
            }
          />
        )}
        <p className="mt-2 min-h-[1.4em] text-[13px] text-muted" aria-live="polite">
          {log}
        </p>
      </div>

      {!save.done && save.guesses === 0 && (
        <section className="mt-2 rounded-[10px] border border-border p-4 text-[13.5px] leading-relaxed text-muted">
          <h2 className="mb-1.5 text-[14px] font-semibold text-text">하는 법</h2>
          <ol className="list-decimal space-y-1 pl-4">
            <li>빈 칸을 고르고 그 조건에 맞는 선수를 댑니다.</li>
            <li>그 선수가 <b className="text-text">맞닿은 칸</b>에도 맞으면 한 번에 같이 채워집니다.</li>
            <li>새로 채운 칸은 콤보로 계산됩니다: 1칸 1점, 2칸 3점, 3칸 6점, 4칸 10점…</li>
            <li>이미 채운 칸에 또 맞으면 1점씩 더하고 칸이 더 뜨거워집니다.</li>
            <li>틀리면 1점이 깎입니다. 30칸을 다 채우면 끝.</li>
          </ol>
        </section>
      )}
    </div>
  );
}

function Finished({
  day,
  save,
  density,
  copied,
  onShare,
}: {
  day: number;
  save: Save;
  density: number;
  copied: boolean;
  onShare: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!box.current || reducedMotion()) return;
    animate(box.current, { scale: [0.92, 1], opacity: [0, 1], duration: 520, ease: "outBack(1.4)" });
  }, []);
  return (
    <div ref={box} className="rounded-[10px] border border-border-strong bg-surface p-4 text-center">
      <p className="text-[12px] font-bold tracking-[0.2em] text-faint">히트맵 #{day} 완성</p>
      <p className="tnum mt-1 text-[30px] leading-none font-bold text-accent">{save.score}점</p>
      <p className="tnum mt-1.5 text-[13px] text-muted">
        열기 밀도 {density.toFixed(2)} · 시도 {save.guesses} · 최고 한 수 {save.best}점
      </p>
      <button
        type="button"
        data-press
        onClick={onShare}
        className="mt-3 rounded-[6px] border border-border-strong px-4 py-2 text-[13px] font-semibold text-text hover:bg-surface-2"
      >
        {copied ? "복사했습니다" : "결과 복사"}
      </button>
      <p className="mt-2 text-[12px] text-faint">새 판은 내일 자정(한국 시간)에 열립니다.</p>
    </div>
  );
}
