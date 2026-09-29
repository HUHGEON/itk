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
import { ChartBar, X } from "@phosphor-icons/react/dist/ssr";

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

/**
 * The running record, with the same six figures the original keeps: games,
 * average score, best score, fewest guesses, best single move, average heat.
 */
interface HeatRecord {
  played: number;
  totalScore: number;
  best: number;
  fewest: number;
  bestMove: number;
  totalDensity: number;
  lastDay: number;
}
const NO_RECORD: HeatRecord = { played: 0, totalScore: 0, best: 0, fewest: 0, bestMove: 0, totalDensity: 0, lastDay: 0 };

function readRecord(): HeatRecord {
  try {
    return { ...NO_RECORD, ...JSON.parse(localStorage.getItem("itk:stats:heatmap") ?? "{}") };
  } catch {
    return NO_RECORD;
  }
}

function saveRecord(day: number, save: Save, density: number): HeatRecord {
  const r = readRecord();
  if (r.lastDay === day) return r;
  const next: HeatRecord = {
    played: r.played + 1,
    totalScore: r.totalScore + save.score,
    best: Math.max(r.best, save.score),
    fewest: r.fewest ? Math.min(r.fewest, save.guesses) : save.guesses,
    bestMove: Math.max(r.bestMove, save.best),
    totalDensity: r.totalDensity + density,
    lastDay: day,
  };
  try {
    localStorage.setItem("itk:stats:heatmap", JSON.stringify(next));
  } catch {
    // no storage
  }
  return next;
}

const untilMidnight = () => {
  const left = 86_400_000 - ((Date.now() + 9 * 3600_000) % 86_400_000);
  const s = Math.floor(left / 1000);
  return [s / 3600, (s % 3600) / 60, s % 60].map((n) => String(Math.floor(n)).padStart(2, "0")).join(":");
};

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
  const [modal, setModal] = useState(false);
  const [record, setRecord] = useState<HeatRecord>(NO_RECORD);
  useEffect(() => setRecord(readRecord()), []);

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
    const after: Save = {
      heat: next,
      score: save.score + move.points,
      guesses: save.guesses + 1,
      best: Math.max(save.best, move.points),
      done,
    };
    setSave(after);
    if (done) {
      const d = board.reduce((a, c) => a + (next[c.id] ?? 0), 0) / board.length;
      setRecord(saveRecord(day, after, d));
      // After the last cells have turned over.
      window.setTimeout(() => setModal(true), 1400);
    }
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
      <div className="mb-3 flex items-center justify-between text-[12.5px] text-muted">
        <span className="font-semibold text-text">#{day}</span>
        <span className="tnum">
          {claimed}/{board.length}칸 · 시도 {save.guesses} · 최고 한 수 {save.best}점
        </span>
        <button type="button" onClick={() => setModal(true)} aria-label="통계" className="rounded-[6px] p-1 text-muted hover:text-text">
          <ChartBar className="size-5" />
        </button>
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
          <button
            type="button"
            data-press
            onClick={() => setModal(true)}
            className="w-full rounded-[10px] border border-border-strong py-3 text-[14px] font-semibold text-text hover:bg-surface-2"
          >
            히트맵 완성 · {save.score}점 — 결과 보기
          </button>
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

      {modal && (
        <HeatModal
          day={day}
          save={save}
          density={density}
          record={record}
          copied={copied}
          onShare={async () =>
            setCopied(
              await share(
                `ITK+ 히트맵 #${day}\n점수 ${save.score} · 열기 ${density.toFixed(2)}x · 시도 ${save.guesses}\nhttps://itkplus.vercel.app/games/heatmap`,
              ),
            )
          }
          onClose={() => setModal(false)}
        />
      )}

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

/**
 * The end of the day, as the original lays it out: this board's score and its
 * three figures on top, the running record under them, the countdown to the
 * next board and a share button. Opened from the chart icon at any time, in
 * which case it shows only the record.
 */
function HeatModal({
  day,
  save,
  density,
  record,
  copied,
  onShare,
  onClose,
}: {
  day: number;
  save: Save;
  density: number;
  record: HeatRecord;
  copied: boolean;
  onShare: () => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [clock, setClock] = useState(untilMidnight);
  useEffect(() => {
    const id = window.setInterval(() => setClock(untilMidnight()), 1000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    if (!box.current || reducedMotion()) return;
    animate(box.current, { opacity: [0, 1], y: [16, 0], duration: 420, ease: "outExpo" });
  }, []);
  const Figure = ({ v, l }: { v: string | number; l: string }) => (
    <div className="w-1/3 text-center">
      <div className="tnum text-[24px] leading-none font-bold">{v}</div>
      <div className="mt-1 text-[11px] text-muted">{l}</div>
    </div>
  );
  const avg = (total: number, digits = 0) => (record.played ? (total / record.played).toFixed(digits) : "0");
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={save.done ? "히트맵 완성" : "통계"}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[360px] rounded-[10px] border border-border-strong bg-surface p-5 text-text shadow-2xl"
      >
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute top-3 right-3 text-muted hover:text-text">
          <X className="size-5" />
        </button>
        <h2 className="text-center text-[15px] font-bold">{save.done ? `히트맵 #${day} 완성` : "통계"}</h2>
        {save.done && (
          <>
            <div className="mt-3 text-center">
              <div className="tnum text-[40px] leading-none font-bold text-accent">{save.score}</div>
              <div className="mt-1 text-[11px] text-muted">점수</div>
            </div>
            <div className="mt-3 flex">
              <Figure v={save.guesses} l="시도" />
              <Figure v={save.best} l="최고 한 수" />
              <Figure v={`${density.toFixed(2)}x`} l="열기 밀도" />
            </div>
            <div className="my-4 border-t border-border" />
          </>
        )}
        <div className="flex">
          <Figure v={record.played} l="판 수" />
          <Figure v={avg(record.totalScore)} l="평균 점수" />
          <Figure v={record.best} l="최고 점수" />
        </div>
        <div className="mt-3 flex">
          <Figure v={record.fewest} l="최소 시도" />
          <Figure v={record.bestMove} l="최고 한 수" />
          <Figure v={`${avg(record.totalDensity, 2)}x`} l="평균 밀도" />
        </div>
        <p className="mt-4 text-center text-[12px] font-semibold text-muted">
          다음 히트맵까지 <span className="tnum text-text">{clock}</span>
        </p>
        {save.done && (
          <button
            type="button"
            data-press
            onClick={onShare}
            className="mt-3 w-full rounded-[6px] py-2.5 text-[14px] font-semibold text-accent-ink"
            style={{ background: "var(--ribbon)" }}
          >
            {copied ? "복사했습니다" : "결과 공유"}
          </button>
        )}
      </div>
    </div>
  );
}
