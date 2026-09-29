"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { ChartBar } from "@phosphor-icons/react/dist/ssr";
import { loadCareer, type CareerAnswer } from "@/lib/games/data";
import { daily, dayNumber } from "@/lib/games/seed";
import { reducedMotion } from "@/lib/motion";
import { PlayerPicker } from "./PlayerPicker";
import { useGrid, type GridPick } from "./useGrid";
import { share, useDaily } from "./useDaily";
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
 * Text that types itself in, as the original's rows do when they open.
 * Renders the finished text straight away under reduced motion.
 */
function Typed({ text, play }: { text: string; play: boolean }) {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = el.current;
    if (!node || !play || reducedMotion()) return;
    const chars = [...text];
    const t = { n: 0 };
    node.textContent = "";
    const anim = animate(t, {
      n: chars.length,
      duration: Math.min(700, 40 * chars.length + 120),
      ease: "linear",
      onUpdate: () => {
        node.textContent = chars.slice(0, Math.round(t.n)).join("");
      },
      onComplete: () => {
        node.textContent = text;
      },
    });
    return () => {
      anim.revert();
      node.textContent = text;
    };
  }, [text, play]);
  return <span ref={el}>{text}</span>;
}

/**
 * Career Path: a player's clubs as a Wikipedia infobox, one row at a time.
 *
 * The first club is shown. A wrong guess or a skip opens the next row; there
 * are as many guesses as rows. The difficulty decides how much of a hidden row
 * shows through its mask. The international career stays hidden until the
 * game is over.
 */
export function CareerGame() {
  const { items, error } = useGrid();
  const [pool, setPool] = useState<CareerAnswer[] | null>(null);
  useEffect(() => {
    loadCareer().then((c) => setPool(c.slice(0, POOL)));
  }, []);

  const day = dayNumber();
  const answer = useMemo(() => (pool ? daily(pool, day, 4099) : null), [pool, day]);
  const [save, setSave] = useDaily<Save>("career", day, { level: null, guesses: [], won: false, done: false });
  const [record, setRecord] = useRecord("career");
  const [showStats, setShowStats] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const total = answer?.clubs.length ?? 0;
  const shown = save.done ? total : Math.min(total, 1 + save.guesses.length);
  // Rows that opened on this render, so only those type themselves in.
  const seen = useRef(shown);
  const fresh = shown > seen.current ? seen.current : shown;
  useEffect(() => {
    seen.current = shown;
  }, [shown]);

  const toastEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!toast || !toastEl.current || reducedMotion()) return;
    animate(toastEl.current, { opacity: [0, 1], y: [-10, 0], duration: 300, ease: "outExpo" });
    const id = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  const finish = (guesses: (string | null)[], won: boolean) => {
    setSave((s) => ({ ...s, guesses, won, done: true }));
    setRecord(recordResult("career", day, won, guesses.length));
    setToast(won ? "정답입니다!" : "아쉽네요");
    window.setTimeout(() => setShowStats(true), 1800);
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

  const shareText = () => {
    const marks = save.guesses.map((g, i) => (save.won && i === save.guesses.length - 1 ? "🟩" : g ? "🟥" : "⬜")).join("");
    return `ITK+ 커리어 추적 #${day} (${LEVELS.find((l) => l.id === level)?.ko})\n${marks}\nhttps://itkplus.vercel.app/games/career`;
  };

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="mb-2 flex items-center justify-between text-[12.5px] text-muted">
        <span className="font-semibold text-text">#{day}</span>
        <button type="button" onClick={() => setShowStats(true)} aria-label="통계" className="rounded-[6px] p-1 text-muted hover:text-text">
          <ChartBar className="size-5" />
        </button>
      </div>

      {toast && (
        <div ref={toastEl} className="fixed top-20 left-1/2 z-40 -translate-x-1/2 rounded-[6px] bg-[var(--p1)] px-4 py-2 text-[14px] font-bold text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* The infobox. A pale panel on the dark page, as a Wikipedia infobox is. */}
      <div className="overflow-hidden rounded-[10px] bg-[#f6f8fa] text-[#1f2328] shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)]">
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
                        {open ? <Typed text={span(c[0], c[1])} play={typing} /> : maskYears(c[0], c[1], level)}
                      </td>
                      <td className="py-1 pr-2">
                        {open ? (
                          <Typed text={name} play={typing} />
                        ) : level === "hard" ? (
                          "------"
                        ) : (
                          `${c[5] ? "→ " : ""}${maskName(c[2], level)}${c[5] ? " (임대)" : ""}`
                        )}
                      </td>
                      <td className="py-1 text-right">{open ? <Typed text={String(c[3] ?? "–")} play={typing} /> : maskNum(c[3], level)}</td>
                      <td className="py-1 pr-4 text-right whitespace-nowrap">
                        ({open ? <Typed text={String(c[4] ?? "–")} play={typing} /> : maskNum(c[4], level)})
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
                      <tr key={i} className={save.done ? "" : "text-[#8c959f]"}>
                        <td className="py-1.5 pl-4 whitespace-nowrap">
                          {save.done ? <Typed text={span(c[0], c[1])} play /> : maskYears(c[0], c[1], level)}
                        </td>
                        <td className="py-1.5 pr-2">
                          {save.done ? <Typed text={c[2]} play /> : maskName(c[2], level)}
                        </td>
                        <td className="py-1.5 text-right">{save.done ? (c[3] ?? "–") : maskNum(c[3], level)}</td>
                        <td className="py-1.5 pr-4 text-right">({save.done ? (c[4] ?? "–") : maskNum(c[4], level)})</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
            <div className="h-3" />
          </>
        )}
      </div>

      {level !== null && (
        <div className="mt-4">
          {save.done ? (
            <div className="text-center">
              <p className={`font-serif text-[24px] ${save.won ? "text-emerald-300" : "text-text"}`}>{answer.ko}</p>
              <p className="text-[12.5px] text-muted">
                {answer.en}
                {answer.born ? ` · ${answer.born}년생` : ""}
              </p>
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
                className="shrink-0 rounded-[10px] bg-[var(--p2)] px-5 text-[14px] font-bold text-white hover:opacity-90"
              >
                건너뛰기
              </button>
            </div>
          )}
        </div>
      )}

      {showStats && (
        <StatsModal
          record={record}
          buckets={["1", "2", "3", "4", "5", "6", "7+"]}
          highlight={save.won ? (save.guesses.length >= 7 ? "7+" : String(save.guesses.length)) : undefined}
          nextLabel="다음 문제까지"
          shared={copied}
          onShare={async () => setCopied(await share(shareText()))}
          onClose={() => setShowStats(false)}
        />
      )}
    </div>
  );
}
