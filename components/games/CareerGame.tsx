"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChartBar, Info, X } from "@phosphor-icons/react/dist/ssr";
import { loadCareer, type CareerAnswer } from "@/lib/games/data";
import { daily, dayNumber } from "@/lib/games/seed";
import { ArchiveNav, NextPuzzle } from "./ArchiveNav";
import { PlayerPicker } from "./PlayerPicker";
import { Toast } from "./Toast";
import { useGrid, type GridPick } from "./useGrid";
import { useDaily } from "./useDaily";
import { StatsModal, recordResult, useRecord } from "./Stats";

type Level = "easy" | "normal" | "hard";

interface Save {
  level: Level | null;
  /** a name per guess; null for a skip */
  guesses: (string | null)[];
  won: boolean;
  done: boolean;
}

/** Only the better-known half of the pool: a puzzle nobody can know is not one. */
const POOL = 350;

const LEVELS: { id: Level; ko: string }[] = [
  { id: "easy", ko: "쉬움" },
  { id: "normal", ko: "보통" },
  { id: "hard", ko: "어려움" },
];

/*
 * How a hidden row is masked, per difficulty - read off the original's three
 * modes on the same puzzle:
 *
 *   easy    "L--------", "A---- V----": each word's first letter, then a dash
 *           per letter; year ranges and loans keep their shape.
 *   normal  "---------", "----- -----": a dash per letter, word breaks kept.
 *   hard    "----  ------  --  (--)" on every row: nothing to count.
 */
function maskName(name: string, level: Level): string {
  if (level === "hard") return "------";
  return name
    .split(" ")
    .map((w) => (level === "easy" ? w[0] + "-".repeat(Math.max(0, [...w].length - 1)) : "-".repeat([...w].length)))
    .join(" ");
}
const maskNum = (n: number | null, level: Level) => (level === "hard" || n === null ? "--" : "-".repeat(String(n).length));
const maskYears = (a: number, b: number | null, level: Level) =>
  level === "hard" ? "----" : b === null || a === b ? "----" : "---- ----";

const span = (a: number, b: number | null) => (b === null ? `${a}–` : a === b ? `${a}` : `${a}–${b}`);

/**
 * A cell as it opens: the original fades each one in, a column 100ms after
 * the one to its left. Rows already open when the page loads just show.
 */
function Reveal({ text, col, play }: { text: string; col: number; play: boolean }) {
  return (
    <span style={play ? { animation: `toast-in 500ms ease-out ${col * 100}ms both` } : undefined}>{text}</span>
  );
}

/** How long the original leaves a result on screen before the stats open. */
const RESULT_MS = 2000;
const PRAISE = ["잘했어요!", "훌륭해요!", "대단해요!"];

/**
 * Career Path: a player's clubs as a Wikipedia infobox, one row at a time.
 *
 * The first club is shown. A wrong guess or a skip opens the next row; there
 * are as many guesses as rows. The difficulty decides how much of a hidden row
 * shows through its mask. The international career stays hidden until the
 * game is over.
 */
