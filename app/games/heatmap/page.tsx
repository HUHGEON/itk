import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { GamePage } from "@/components/games/GamePage";
import { HeatmapGame } from "@/components/games/HeatmapGame";

/*
 * Rendered per request, like the rest of the site: the shell reads the URL's
 * search params, which a static prerender cannot. The game itself loads its
 * data from /public/games in the browser, so this costs one light render.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta(
  "The Heatmap · ITK+ 미니게임",
  "하루 한 판, 한 번에 여러 칸을 채울수록 점수가 불어나는 축구 육각 퍼즐.",
  "/games/heatmap/opengraph-image",
);

export default function Page() {
  return (
    <GamePage title="The Heatmap" en="하루 한 판 육각 퍼즐" width={405}>
      <HeatmapGame />
    </GamePage>
  );
}
