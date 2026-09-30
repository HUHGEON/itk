"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { animate } from "animejs";
import { Chevron, ChevronLeft } from "./icons";
import { reducedMotion, useBeforePaint } from "@/lib/motion";

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

    /*
     * Non-passive: translating the wheel means preventing the page scroll it
     * would otherwise cause.
     *
     * Two things made this feel broken, both measured with synthetic wheel
     * events on the league rail (481px of overflow):
     *  - Line-mode deltas (Firefox, and many wheel mice) arrive as "3 lines",
     *    and adding 3 to scrollLeft moved the rail 9px for three notches.
     *    They are converted to pixels now.
     *  - Under scroll-behavior: smooth, each notch restarted the animation
     *    from wherever the last one had got to, so three 100px notches moved
     *    199px. The destination is kept here instead and each notch adds to
     *    it, so three notches go 300px.
     */
    let target: number | null = null;
    let settle: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 0) return;
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? el.clientWidth : 1;
      const delta = e.deltaY * unit;
      const from = target ?? el.scrollLeft;
      // At either end, let the gesture fall through to the page.
      if ((delta < 0 && from <= 0.5) || (delta > 0 && from >= max - 0.5)) return;
      e.preventDefault();
      target = Math.min(max, Math.max(0, from + delta));
      el.scrollTo({ left: target, behavior: reducedMotion() ? "auto" : "smooth" });
      clearTimeout(settle);
      settle = setTimeout(() => (target = null), 350);
    };
    el.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      el.removeEventListener("scroll", sync);
      el.removeEventListener("wheel", onWheel);
      clearTimeout(settle);
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
  const ref = useRef<HTMLButtonElement>(null);

  // The arrows mount and unmount as the rail reaches its ends, so a chip
  // scrolled one pixel too far made a control appear and vanish beside the
  // cursor. Fading covers the boundary, where the answer to "can I still
  // scroll" is genuinely almost-no rather than yes-or-no.
  useBeforePaint(() => {
    const el = ref.current;
    if (!el || reducedMotion()) return;
    const anim = animate(el, {
      opacity: [0, 1],
      duration: 180,
      ease: "outQuad",
    });
    return () => {
      anim.revert();
    };
  }, []);

  return (
    <button
      ref={ref}
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
