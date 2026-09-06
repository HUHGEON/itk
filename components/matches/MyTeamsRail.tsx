"use client";

import Link from "next/link";
import type { Team } from "@/lib/types";
import { useFavourites } from "@/lib/favourites";
import { TeamCrest } from "@/components/TeamCrest";
import { FavouriteStar } from "./FavouriteStar";

/**
 * The clubs someone follows, at the top of the rail.
 *
 * The full club list is alphabetical and seventeen long, so finding one's own
 * two or three in it is a scan every time. Lifting them out puts them where the
 * eye starts, and keeps the order they were added in - which is the reader's
 * own order and means nothing moves around under them.
 *
 * Nothing is shown before storage has been read, and nothing when no club has
 * been picked: an empty heading is worse than no heading.
 */
export function MyTeamsRail({
  teams,
  active,
}: {
  /** The full registry, so a slug can be turned into a name and a crest. */
  teams: Team[];
  active?: string;
}) {
  const { teams: mine, ready } = useFavourites();
  if (!ready || mine.length === 0) return null;

  const byId = new Map(teams.map((t) => [t.slug, t]));
  const rows = mine
    .map((slug) => byId.get(slug))
    .filter((t): t is Team => Boolean(t));
  if (rows.length === 0) return null;

  return (
    <section className="border-b border-border py-3">
      <h2 className="px-[var(--gutter)] pb-1.5 text-[11px] font-semibold text-faint">
        내 팀
      </h2>
      <nav className="flex flex-col">
        {rows.map((t) => {
          const on = active === t.slug;
          return (
            <div
              key={t.slug}
              className={`group flex items-center px-[var(--gutter)] py-[7px] text-[12.5px] transition-colors ${
                on
                  ? "border-l-2 border-accent bg-accent/[0.07] pl-[calc(var(--gutter)-2px)]"
                  : "hover:bg-surface-2/50"
              }`}
            >
              <Link
                href={`/matches/team/${t.slug}`}
                aria-current={on ? "page" : undefined}
                className={`flex min-w-0 flex-1 items-center gap-2 transition-colors ${
                  on ? "font-medium text-accent" : "text-muted group-hover:text-text"
                }`}
              >
                <TeamCrest team={t} size={16} />
                <span className="truncate">{t.ko}</span>
              </Link>
              <FavouriteStar slug={t.slug} name={t.ko} />
            </div>
          );
        })}
      </nav>
    </section>
  );
}
