"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { STAGE_SCREENS } from "./PitchSequence";

/**
 * The bar stays out of the way until the ball has had its turn.
 *
 * The opening is one image - grass, a ball, a line of type - and a navigation
 * bar sitting on top of it is the one thing in shot that says "website". It is
 * also not needed there: the only place to go from the opening is down. So it
 * is absent for the length of the sequence and slides in underneath the reader
 * once the ball is behind them, from which point every screen is ordinary page
 * content that wants a way out.
 *
 * Fixed rather than sticky. A sticky bar is still part of the flow, so it took
 * 4rem off the top of a stage that wants the whole window; out of the flow, the
 * pitch runs edge to edge.
 *
 * The marker is a strip as tall as the sequence, pinned to the top of the page.
 * Watching it leave is the same question as "is the ball behind us", and it is
 * one IntersectionObserver rather than a handler on every scroll frame.
 */
export function LandingHeader() {
  const marker = useRef<HTMLDivElement>(null);
  const [past, setPast] = useState(false);

  useEffect(() => {
    const el = marker.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        // Above the viewport, not merely out of it: scrolling back up has to
        // put the bar away again.
        setPast(!entry.isIntersecting && entry.boundingClientRect.bottom <= 0);
      },
      { threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      <div
        ref={marker}
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 w-px"
        style={{ height: `${STAGE_SCREENS * 100}dvh` }}
      />
      <header
        className={`fixed top-0 right-0 left-0 z-30 border-b border-transparent bg-bg/80 backdrop-blur-sm transition-[transform,opacity] duration-300 ${
          past
            ? "translate-y-0 border-border opacity-100"
            : "pointer-events-none -translate-y-full opacity-0"
        }`}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-[var(--gutter)]">
          <Link href="/" aria-label="ITK plus 홈" className="shrink-0">
            <Logo height={26} />
          </Link>
          <Link
            href="/feed"
            className="rounded-md px-3 py-1.5 text-[13px] font-medium text-muted transition-colors hover:text-text"
          >
            오늘의 이적 소식
          </Link>
        </div>
      </header>
    </>
  );
}
