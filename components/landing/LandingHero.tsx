"use client";

import { useRef } from "react";
import { animate, onScroll, stagger, utils } from "animejs";
import { tierColor, tierLabel } from "@/lib/format";
import { reducedMotion, useBeforePaint } from "@/lib/motion";

/**
 * The tier list, with the real headcount at each level.
 *
 * The site's premise is that the byline decides whether a rumour is worth
 * reading, so this shows the ladder rather than describing it. Bars are scaled
 * to the busiest tier rather than to the total: the question is "how many
 * people sit at this level", not "what share of a pie is this".
 *
 * Scrubbed, so the ladder fills as the section is read rather than firing once
 * and being over before the reader arrives.
 */

export interface TierRow {
  tier: number;
  count: number;
}

export function TierLadder({
  tiers,
  total,
}: {
  tiers: TierRow[];
  total: number;
}) {
  const max = Math.max(...tiers.map((t) => t.count), 1);
  const root = useRef<HTMLElement>(null);

  useBeforePaint(() => {
    const el = root.current;
    if (!el || reducedMotion()) return;

    const bars = Array.from(el.querySelectorAll<HTMLElement>("[data-bar]"));
    const totalEl = el.querySelector<HTMLElement>("[data-total]");
    if (bars.length === 0) return;

    // From-state in JS, resting state in the markup: with no script the ladder
    // still renders at full width with the real numbers in it.
    utils.set(bars, { scaleX: 0 });
    const target = Number(totalEl?.textContent ?? 0);

    const bar = animate(bars, {
      scaleX: 1,
      ease: "outQuad",
      delay: stagger(60),
      autoplay: onScroll({ target: el, sync: true }),
    });

    // The headline count follows the bars rather than running on its own clock,
    // so the number and the shape agree at every scroll position.
    const tick = { v: 0 };
    const count = animate(tick, {
      v: target,
      ease: "linear",
      autoplay: onScroll({ target: el, sync: true }),
      onUpdate: () => {
        if (totalEl) totalEl.textContent = String(Math.round(tick.v));
      },
    });

    return () => {
      bar.revert();
      count.revert();
      if (totalEl) totalEl.textContent = String(target);
      for (const b of bars) b.style.transform = "";
    };
  }, []);

  return (
    <section
      ref={root}
      className="border-b border-border px-[var(--gutter)] py-20 lg:py-28"
    >
      <div className="mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_1fr] lg:items-center lg:gap-20">
        <div className="min-w-0">
          <h2 className="text-[1.9rem] leading-tight font-bold tracking-tight text-text sm:text-4xl">
            기자를 다섯 층으로
            <br className="hidden sm:block" /> 나눠 둡니다
          </h2>
          <p className="mt-5 max-w-[46ch] text-[14.5px] leading-[1.8] text-text/75">
            0티어는 자기가 취재해서 처음 알리는 사람입니다. 아래로 내려갈수록
            남의 말을 옮기는 비중이 커집니다. 화면에서는 색으로 구분되니 기사
            하나하나를 검증할 필요가 없습니다.
          </p>
        </div>

        <div className="min-w-0">
          <div className="flex items-baseline justify-between border-b border-border pb-2.5">
            <span className="text-[13px] font-semibold text-text">기자 티어</span>
            <span className="tnum text-[12px] text-faint">
              <span data-total>{total}</span>명
            </span>
          </div>
          <ul className="mt-5 space-y-4">
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
