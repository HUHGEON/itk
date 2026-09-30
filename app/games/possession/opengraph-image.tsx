import { GAMES } from "@/lib/games/catalog";
import { gameImage, OG_SIZE } from "@/lib/og";

export const alt = `${GAMES.find((g) => g.slug === "possession")!.title} · ITK+ 미니게임`;
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return gameImage("possession");
}
