import type { Metadata } from "next";
import Link from "next/link";
import { GamePage } from "@/components/games/GamePage";
import { GAMES } from "@/lib/games/catalog";

/*
 * Rendered per request, like the rest of the site: the shell reads the URL's
 * search params, which a static prerender cannot. The game itself loads its
 * data from /public/games in the browser, so this costs one light render.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "미니게임 · ITK+",
  description: "축구 지식으로 푸는 한글 미니게임 네 가지 — 점유율 전쟁, 히트맵, 커리어 추적, 후 아 유?",
};

/**
 * The games hub.
 *
 * Four games, each with the one sentence that says what it is. The daily ones
 * say so, because "come back tomorrow" is half of what they are.
 */
export default function GamesHub() {
  return (
    <GamePage title="미니게임" en="ITK+ Football Games">
      <ul className="mx-auto grid max-w-[520px] gap-2.5">
        {GAMES.map((g) => (
          <li key={g.slug}>
            <Link
              href={`/games/${g.slug}`}
              data-press
              className="group block rounded-[10px] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[16px] font-semibold text-text">{g.title}</span>
                <span
                  className={`shrink-0 rounded-[4px] px-1.5 py-0.5 text-[10.5px] font-semibold ${
                    g.tag === "2인" ? "bg-[var(--p1)]/20 text-[var(--p1)]" : "bg-accent/15 text-accent"
                  }`}
                >
                  {g.tag}
                </span>
              </div>
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{g.blurb}</p>
              <p className="mt-1.5 text-[11px] text-faint">{g.en}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mx-auto mt-6 max-w-[520px] text-[11.5px] leading-relaxed text-faint">
        선수·구단·경력 데이터는 위키데이터(CC0)에서, 현재 스쿼드와 엠블럼은 FotMob에서 가져옵니다.
        선수 이름은 나무위키 표제어를 따릅니다. 데일리 게임은 한국 시간 자정에 바뀝니다.
      </p>
    </GamePage>
  );
}
