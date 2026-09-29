"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GAMES } from "@/lib/games/catalog";

/** The rail on game pages: the four games, the current one marked. */
export function GamesRail() {
  const path = usePathname();
  return (
    <nav className="px-[var(--gutter)] py-3">
      <h2 className="px-1 pb-1.5 text-[11px] font-semibold tracking-wide text-faint">미니게임</h2>
      <ul className="space-y-0.5">
        {GAMES.map((g) => {
          const on = path === `/games/${g.slug}`;
          return (
            <li key={g.slug}>
              <Link
                href={`/games/${g.slug}`}
                aria-current={on ? "page" : undefined}
                className={`flex items-center justify-between gap-2 rounded-[6px] px-2 py-2 text-[13px] transition-colors ${
                  on ? "bg-accent/15 font-semibold text-text" : "text-muted hover:bg-surface-2/60 hover:text-text"
                }`}
              >
                <span>{g.title}</span>
                <span className="text-[10.5px] text-faint">{g.tag}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
