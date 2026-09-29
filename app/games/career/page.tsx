import type { Metadata } from "next";
import { GamePage } from "@/components/games/GamePage";
import { CareerGame } from "@/components/games/CareerGame";

/*
 * Rendered per request, like the rest of the site: the shell reads the URL's
 * search params, which a static prerender cannot. The game itself loads its
 * data from /public/games in the browser, so this costs one light render.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "커리어 추적 · ITK+ 미니게임",
  description: "한 줄씩 공개되는 이적 경로만 보고 오늘의 선수를 맞혀 보세요.",
};

export default function Page() {
  return (
    <GamePage title="커리어 추적" en="Career Path">
      <CareerGame />
    </GamePage>
  );
}
