"use client";

import { animate, stagger, utils } from "animejs";
import { useReveal } from "@/lib/motion";

/**
 * The size of the thing, in four numbers.
 *
 * No cards. Four figures separated by hairlines and space, because a box around
 * each one would add a border for every number and communicate nothing. The
 * counts run up when the strip arrives, which is what makes 244 read as a lot
 * rather than as a label.
 */
export function ScaleStrip({
  stats,
}: {
  stats: { value: number; unit: string; label: string }[];
}) {
  const root = useReveal<HTMLElement>(
    (el) => {
      const nums = el.querySelectorAll<HTMLElement>("[data-n]");
      utils.set(el.querySelectorAll("[data-cell]"), { opacity: 0, y: 12 });
      for (const n of nums) n.textContent = "0";
    },
    (el) => {
      animate(el.querySelectorAll("[data-cell]"), {
        opacity: 1,
        y: 0,
        duration: 620,
        ease: "outExpo",
        delay: stagger(80),
      });
      const nums = Array.from(el.querySelectorAll<HTMLElement>("[data-n]"));
      nums.forEach((n, i) => {
        const to = Number(n.dataset.n);
        const tick = { v: 0 };
        animate(tick, {
          v: to,
          duration: 900,
          ease: "outExpo",
          delay: i * 80,
          onUpdate: () => {
            n.textContent = String(Math.round(tick.v));
          },
          onComplete: () => {
            n.textContent = String(to);
          },
        });
      });
    },
  );

  return (
    <section
      ref={root}
      className="border-b border-border px-[var(--gutter)] py-14 lg:py-20"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} data-cell className="min-w-0">
            <p className="tnum text-[2.4rem] leading-none font-bold tracking-tight text-text sm:text-5xl">
              <span data-n={s.value}>{s.value}</span>
              <span className="ml-0.5 text-[1.1rem] font-medium text-muted sm:text-2xl">
                {s.unit}
              </span>
            </p>
            <p className="mt-2.5 text-[12.5px] text-muted">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
