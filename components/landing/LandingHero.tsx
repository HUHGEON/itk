"use client";

import Link from "next/link";
import { useRef } from "react";
import { animate, stagger, utils } from "animejs";
import { tierColor, tierLabel } from "@/lib/format";
import { reducedMotion, useBeforePaint } from "@/lib/motion";

/**
 * Asymmetric split: the claim on the left, the thing it claims about on the right.
 *
 * The premise of the site is that the byline decides whether a transfer rumour
 * is worth reading. So the hero does not describe the tier list, it shows it,
 * with the real headcount at each level. A centred headline over a gradient
 * would have said the same words and proved none of them.
 *
 * This one plays on mount rather than on scroll, because it is the only section
 * that is already on screen when the page opens.
 */

export interface TierRow {
  tier: number;
  count: number;
}

export function LandingHero({
  tiers,
  total,
}: {
  tiers: TierRow[];
  total: number;
}) {
  const max = Math.max(...tiers.map((t) => t.count), 1);
  const ladder = useRef<HTMLDivElement>(null);
  const headline = useRef<HTMLHeadingElement>(null);

  /**
   * The two lines of the headline arrive one after the other.
   *
   * `splitText` was tried first and dropped: it duplicated the line on this
   * markup (the headline carries a `<br>` and a coloured `<span>`), and a
   * per-glyph split makes a screen reader spell Korean out syllable by
   * syllable. Two lines sliding in reads the same at this size and cannot
   * mangle the text.
   */
  useBeforePaint(() => {
    const el = headline.current;
    if (!el || reducedMotion()) return;
    const lines = Array.from(el.querySelectorAll<HTMLElement>("[data-line]"));
    if (lines.length === 0) return;

    utils.set(lines, { opacity: 0, y: "0.35em" });
    const anim = animate(lines, {
      opacity: 1,
      y: "0em",
      duration: 820,
      ease: "outExpo",
      delay: stagger(120),
    });
    return () => {
      anim.revert();
      for (const l of lines) {
        l.style.opacity = "";
        l.style.transform = "";
      }
    };
  }, []);

  useBeforePaint(() => {
    const el = ladder.current;
    if (!el || reducedMotion()) return;

    const bars = Array.from(el.querySelectorAll<HTMLElement>("[data-bar]"));
    const totalEl = el.querySelector<HTMLElement>("[data-total]");
    if (bars.length === 0) return;

    // From-state in JS, resting state in the markup: with no script the ladder
    // still renders at full width with the real numbers in it.
    utils.set(bars, { scaleX: 0 });
    const target = Number(totalEl?.textContent ?? 0);
    if (totalEl) totalEl.textContent = "0";

    // Top down, which is the order it is read in and the order that matters:
    // 0-tier first, then everything that is not.
    const bar = animate(bars, {
      scaleX: 1,
      duration: 900,
      ease: "outExpo",
      delay: stagger(90),
    });

    const tick = { v: 0 };
    const count = animate(tick, {
      v: target,
      duration: 900,
      ease: "outExpo",
      onUpdate: () => {
        if (totalEl) totalEl.textContent = String(Math.round(tick.v));
      },
      onComplete: () => {
        if (totalEl) totalEl.textContent = String(target);
      },
    });

    return () => {
      bar.revert();
      count.revert();
      if (totalEl) totalEl.textContent = String(target);
    };
  }, []);

  return (
    <section className="border-b border-border px-[var(--gutter)] pt-16 pb-20 lg:pt-24 lg:pb-28">
      <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div className="min-w-0">
          <h1
            ref={headline}
            className="text-[2.6rem] leading-[1.06] font-bold tracking-tight text-text sm:text-6xl lg:text-[4.2rem]"
          >
            <span data-line className="block">
              매체보다
            </span>
            <span data-line className="block">
              <span className="text-accent">저자</span>가 중요하다
            </span>
          </h1>
          <p className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-muted sm:text-base">
            같은 이적설도 누가 처음 말했느냐에 따라 값이 다릅니다. 해외 기자
            244명을 신뢰도로 나눠, 그 사람이 쓴 것만 모읍니다.
          </p>
          <div className="mt-9">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-[6px] px-5 py-3 text-[14px] font-semibold text-accent-ink transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none"
              style={{ background: "var(--ribbon)" }}
            >
              오늘의 이적 소식
              <svg
                width="14"
                height="14"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
              >
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

        {/* Bars are scaled to the busiest tier rather than to the total, so the
            shape reads as "how many people sit at this level" instead of as a
            pie chart of one number. */}
        <div ref={ladder} className="min-w-0">
          <div className="flex items-baseline justify-between border-b border-border pb-2.5">
            <span className="text-[13px] font-semibold text-text">기자 티어</span>
            <span className="tnum text-[12px] text-faint">
              <span data-total>{total}</span>명
            </span>
          </div>
          <ul className="mt-4 space-y-3.5">
            {tiers.map((t) => (
              <li key={t.tier} className="flex items-center gap-3.5">
                <span
                  className="w-[52px] shrink-0 text-[12.5px] font-medium"
                  style={{ color: tierColor(t.tier) }}
                >
                  {tierLabel(t.tier)}
                </span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span
                    data-bar
                    className="block h-full origin-left rounded-full"
                    style={{
                      width: `${(t.count / max) * 100}%`,
                      backgroundColor: tierColor(t.tier),
                    }}
                  />
                </span>
                <span className="tnum w-8 shrink-0 text-right text-[12.5px] text-text/80">
                  {t.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
