"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Chevron, ChevronLeft } from "./icons";

/**
 * A horizontally scrolling row that a mouse can actually operate.
 *
 * A trackpad scrolls sideways with a two-finger swipe; a wheel mouse has no
 * such gesture, so a plain `overflow-x-auto` rail is unreachable past its first
 * screenful. This adds edge arrows and maps vertical wheel input onto the
 * horizontal axis while the pointer is over the rail.
 */
export function ScrollRail({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const sync = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setAtStart(el.scrollLeft <= 1);
    // 1px of slack: fractional layout widths never land exactly on the end.
    setAtEnd(el.scrollLeft >= max - 1);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    sync();
    el.addEventListener("scroll", sync, { passive: true });

    const ro = new ResizeObserver(sync);
    ro.observe(el);
    for (const child of Array.from(el.children)) ro.observe(child);

    // Non-passive: translating the wheel means preventing the page scroll it
    // would otherwise cause.
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      // At either end, let the gesture fall through to the page.
      if (
        (e.deltaY < 0 && el.scrollLeft <= 0) ||
        (e.deltaY > 0 && el.scrollLeft >= max)
      ) {
        return;
      }
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("scroll", sync);
      el.removeEventListener("wheel", onWheel);
      ro.disconnect();
    };
  }, [sync, children]);

  const nudge = (dir: -1 | 1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({
      left: dir * Math.max(el.clientWidth * 0.7, 160),
      behavior: "smooth",
    });
  };

  const hasOverflow = !atStart || !atEnd;

  return (
    <div className="relative">
      <div
        ref={ref}
        className={`no-scrollbar overflow-x-auto scroll-smooth ${className}`}
      >
        {children}
      </div>

      {hasOverflow && !atStart && (
        <RailButton side="left" onClick={() => nudge(-1)} />
      )}
      {hasOverflow && !atEnd && (
        <RailButton side="right" onClick={() => nudge(1)} />
      )}
    </div>
  );
}

function RailButton({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const isLeft = side === "left";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? "왼쪽으로" : "오른쪽으로"}
      // Fades into the surface so it reads as an affordance on the rail rather
      // than a control floating over the content.
      className={`absolute inset-y-0 z-10 flex w-9 items-center ${
        isLeft
          ? "left-0 justify-start bg-gradient-to-r"
          : "right-0 justify-end bg-gradient-to-l"
      } from-surface via-surface/80 to-transparent text-muted transition-colors hover:text-text`}
    >
      {isLeft ? <ChevronLeft /> : <Chevron size={14} />}
    </button>
  );
}
