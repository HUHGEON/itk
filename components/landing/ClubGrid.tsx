"use client";

import Link from "next/link";
import { animate, stagger, utils } from "animejs";
import type { Team } from "@/lib/types";
import { TeamCrest } from "@/components/TeamCrest";
import { useReveal } from "@/lib/motion";

/**
 * The clubs, using the crests the app already ships.
 *
 * These are real assets rather than placeholder photography, and each tile is a
 * link into that club's filter, so the section is navigation as much as it is
 * proof. The grid holds exactly as many cells as there are clubs.
 */
export function ClubGrid({ teams }: { teams: Team[] }) {
  const root = useReveal<HTMLElement>(
    (el) => utils.set(el.querySelectorAll("[data-club]"), { opacity: 0, scale: 0.9 }),
    (el) =>
      animate(el.querySelectorAll("[data-club]"), {
        opacity: 1,
        scale: 1,
        duration: 540,
        ease: "outExpo",
        delay: stagger(35, { from: "center" }),
      }),
  );

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
