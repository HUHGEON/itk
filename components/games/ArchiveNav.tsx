"use client";

import {
  ArrowsLeftRight,
  CaretDoubleLeft,
  CaretDoubleRight,
  CaretLeft,
  CaretRight,
} from "@phosphor-icons/react/dist/ssr";

/**
 * The daily games' pagination, as the original lays it out: first and
 * previous on the left, the number and a random game in the middle, next and
 * today on the right. Past games can be played but do not count.
 */
export function ArchiveNav({ game, today, onGo }: { game: number; today: number; onGo: (g: number) => void }) {
  return (
    <nav className="mt-2 flex items-center justify-between text-[13px] font-bold text-text" aria-label="지난 게임">
      <div className="flex items-center gap-1">
        <button type="button" disabled={game <= 1} onClick={() => onGo(1)} aria-label="첫 게임" className="p-1 text-[#ceff27] disabled:opacity-30">
          <CaretDoubleLeft className="size-4" weight="bold" />
        </button>
        <button type="button" disabled={game <= 1} onClick={() => onGo(game - 1)} className="flex items-center gap-1 p-1 disabled:opacity-30">
          <CaretLeft className="size-4 text-[#ceff27]" weight="bold" />
          이전
        </button>
      </div>
      <div className="flex items-center gap-1.5 text-muted">
        <span className="tnum">#{game}</span>
        <button
          type="button"
          aria-label="아무 게임이나"
          disabled={today <= 1}
          onClick={() => onGo(1 + Math.floor(Math.random() * today))}
          className="p-1 hover:text-text disabled:opacity-30"
        >
          <ArrowsLeftRight className="size-4" weight="bold" />
        </button>
      </div>
      <div className="flex items-center gap-1">
        <button type="button" disabled={game >= today} onClick={() => onGo(game + 1)} className="flex items-center gap-1 p-1 disabled:opacity-30">
          다음
          <CaretRight className="size-4 text-[#ceff27]" weight="bold" />
        </button>
        <button type="button" disabled={game >= today} onClick={() => onGo(today)} aria-label="오늘 게임" className="p-1 text-[#ceff27] disabled:opacity-30">
          <CaretDoubleRight className="size-4" weight="bold" />
        </button>
      </div>
    </nav>
  );
}

/**
 * After a puzzle: straight on to another. Picks a past puzzle this browser
 * has not finished, newest first, so a run of "one more" walks back through
 * the archive rather than landing on ones already solved.
 */
export function NextPuzzle({ storageKey, game, today, onGo }: { storageKey: string; game: number; today: number; onGo: (g: number) => void }) {
  const next = () => {
    for (let n = today; n >= 1; n--) {
      if (n === game) continue;
      try {
        const raw = localStorage.getItem(`itk:${storageKey}:${n}`);
        if (raw && JSON.parse(raw).done) continue;
      } catch {
        // unreadable: treat as unplayed
      }
      onGo(n);
      return;
    }
  };
  return (
    <button
      type="button"
      onClick={next}
      className="mx-auto mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-[14px] font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 active:scale-[0.98]"
    >
      다른 문제 풀기
      <CaretRight className="size-4" weight="bold" />
    </button>
  );
}
