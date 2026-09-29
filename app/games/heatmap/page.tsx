import type { Metadata } from "next";
import { GamePage } from "@/components/games/GamePage";
import { HeatmapGame } from "@/components/games/HeatmapGame";

/*
 * Rendered per request, like the rest of the site: the shell reads the URL's
 * search params, which a static prerender cannot. The game itself loads its
 * data from /public/games in the browser, so this costs one light render.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "히트맵 · ITK+ 미니게임",
  description: "하루 한 판, 한 번에 여러 칸을 채울수록 점수가 불어나는 축구 육각 퍼즐.",
};

export default function Page() {
  return (
    <GamePage title="히트맵" en="The Heatmap">
      <HeatmapGame />
    </GamePage>
  );
}
