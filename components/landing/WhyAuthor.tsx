"use client";

import { animate, stagger, utils } from "animejs";
import { useReveal } from "@/lib/motion";

/**
 * The argument, then the receipts.
 *
 * Full-bleed prose rather than a split header, and the proof underneath is a
 * list of people who actually exist in the registry. Naming six reporters an
 * ITK reader will recognise does more than another paragraph about accuracy.
 *
 * The names arrive one at a time, which is the only motion here: it makes the
 * list read as a roll call rather than as a block of text that appeared.
 */
export function WhyAuthor({
  names,
}: {
  names: { ko: string; outlet: string }[];
}) {
  const root = useReveal<HTMLElement>(
    (el) =>
      utils.set(el.querySelectorAll("[data-name]"), { opacity: 0, x: -10 }),
    (el) =>
      animate(el.querySelectorAll("[data-name]"), {
        opacity: 1,
        x: 0,
        duration: 520,
        ease: "outExpo",
        delay: stagger(60),
      }),
  );

  return (
    <section
      ref={root}
      className="border-b border-border px-[var(--gutter)] py-16 lg:py-24"
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="text-[1.9rem] leading-tight font-bold tracking-tight text-text sm:text-4xl">
          같은 소식이
          <br className="hidden sm:block" /> 열 번씩 뜨지 않게
        </h2>
        <p className="mt-6 text-[15px] leading-[1.8] text-text/75">
          이적설 하나에 수십 개 매체가 같은 내용을 씁니다. 여기서는 처음 쓴
          기자를 기준으로 묶어서 한 번만 보여줍니다. 아래가 그 0티어
          기자들입니다.
        </p>

        <ul className="mt-10 space-y-0">
          {names.map((n) => (
            <li
              key={n.ko}
              data-name
              className="flex items-baseline gap-3 border-b border-border py-3 last:border-b-0"
            >
              <span
                aria-hidden
                className="h-[11px] w-[3px] shrink-0 translate-y-[1px] rounded-full"
                style={{ backgroundColor: "var(--tier-0)" }}
              />
              <span className="text-[14.5px] font-semibold text-text">
                {n.ko}
              </span>
              <span className="min-w-0 truncate text-[12.5px] text-muted">
                {n.outlet}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
