import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { GamePage } from "@/components/games/GamePage";
import { CareerGame } from "@/components/games/CareerGame";

/*
 * Rendered per request, like the rest of the site: the shell reads the URL's
 * search params, which a static prerender cannot. The game itself loads its
 * data from /public/games in the browser, so this costs one light render.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta(
  "Career Path · ITK+ 미니게임",
  "한 줄씩 공개되는 이적 경로만 보고 오늘의 선수를 맞혀 보세요.",
  "/games/career/opengraph-image",
);

export default function Page() {
  return (
    <GamePage title="Career Path" en="이적 경로로 선수 맞히기">
      <CareerGame />
    </GamePage>
  );
}
