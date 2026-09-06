"use client";

import { useFavourites } from "@/lib/favourites";

/**
 * Follow or unfollow a club.
 *
 * Sits at the end of a club's row in the rail rather than replacing the row, so
 * tapping the name still goes to the club and only the star changes what is
 * followed. Hidden until the row is hovered on a pointer device, always visible
 * once a club is followed - a rail of seventeen filled stars would be louder
 * than the list it decorates.
 */
export function FavouriteStar({ slug, name }: { slug: string; name: string }) {
  const { teams, ready, toggle } = useFavourites();
  const on = teams.includes(slug);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(slug);
      }}
      aria-pressed={on}
      aria-label={on ? `${name} 즐겨찾기 해제` : `${name} 즐겨찾기`}
      title={on ? "즐겨찾기 해제" : "즐겨찾기"}
      className={`ml-auto shrink-0 rounded-[4px] px-1 text-[12px] leading-none transition-opacity ${
        on
          ? "text-accent opacity-100"
          : "text-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      } ${ready ? "" : "invisible"}`}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
