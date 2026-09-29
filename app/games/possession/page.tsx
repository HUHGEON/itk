import type { Metadata } from "next";
import { GamePage } from "@/components/games/GamePage";
import { PossessionGame } from "@/components/games/PossessionGame";

/*
 * Rendered per request, like the rest of the site: the shell reads the URL's
 * search params, which a static prerender cannot. The game itself loads its
 * data from /public/games in the browser, so this costs one light render.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Possession Play · ITK+ 미니게임",
  description: "칸을 골라 선수를 대고 맞닿은 칸까지 빼앗는 1대1 축구 땅따먹기.",
};

export default function Page() {
  return (
    <GamePage title="Possession Play" en="1대1 축구 땅따먹기" width={720}>
      <PossessionGame />
    </GamePage>
  );
}
