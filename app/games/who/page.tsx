import type { Metadata } from "next";
import { pageMeta } from "@/lib/meta";
import { GamePage } from "@/components/games/GamePage";
import { WhoGame } from "@/components/games/WhoGame";

/*
 * Rendered per request, like the rest of the site: the shell reads the URL's
 * search params, which a static prerender cannot. The game itself loads its
 * data from /public/games in the browser, so this costs one light render.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = pageMeta(
  "Who Are Ya? · ITK+ 미니게임",
  "국적·리그·팀·포지션·나이·등번호 힌트로 오늘의 선수를 8번 안에 맞혀 보세요.",
  "/games/who/opengraph-image",
);

export default function Page() {
  return (
    <GamePage title="Who Are Ya?" en="힌트로 오늘의 선수 맞히기" width={460}>
      <WhoGame />
    </GamePage>
  );
}
