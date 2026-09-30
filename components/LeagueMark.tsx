import { GlobeHemisphereWest, SquaresFour } from "@phosphor-icons/react/dist/ssr";
import type { League } from "@/lib/types";

/*
 * Each league by its own mark, from FotMob's image host (free, no key; ids
 * checked by eye: 47 Premier League, 87 LaLiga, 54 Bundesliga, 55 Serie A,
 * 53 Ligue 1, 57 Eredivisie). The dark variants are drawn for a dark page -
 * Ligue 1's is white-on-nothing. A tab someone has to read to find is a tab
 * they miss; a logo is found at a glance.
 */
export const LEAGUE_LOGO: Partial<Record<League, number>> = {
  EPL: 47,
  LaLiga: 87,
  Bundesliga: 54,
  SerieA: 55,
  Ligue1: 53,
  Eredivisie: 57,
};

export function LeagueMark({ league, on = false, size = 18 }: { league: League | null; on?: boolean; size?: number }) {
  const id = league ? LEAGUE_LOGO[league] : undefined;
  if (id)
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        // The chosen tab is filled white, where the dark variant (a white
        // lion, a white Ligue 1) vanishes - measured on screen - so it takes
        // the light-page mark instead.
        src={`https://images.fotmob.com/image_resources/logo/leaguelogo/${on ? "" : "dark/"}${id}.png`}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 object-contain"
      />
    );
  const Icon = league ? GlobeHemisphereWest : SquaresFour;
  return <Icon size={size} className="shrink-0" weight="fill" />;
}

