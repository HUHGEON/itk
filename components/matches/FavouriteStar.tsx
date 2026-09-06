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
      /* 24px 아래로는 손가락이 잘 안 닿는다 - 별 자체는 그대로 두고
         닿는 면적만 넓힌다. */
      className={`ml-auto flex size-7 shrink-0 items-center justify-center rounded-[4px] text-[13px] leading-none transition-opacity ${
        on
          ? "text-accent opacity-100"
          : "text-faint opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
      } ${ready ? "" : "invisible"}`}
    >
      {on ? "★" : "☆"}
    </button>
  );
}
