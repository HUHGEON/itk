"use client";

import Link from "next/link";
import { animate, onScroll, stagger, utils } from "animejs";
import type { Team } from "@/lib/types";
import { TeamCrest } from "@/components/TeamCrest";
import { reducedMotion, useBeforePaint } from "@/lib/motion";
import { useRef } from "react";

/**
 * The clubs, using the crests the app already ships.
 *
 * Real assets rather than placeholder photography, and each tile links into
 * that club's filter, so the section is navigation as much as it is proof.
 *
 * The tiles are tied to the scrollbar rather than fired once on entry. That is
 * the difference between an animation that happens at you and one you drive:
 * scroll down and the grid spins into place, scroll back up and it unwinds.
 *
 * It also removes a whole class of bug. A scroll-triggered entrance has to
 * answer "what if the reader never saw the trigger" - drag the scrollbar past a
 * section and IntersectionObserver reports nothing, leaving the content stuck
 * at opacity 0. With the scrollbar as the clock there is no trigger to miss:
 * the position of the page IS the state of the animation.
 */
export function ClubGrid({ teams }: { teams: Team[] }) {
  const root = useRef<HTMLElement>(null);

  useBeforePaint(() => {
    const el = root.current;
    if (!el || reducedMotion()) return;

    const cells = Array.from(el.querySelectorAll<HTMLElement>("[data-club]"));
    if (cells.length === 0) return;

    const anim = animate(cells, {
      opacity: [0, 1],
      scale: [0.6, 1],
      rotate: [-24, 0],
      ease: "outQuad",
      delay: stagger(60, { from: "center" }),
      // `sync` is what makes it scrub rather than play. The window is the
      // section's own travel through the viewport, so the grid is fully
      // assembled by the time it is centred and readable.
      // No `container`: the scrolling element here is <html>, not <body>
      // (measured), and naming the wrong one leaves the observer watching a box
      // that never scrolls. `target` is the section, so the window the grid
      // scrubs through is the section's own travel across the viewport.
      // No `container`: the scrolling element here is <html>, not <body>
      // (measured), and naming the wrong one leaves the observer watching a box
      // that never scrolls. `target` is the section, so the scrub window is the
      // section's own travel across the viewport.
      //
      // Deliberately no `enter`/`leave` thresholds: passing them stopped the
      // observer dead in testing, while the bare `sync` form scrubs correctly.
      // The section is placed mid-page instead, which is what actually gives
      // the animation room to finish before the page runs out of scroll.
      autoplay: onScroll({ target: el, sync: true }),
    });

    return () => {
      anim.revert();
      utils.set(cells, { opacity: 1, scale: 1, rotate: 0 });
      for (const c of cells) {
        c.style.opacity = "";
        c.style.transform = "";
      }
    };
  }, []);

  return (
    <section
      ref={root}
      className="border-b border-border px-[var(--gutter)] py-16 lg:py-24"
    >
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-[24ch] text-[1.9rem] leading-tight font-bold tracking-tight text-text sm:text-4xl">
          구단으로 걸러 보세요
        </h2>
        <p className="mt-4 max-w-[52ch] text-[14.5px] leading-relaxed text-muted">
          기사 본문에서 구단을 찾아 자동으로 붙입니다. 뉴캐슬만 보고 싶으면
          뉴캐슬만 나옵니다.
        </p>

        <ul className="mt-11 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {teams.map((t) => (
            <li key={t.slug} data-club>
              <Link
                href={`/?team=${t.slug}`}
                className="flex flex-col items-center gap-2.5 rounded-lg border border-border bg-surface px-2 py-4 transition-colors hover:border-border-strong hover:bg-surface-2"
              >
                <TeamCrest team={t} size={30} />
                <span className="w-full truncate text-center text-[11.5px] text-muted">
                  {t.ko}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
