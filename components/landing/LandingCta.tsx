"use client";

import Link from "next/link";
import { animate, utils } from "animejs";
import { useReveal } from "@/lib/motion";

/**
 * One way out of the page, using the same label as the hero.
 *
 * The site has exactly one thing to do, so there is one CTA intent and one
 * wording for it. A second phrasing of "go read the feed" would read as two
 * different destinations.
 */
export function LandingCta({ todayCount }: { todayCount: number }) {
  const root = useReveal<HTMLElement>(
    (el) => utils.set(el.querySelectorAll("[data-rise]"), { opacity: 0, y: 16 }),
    (el) =>
      animate(el.querySelectorAll("[data-rise]"), {
        opacity: 1,
        y: 0,
        duration: 640,
        ease: "outExpo",
        delay: (_t, i) => (i ?? 0) * 90,
      }),
  );

  return (
    <section ref={root} className="px-[var(--gutter)] py-20 lg:py-28">
      <div className="mx-auto max-w-3xl text-center">
        <h2
          data-rise
          className="text-[2.1rem] leading-tight font-bold tracking-tight text-text sm:text-5xl"
        >
          지금 {todayCount}건이 올라와 있습니다
        </h2>
        <p
          data-rise
          className="mx-auto mt-5 max-w-[44ch] text-[14.5px] leading-relaxed text-muted"
        >
          20분마다 새로 모읍니다. 계정도, 결제도 없습니다.
        </p>
        <div data-rise className="mt-9">
          <Link
            href="/feed"
            className="inline-flex items-center gap-2 rounded-[6px] px-6 py-3.5 text-[14.5px] font-semibold text-accent-ink transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none"
            style={{ background: "var(--ribbon)" }}
          >
            오늘의 이적 소식
            <svg width="14" height="14" viewBox="0 0 12 12" fill="none" aria-hidden>
              <path
                d="M2 6h8M6.5 2.5 10 6l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
