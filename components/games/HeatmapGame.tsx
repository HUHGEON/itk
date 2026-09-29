"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { makeBoard, type BoardCell } from "@/lib/games/board";
import { heatMove, heatLevel } from "@/lib/games/rules";
import { dayNumber } from "@/lib/games/seed";
import { reducedMotion, rollNumber } from "@/lib/motion";
import { ACCENT, FLIP_MS, FLIP_STAGGER, HEAT, HexBoard, type HexLook } from "./HexBoard";
import { MobileSheet } from "./MobileSheet";
import { TechnicalArea } from "./TechnicalArea";
import { cellId, neighbours } from "@/lib/games/hex";
import { PlayerPicker } from "./PlayerPicker";
import { useGrid, type GridPick } from "./useGrid";
import { share, useDaily } from "./useDaily";
import { ChartBar, Info, X } from "@phosphor-icons/react/dist/ssr";

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

/** The original's share grid: one square per hex, black for the score slot. */
const SQUARE = ["⬜", "🟨", "🟨", "🟧", "🟧", "🟥", "🟥", "🟫"];
function shareGrid(board: BoardCell[], heat: Map<string, number>): string {
  const rows = Math.max(...board.map((c) => c.r), SCORE_SLOT.r) + 1;
  const out: string[] = [];
  for (let r = 0; r < rows; r++) {
    const n = r % 2 === 0 ? 4 : 5;
    let line = "";
    for (let q = 0; q < n; q++) {
      if (r === SCORE_SLOT.r && q === SCORE_SLOT.q) line += "⬛";
      else line += SQUARE[heatLevel(heat.get(`${r}-${q}`) ?? 0)];
    }
    // Short rows sit half a hex in, as on the board.
    out.push(n === 4 ? ` ${line}` : line);
  }
  return out.join("\n");
}

const HOWTO_KEY = "itk:heatmap:howto";

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
  const [reheat, setReheat] = useState({ ids: [] as string[], nonce: 0 });
  const [shake, setShake] = useState({ id: "", nonce: 0 });
  const [copied, setCopied] = useState(false);
  const [modal, setModal] = useState(false);
  const [howto, setHowto] = useState(false);
  const [record, setRecord] = useState<HeatRecord>(NO_RECORD);
  useEffect(() => setRecord(readRecord()), []);
  // First visit: the rules open by themselves, as in the original.
  useEffect(() => {
    try {
      if (!localStorage.getItem(HOWTO_KEY)) setHowto(true);
    } catch {
      // no storage: no auto-open
    }
  }, []);
  const closeHowto = () => {
    setHowto(false);
    try {
      localStorage.setItem(HOWTO_KEY, "1");
    } catch {
      // nothing
    }
  };

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
    const move = heatMove(byId, heat, selected, p);
    if (!move.valid) {
      setShake({ id: selected, nonce: Date.now() });
      setSave((s) => ({ ...s, score: Math.max(0, s.score - 1), guesses: s.guesses + 1 }));
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
      // After the last new hex has turned over, as the original waits.
      window.setTimeout(() => setModal(true), FLIP_MS + Math.max(0, move.fresh.length - 1) * FLIP_STAGGER);
    }
    const nonce = Date.now();
    setFlip({ ids: move.fresh, nonce });
    setReheat({ ids: move.reheated, nonce });
    setSelected(null);
  };

  const around = useMemo(() => {
    const cell = selected ? byId.get(selected) : undefined;
    return new Set(cell ? neighbours(cell).map(cellId) : []);
  }, [selected, byId]);

  const look = (cell: BoardCell): HexLook => {
    const h = heat.get(cell.id) ?? 0;
    const claimed = h > 0;
    const tone = HEAT[claimed ? heatLevel(h) : 0];
    return {
      fill: tone.fill,
      ink: claimed ? tone.ink : "#0F172A",
      open: !claimed && !save.done,
      selected: selected === cell.id,
      highlighted: around.has(cell.id),
      accent: ACCENT.heat,
      shadow: selected === cell.id && !claimed ? undefined : claimed ? "0 10px 22px rgba(15, 23, 42, 0.18)" : "0 8px 18px rgba(148, 163, 184, 0.14)",
      label: claimed ? `열기 ${h}` : "빈 칸",
    };
  };

  if (error) return <p className="py-16 text-center text-muted">게임 데이터를 불러오지 못했습니다.</p>;
  if (!grid) return <p className="py-16 text-center text-muted">선수 데이터 불러오는 중…</p>;

  const density = board.reduce((a, c) => a + (heat.get(c.id) ?? 0), 0) / board.length;
  const cat = selected ? grid.cats[byId.get(selected)!.cat] : null;
  const placeholder = selected ? `${cat!.short}에 맞는 선수를 찾으세요…` : "칸을 골라 시작하세요…";
  const badges = selected
    ? [selected, ...around]
        .filter((id) => byId.has(id) && (id === selected || !(heat.get(id) ?? 0)))
        .map((id) => ({ id, label: grid.cats[byId.get(id)!.cat].short, on: id === selected }))
    : [];

  return (
    <div className="mx-auto max-w-[405px]">
      <div className="mb-3 flex items-center justify-between text-muted">
        <button type="button" onClick={() => setHowto(true)} aria-label="하는 법" className="rounded-[6px] p-1 hover:text-text">
          <Info className="size-6" />
        </button>
        <span className="tnum text-[13px] font-semibold text-text">#{day}</span>
        <button type="button" onClick={() => setModal(true)} aria-label="통계" className="rounded-[6px] p-1 hover:text-text">
          <ChartBar className="size-6" />
        </button>
      </div>

      <HexBoard
        board={board}
        cats={grid.cats}
        look={look}
        onSelect={(id) => !save.done && !(heat.get(id) ?? 0) && setSelected((s) => (s === id ? null : id))}
        flip={flip}
        reheat={reheat}
        shake={shake}
        centreSlot={SCORE_SLOT}
        centre={
          <span className="flex flex-col items-center text-center">
            <span className="mt-1 -mb-2 text-[10px] font-semibold text-text uppercase sm:text-[11px]">점수</span>
            <span ref={scoreEl} className="tnum mt-2 inline-block min-w-[2ch] text-3xl leading-none font-black text-text">
              {save.score}
            </span>
          </span>
        }
      />

      <div className="mt-3">
        {save.done ? (
          <button
            type="button"
            data-press
            onClick={() => setModal(true)}
            className="w-full rounded-[10px] border border-border-strong py-3 text-[14px] font-semibold text-text hover:bg-surface-2"
          >
            결과 보기 ({save.score}점)
          </button>
        ) : (
          <>
            <div className="hidden sm:block">
              <PlayerPicker items={items} onPick={answer} disabled={!selected} autoFocus={!!selected} placeholder={placeholder} />
            </div>
            {selected && (
              <MobileSheet onClose={() => setSelected(null)} badges={badges}>
                <PlayerPicker items={items} onPick={answer} autoFocus placeholder={placeholder} />
              </MobileSheet>
            )}
            <p className="mt-2 text-center text-[12.5px] text-muted sm:hidden">{placeholder}</p>
          </>
        )}
      </div>

      <TechnicalArea grid={grid} board={board} />

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
                `#TheHeatmap ${day}\n\n${shareGrid(board, heat)}\n\n점수: ${save.score}\n시도: ${save.guesses}\n최고 한 수: ${save.best}\n열기 밀도: ${density.toFixed(2)}x\n\nhttps://itkplus.vercel.app/games/heatmap`,
              ),
            )
          }
          onClose={() => setModal(false)}
        />
      )}

      {howto && <HowTo onClose={closeHowto} />}
    </div>
  );
}

