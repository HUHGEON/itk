import type { Metadata } from "next";
import { GamePage } from "@/components/games/GamePage";
import { WhoGame } from "@/components/games/WhoGame";

/*
 * Rendered per request, like the rest of the site: the shell reads the URL's
 * search params, which a static prerender cannot. The game itself loads its
 * data from /public/games in the browser, so this costs one light render.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "후 아 유? · ITK+ 미니게임",
  description: "국적·리그·팀·포지션·나이·등번호 힌트로 오늘의 선수를 8번 안에 맞혀 보세요.",
};

export default function Page() {
  return (
    <GamePage title="후 아 유?" en="Who Are Ya?">
      <WhoGame />
    </GamePage>
  );
}
