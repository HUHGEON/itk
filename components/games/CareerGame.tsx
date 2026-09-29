"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import { loadCareer, type CareerAnswer } from "@/lib/games/data";
import { daily, dayNumber } from "@/lib/games/seed";
import { reducedMotion } from "@/lib/motion";
import { PlayerPicker } from "./PlayerPicker";
import { useGrid, type GridPick } from "./useGrid";
import { share, useDaily } from "./useDaily";

interface Save {
  guesses: string[];
  won: boolean;
  done: boolean;
}

/** Only the better-known half of the pool: a puzzle nobody can know is not one. */
const POOL = 350;

const span = (a: number, b: number | null) => (b === null ? `${a}–` : a === b ? `${a}` : `${a}–${b}`);

/**
 * Career Path: a player's clubs, one row at a time.
 *
 * The first club is shown; each wrong guess shows the next. There are as many
 * guesses as there are rows, so a journeyman is easier to reach than a
 * one-club man and harder to pin down early. The national team is held back
 * as a last clue - it narrows the field more than any single club.
 */
export function CareerGame() {
  const { items, error } = useGrid();
  const [pool, setPool] = useState<CareerAnswer[] | null>(null);
  useEffect(() => {
    loadCareer().then((c) => setPool(c.slice(0, POOL)));
  }, []);

  const day = dayNumber();
  const answer = useMemo(() => (pool ? daily(pool, day, 4099) : null), [pool, day]);
  const [save, setSave] = useDaily<Save>("career", day, { guesses: [], won: false, done: false });
  const [copied, setCopied] = useState(false);
  const table = useRef<HTMLTableSectionElement>(null);

  const total = answer?.clubs.length ?? 0;
  const shown = save.done ? total : Math.min(total, 1 + save.guesses.length);
  const left = total - save.guesses.length;
  const showIntl = save.done || left <= 1;

  // The row that just appeared, sliding in under the last one.
  const prevShown = useRef(shown);
  useEffect(() => {
    const body = table.current;
    if (!body || reducedMotion() || shown <= prevShown.current) {
      prevShown.current = shown;
      return;
    }
    const fresh = [...body.querySelectorAll<HTMLElement>("tr")].slice(prevShown.current, shown);
    prevShown.current = shown;
    animate(fresh, { opacity: [0, 1], x: [-12, 0], duration: 420, ease: "outExpo" });
  }, [shown]);

  const guess = (p: GridPick) => {
    if (!answer || save.done) return;
    const right = p.ko === answer.ko && p.en === answer.en;
    setSave((s) => {
      const guesses = [...s.guesses, p.ko];
      return { guesses, won: right, done: right || guesses.length >= total };
    });
  };

  if (error) return <p className="py-16 text-center text-muted">게임 데이터를 불러오지 못했습니다.</p>;
  if (!answer || items.length === 0) return <p className="py-16 text-center text-muted">불러오는 중…</p>;

  return (
    <div className="mx-auto max-w-[520px]">
      <div className="mb-3 flex items-baseline justify-between text-[12.5px] text-muted">
        <span className="font-semibold text-text">#{day}</span>
        <span className="tnum">
          {save.done ? (save.won ? `${save.guesses.length}번 만에 맞힘` : "실패") : `남은 기회 ${left}번`}
        </span>
      </div>

      {save.done && (
        <Reveal answer={answer} won={save.won} />
      )}

      <div className="overflow-hidden rounded-[10px] border border-border">
        <table className="w-full text-[13.5px]">
          <thead className="bg-surface-2 text-[11.5px] text-faint">
            <tr>
              <th className="py-2 pl-3 text-left font-semibold">기간</th>
              <th className="py-2 text-left font-semibold">구단</th>
              <th className="py-2 text-right font-semibold">출전</th>
              <th className="py-2 pr-3 text-right font-semibold">골</th>
            </tr>
          </thead>
          <tbody ref={table} className="divide-y divide-border/70">
            {answer.clubs.map((c, i) => {
              const open = i < shown;
              return (
                <tr key={i} className={open ? "" : "select-none"}>
                  <td className="tnum py-2.5 pl-3 text-muted">{open ? span(c[0], c[1]) : "····"}</td>
                  <td className="py-2.5 font-semibold text-text">
                    {open ? (
                      <>
                        {c[5] ? <span className="mr-1 text-faint">→</span> : null}
                        {c[2]}
                        {c[5] ? <span className="ml-1 text-[12px] font-normal text-faint">(임대)</span> : null}
                      </>
                    ) : (
                      <span className="inline-block h-3 w-28 rounded-[4px] bg-surface-3 align-middle" />
                    )}
                  </td>
                  <td className="tnum py-2.5 text-right text-muted">{open ? (c[3] ?? "–") : ""}</td>
                  <td className="tnum py-2.5 pr-3 text-right text-muted">{open ? (c[4] ?? "–") : ""}</td>
                </tr>
              );
            })}
          </tbody>
          {answer.intl.length > 0 && (
            <tbody className="border-t-2 border-border-strong">
              {showIntl ? (
                answer.intl.map((c, i) => (
                  <tr key={i}>
                    <td className="tnum py-2.5 pl-3 text-muted">{span(c[0], c[1])}</td>
                    <td className="py-2.5 font-semibold text-text">{c[2]} 대표팀</td>
                    <td className="tnum py-2.5 text-right text-muted">{c[3] ?? "–"}</td>
                    <td className="tnum py-2.5 pr-3 text-right text-muted">{c[4] ?? "–"}</td>
                  </tr>
                ))
              ) : (
                // One line however many national sides there were: saying "two
                // countries" before the last guess would be a clue of its own.
                <tr>
                  <td className="py-2.5 pl-3 text-muted">····</td>
                  <td colSpan={3} className="py-2.5 text-[12px] text-faint">
                    국가대표 · 마지막 기회에 공개
                  </td>
                </tr>
              )}
            </tbody>
          )}
        </table>
      </div>

      <div className="mt-4">
        {save.done ? (
          <button
            type="button"
            data-press
            onClick={async () => {
              const marks = save.guesses.map((_, i) => (save.won && i === save.guesses.length - 1 ? "🟩" : "🟥")).join("");
              setCopied(await share(`ITK+ 커리어 추적 #${day}\n${marks}\nhttps://itkplus.vercel.app/games/career`));
            }}
            className="w-full rounded-[10px] border border-border-strong py-3 text-[14px] font-semibold text-text hover:bg-surface-2"
          >
            {copied ? "복사했습니다" : "결과 복사"}
          </button>
        ) : (
          <PlayerPicker items={items} onPick={guess} autoFocus placeholder="누구의 커리어일까요? (한글·영문·초성)" />
        )}
      </div>

      {save.guesses.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {save.guesses.map((g, i) => {
            const right = save.won && i === save.guesses.length - 1;
            return (
              <li
                key={i}
                className={`rounded-full px-2.5 py-1 text-[12.5px] ${
                  right ? "bg-emerald-500/20 text-emerald-300" : "bg-surface-2 text-muted line-through decoration-faint"
                }`}
              >
                {g}
              </li>
            );
          })}
        </ul>
      )}

      {save.guesses.length === 0 && (
        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          첫 구단부터 한 줄씩 공개됩니다. 틀릴 때마다 다음 구단이 열리고, 기회는 구단 수만큼입니다.
          국가대표 경력은 마지막 기회에 공개됩니다.
        </p>
      )}
    </div>
  );
}

function Reveal({ answer, won }: { answer: CareerAnswer; won: boolean }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current || reducedMotion()) return;
    animate(el.current, { scale: [0.92, 1], opacity: [0, 1], duration: 520, ease: "outBack(1.4)" });
  }, []);
  return (
    <div ref={el} className="mb-3 rounded-[10px] border border-border-strong bg-surface p-4 text-center">
      <p className="text-[12px] font-bold tracking-[0.2em] text-faint">{won ? "정답" : "오늘의 선수"}</p>
      <p className={`mt-1 text-[22px] font-bold ${won ? "text-emerald-300" : "text-text"}`}>{answer.ko}</p>
      <p className="text-[12.5px] text-muted">
        {answer.en}
        {answer.born ? ` · ${answer.born}년생` : ""}
      </p>
    </div>
  );
}