/** The original's "How to play" modal, word for word in Korean. */
function HowTo({ onClose }: { onClose: () => void }) {
  const steps: [string, string][] = [
    ["칸 고르기", "보드에서 아직 비어 있는 칸을 하나 고릅니다. 칸마다 축구 조건이 하나씩 있습니다."],
    ["선수 입력", "고른 칸 조건에 맞는 선수를 찾습니다. 맞으면 그 칸을 차지합니다."],
    ["더 큰 수 만들기", "맞는 선수는 맞닿은 칸도 확인합니다. 이웃 칸 조건에도 맞으면 같은 수에 함께 차지합니다."],
    ["콤보로 점수 올리기", "새로 차지한 칸은 콤보로 계산됩니다: 1칸 = 1점, 2칸 = 3점, 3칸 = 6점, 4칸 = 10점…"],
    ["다시 달구기", "이미 차지한 이웃 칸도 선수가 맞으면 1점씩 더하고 보드가 더 뜨거워집니다."],
    ["Heatmap 완성", "칸을 모두 채우면 끝납니다. 열기 밀도는 완성된 보드의 평균 열기입니다. 틀리면 1점이 깎입니다."],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/75 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="heat-howto"
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-lg bg-gray-800 px-4 pt-5 pb-6 text-left text-white shadow-xl sm:px-6"
        style={{ animation: "kickoff-num 300ms ease-out both" }}
      >
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute top-4 right-4 text-white/80 hover:text-white">
          <X className="size-6" />
        </button>
        <h3 id="heat-howto" className="mb-4 text-center text-lg leading-6 font-medium text-gray-100">
          하는 법
        </h3>
        <ol className="mt-2 text-sm">
          {steps.map(([t, d]) => (
            <li key={t} className="mb-2">
              <strong>{t}</strong>
              <p className="text-white/80">{d}</p>
            </li>
          ))}
        </ol>
      </div>
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
        aria-label={save.done ? "Heatmap 완성" : "통계"}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-[360px] rounded-[10px] border border-border-strong bg-surface p-5 text-text shadow-2xl"
      >
        <button type="button" onClick={onClose} aria-label="닫기" className="absolute top-3 right-3 text-muted hover:text-text">
          <X className="size-5" />
        </button>
        <h2 className="text-center text-[15px] font-bold">{save.done ? `Heatmap #${day} 완성` : "통계"}</h2>
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
          다음 Heatmap까지 <span className="tnum text-text">{clock}</span>
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