export function CareerGame() {
  const { grid, items, error } = useGrid();
  const [pool, setPool] = useState<CareerAnswer[] | null>(null);
  useEffect(() => {
    loadCareer().then((c) => setPool(c.slice(0, POOL)));
  }, []);

  const today = dayNumber();
  const [day, setDay] = useState(today);
  useEffect(() => {
    const g = Number(new URLSearchParams(window.location.search).get("game"));
    if (g >= 1 && g <= today) setDay(g);
  }, [today]);
  const go = (g: number) => {
    setDay(g);
    window.history.replaceState(null, "", g === today ? window.location.pathname : `?game=${g}`);
  };
  const answer = useMemo(() => (pool ? daily(pool, day, 4099) : null), [pool, day]);
  const [save, setSave] = useDaily<Save>("career", day, { level: null, guesses: [], won: false, done: false });
  const [record, setRecord] = useRecord("career");
  const [showStats, setShowStats] = useState(false);
  const [toast, setToast] = useState<{ text: string; good: boolean } | null>(null);
  const [info, setInfo] = useState(false);
  const closeInfo = () => setInfo(false);

  const total = answer?.clubs.length ?? 0;
  const shown = save.done ? total : Math.min(total, 1 + save.guesses.length);
  // Rows that opened on this render, so only those type themselves in.
  const seen = useRef(shown);
  const fresh = shown > seen.current ? seen.current : shown;
  useEffect(() => {
    seen.current = shown;
  }, [shown]);

  const finish = (guesses: (string | null)[], won: boolean) => {
    setSave((s) => ({ ...s, guesses, won, done: true }));
    // Only today's puzzle counts toward the record.
    if (day === today) setRecord(recordResult("career", day, won, guesses.length));
    setToast({ text: won ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : "축구 지식 마이너스", good: won });
    window.setTimeout(() => {
      setToast(null);
      setShowStats(true);
    }, RESULT_MS);
  };

  const guess = (p: GridPick | null) => {
    if (!answer || save.done) return;
    const right = !!p && p.ko === answer.ko && p.en === answer.en;
    const guesses = [...save.guesses, p ? p.ko : null];
    if (right || guesses.length >= total) finish(guesses, right);
    else setSave((s) => ({ ...s, guesses }));
  };

  if (error) return <p className="py-16 text-center text-muted">게임 데이터를 불러오지 못했습니다.</p>;
  if (!answer || items.length === 0) return <p className="py-16 text-center text-muted">불러오는 중…</p>;

  const level = save.level;
  // The international career opens with the last club, as the original's does.
  const intlOpen = save.done || shown >= total;
  const intlFresh = intlOpen && fresh < shown;


  return (
    <div className="mx-auto max-w-[520px]">
      <div className="mb-2 flex items-center justify-between text-muted">
        <button type="button" onClick={() => setInfo(true)} aria-label="하는 법" className="rounded-[6px] p-1 hover:text-text">
          <Info className="size-6" />
        </button>
        <button type="button" onClick={() => setShowStats(true)} aria-label="통계" className="rounded-[6px] p-1 hover:text-text">
          <ChartBar className="size-6" />
        </button>
      </div>

      <Toast message={toast?.text ?? ""} variant={toast?.good ? "success" : "warning"} />

      {/* The infobox. A pale panel on the dark page, as a Wikipedia infobox is. */}
      <div className="overflow-hidden rounded-[10px] bg-[#f8f9fa] text-black shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)]">
        {level === null ? (
          <>
            <div className="bg-[#b0c4de] py-3 text-center font-mono text-[14px] font-bold tracking-wide">난이도 선택</div>
            <div className="px-4 py-8 text-center font-mono text-[15px]">
              {LEVELS.map((l, i) => (
                <span key={l.id}>
                  {i > 0 && (i === LEVELS.length - 1 ? " 또는 " : ", ")}
                  <button
                    type="button"
                    onClick={() => setSave((s) => ({ ...s, level: l.id }))}
                    className="text-[#0645ad] underline underline-offset-2 hover:text-[#0b0080]"
                  >
                    {l.ko}
                  </button>
                </span>
              ))}
              <p className="mt-3 font-sans text-[12px] text-[#57606a]">
                쉬움은 가려진 구단의 첫 글자와 글자 수, 보통은 글자 수만 보입니다. 어려움은 아무것도 안 보입니다.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="bg-[#b0c4de] py-3 text-center font-mono text-[14px] font-bold tracking-wide">선수 경력</div>
            <table className="w-full font-mono text-[13px]">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pl-4 font-bold">기간</th>
                  <th className="py-2 font-bold">구단</th>
                  <th className="py-2 text-right font-bold">출전</th>
                  <th className="py-2 pr-4 text-right font-bold">(골)</th>
                </tr>
              </thead>
              <tbody>
                {answer.clubs.map((c, i) => {
                  const open = i < shown;
                  const typing = open && i >= fresh;
                  const name = `${c[5] ? "→ " : ""}${c[2]}${c[5] ? " (임대)" : ""}`;
                  return (
                    <tr key={i} className={open ? "" : "text-[#8c959f]"}>
                      <td className="py-1 pl-4 whitespace-nowrap">
                        {open ? <Reveal text={span(c[0], c[1])} col={0} play={typing} /> : maskYears(c[0], c[1], level)}
                      </td>
                      <td className="py-1 pr-2">
                        {open ? (
                          <Reveal text={name} col={1} play={typing} />
                        ) : level === "hard" ? (
                          "------"
                        ) : (
                          `${c[5] ? "→ " : ""}${maskName(c[2], level)}${c[5] ? " (임대)" : ""}`
                        )}
                      </td>
                      <td className="py-1 text-right">{open ? <Reveal text={String(c[3] ?? "–")} col={2} play={typing} /> : maskNum(c[3], level)}</td>
                      <td className="py-1 pr-4 text-right whitespace-nowrap">
                        ({open ? <Reveal text={String(c[4] ?? "–")} col={3} play={typing} /> : maskNum(c[4], level)})
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {answer.intl.length > 0 && (
              <>
                <div className="mt-2 bg-[#b0c4de] py-3 text-center font-mono text-[14px] font-bold tracking-wide">국가대표 경력</div>
                <table className="w-full font-mono text-[13px]">
                  <tbody>
                    {answer.intl.map((c, i) => (
                      <tr key={i} className={intlOpen ? "" : "text-[#8c959f]"}>
                        <td className="py-1.5 pl-4 whitespace-nowrap">
                          {intlOpen ? <Reveal text={span(c[0], c[1])} col={0} play={intlFresh} /> : maskYears(c[0], c[1], level)}
                        </td>
                        <td className="py-1.5 pr-2">
                          {intlOpen ? <Reveal text={c[2]} col={1} play={intlFresh} /> : maskName(c[2], level)}
                        </td>
                        <td className="py-1.5 text-right">
                          {intlOpen ? <Reveal text={String(c[3] ?? "–")} col={2} play={intlFresh} /> : maskNum(c[3], level)}
                        </td>
                        <td className="py-1.5 pr-4 text-right">
                          ({intlOpen ? <Reveal text={String(c[4] ?? "–")} col={3} play={intlFresh} /> : maskNum(c[4], level)})
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            {grid?.built && (
              <p className="p-2 pb-4 text-center text-xs leading-tight text-[#2f4f4f]">
                클럽 리그 출전·골 기록 기준일: {grid.built}
              </p>
            )}
          </>
        )}
      </div>

      {level !== null && (
        <div className="mt-4">
          {save.done ? (
            <div className="mt-4 mb-6 text-center" style={{ animation: "toast-in 600ms ease-out both" }}>
              <p className="font-serif text-2xl text-text">{answer.ko}</p>
              <p className="text-[12.5px] text-muted">
                {answer.en}
                {answer.born ? ` · ${answer.born}년생` : ""}
              </p>
              <NextPuzzle storageKey="career" game={day} today={today} onGo={go} />
            </div>
          ) : (
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                <PlayerPicker
                  items={items}
                  onPick={(p) => guess(p)}
                  autoFocus
                  placeholder={`${save.guesses.length + 1}번째 추측 (총 ${total}번)`}
                />
              </div>
              <button
                type="button"
                data-press
                onClick={() => guess(null)}
                className="max-h-[53px] min-w-[70px] shrink-0 rounded-sm bg-rose-500 px-1.5 text-center font-bold text-white uppercase sm:min-w-[80px] sm:rounded-lg sm:px-3 sm:text-lg"
              >
                {save.guesses.length + 1 >= total ? "포기" : "건너뛰기"}
              </button>
            </div>
          )}
        </div>
      )}

      <ArchiveNav game={day} today={today} onGo={go} />

      {info && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/75 p-4" onClick={closeInfo}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="하는 법"
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm rounded-lg bg-gray-800 px-4 pt-5 pb-6 text-left text-white shadow-xl sm:px-6"
          >
            <button type="button" onClick={closeInfo} aria-label="닫기" className="absolute top-4 right-4 text-white/80 hover:text-white">
              <X className="size-6" />
            </button>
            <h3 className="mb-4 text-center text-lg font-medium">하는 법</h3>
            <p className="text-sm text-gray-300">
              이름난 선수를 그가 뛴 클럽 수만큼의 기회 안에 맞히세요. 오늘의 선수는 클럽 {total}곳에서 뛰었으니 {total}번
              추측할 수 있습니다.
            </p>
            <p className="mt-4 text-sm text-gray-300">
              시작하면 첫 클럽이 위키백과 같은 표로 나옵니다. 추측할 때마다 다음 클럽이 열리고, 마지막 클럽이 열리면
              국가대표 경력도 함께 보입니다.
            </p>
          </div>
        </div>
      )}

      {showStats && (
        <StatsModal
          record={record}
          buckets={["1", "2", "3", "4", "5", "6", "7+"]}
          highlight={save.won ? (save.guesses.length >= 7 ? "7+" : String(save.guesses.length)) : undefined}
          nextLabel="다음 문제까지"
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}
