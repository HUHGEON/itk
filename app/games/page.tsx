import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { GamePage } from "@/components/games/GamePage";
import { GAMES, type GameSlug } from "@/lib/games/catalog";

/*
 * Rendered per request, like the rest of the site: the shell reads the URL's
 * search params, which a static prerender cannot.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "미니게임 · ITK+",
  description: "축구 지식으로 푸는 한글 미니게임 네 가지. 점유율 전쟁, 히트맵, 커리어 추적, 후 아 유?",
};

/*
 * Each game has a colour of its own, taken from the game itself: the blue
 * side of Possession Play, the Heatmap's amber, the infobox steel of Career
 * Path, the green of a Who Are Ya hit. The card's glow, chip dot and button
 * all use it, so four cards read as four different games at a glance.
 */
const TONE: Record<GameSlug, { hue: string; ink: string; glow: string }> = {
  possession: { hue: "#2563EB", ink: "#ffffff", glow: "rgba(37, 99, 235, 0.28)" },
  heatmap: { hue: "#F59E0B", ink: "#1a1004", glow: "rgba(245, 158, 11, 0.24)" },
  career: { hue: "#B0C4DE", ink: "#0f172a", glow: "rgba(176, 196, 222, 0.2)" },
  who: { hue: "#22C55E", ink: "#052e16", glow: "rgba(34, 197, 94, 0.22)" },
};

const HEX = "polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)";

/** A seven-hex flower, the shape both hex games are played on, in miniature. */
function HexFlower({ fills }: { fills: string[] }) {
  // Centre, then the six around it.
  const at = [
    [0, 0],
    [-1, 0],
    [1, 0],
    [-0.5, -0.75],
    [0.5, -0.75],
    [-0.5, 0.75],
    [0.5, 0.75],
  ];
  return (
    <div className="relative size-40 xl:size-44">
      {at.map(([x, y], i) => (
        <span
          key={i}
          className="absolute size-[30%] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.06]"
          style={{
            left: `${35 + x * 30}%`,
            top: `${35 + y * 35}%`,
            clipPath: HEX,
            background: fills[i],
            transitionDelay: `${i * 30}ms`,
          }}
        />
      ))}
    </div>
  );
}

function Art({ slug }: { slug: GameSlug }) {
  if (slug === "possession")
    return <HexFlower fills={["#2563EB", "#2563EB", "#EF4444", "#DCE6F2", "#EF4444", "#2563EB", "#DCE6F2"]} />;
  if (slug === "heatmap")
    return <HexFlower fills={["#EF4444", "#F97316", "#FDE047", "#F59E0B", "#E2E8F0", "#FEF9C3", "#991B1B"]} />;
  if (slug === "career")
    return (
      <div className="w-40 overflow-hidden rounded-[6px] bg-[#f8f9fa] font-mono text-[10px] text-black shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)] transition-transform duration-500 group-hover:-rotate-1">
        <div className="bg-[#b0c4de] py-1.5 text-center text-[10.5px] font-bold">선수 경력</div>
        {[
          ["2009–2013", "토트넘", "178"],
          ["---- ----", "--- ----", "--"],
          ["---- ----", "-----", "--"],
        ].map((r, i) => (
          <div key={i} className={`flex gap-2 px-2 py-1 ${i ? "text-[#8c959f]" : ""}`}>
            <span>{r[0]}</span>
            <span className="flex-1">{r[1]}</span>
            <span>{r[2]}</span>
          </div>
        ))}
      </div>
    );
  return (
    <div className="grid grid-cols-3 gap-2 transition-transform duration-500 group-hover:scale-[1.04]">
      {[
        ["KOR", true],
        ["FW", false],
        ["27↓", false],
        ["#7", true],
        ["MF", true],
        ["?", false],
      ].map(([t, ok], i) => (
        <span
          key={i}
          className={`flex size-11 items-center justify-center rounded-full text-[13px] font-bold text-white shadow-[0_2px_6px_rgba(0,0,0,0.35)] ${
            ok ? "bg-green-500" : "bg-slate-400"
          }`}
        >
          {t}
        </span>
      ))}
    </div>
  );
}

/**
 * The games hub: one tall card per game, with a small picture of the game
 * itself, what kind of game it is, and a way in.
 */
export default function GamesHub() {
  return (
    <GamePage title="미니게임" en="축구 지식으로 푸는 한글 게임" wide>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {GAMES.map((g, i) => {
          const tone = TONE[g.slug];
          return (
            <li key={g.slug} className="games-card-in" style={{ animationDelay: `${i * 70}ms` }}>
              <Link
                href={`/games/${g.slug}`}
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.07] bg-surface transition-[transform,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ outlineColor: tone.hue }}
              >
                {/* The picture: the game's own pieces, lit in its colour. */}
                <div
                  className="relative flex aspect-[16/10] items-center pt-6 xl:aspect-[4/5] justify-center overflow-hidden"
                  style={{
                    background: `radial-gradient(120% 90% at 50% 45%, ${tone.glow}, transparent 70%), linear-gradient(180deg, rgba(255,255,255,0.03), transparent)`,
                  }}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 opacity-[0.35]"
                    style={{
                      backgroundImage:
                        "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
                      backgroundSize: "22px 22px",
                      maskImage: "radial-gradient(80% 70% at 50% 50%, black, transparent)",
                    }}
                  />
                  <span className="absolute top-3.5 left-3.5 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/35 px-2.5 py-1 text-[11px] font-bold text-text backdrop-blur-sm">
                    <span className="size-1.5 rounded-full" style={{ background: tone.hue }} />
                    {g.tag === "2인" ? "2인 대전" : "데일리"}
                  </span>
                  <Art slug={g.slug} />
                </div>

                <div className="flex flex-1 flex-col border-t border-white/[0.06] p-4 pt-3.5">
                  <h2 className="text-[19px] font-bold tracking-tight text-text">{g.title}</h2>
                  <p className="text-[12px] text-faint">{g.en}</p>
                  <p className="mt-2 flex-1 text-[13px] leading-relaxed text-muted">{g.blurb}</p>
                  <span
                    className="mt-4 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[14px] font-bold transition-[filter,transform] duration-200 group-hover:brightness-110 group-active:scale-[0.98]"
                    style={{ background: tone.hue, color: tone.ink }}
                  >
                    {g.tag === "2인" ? "대전하기" : "오늘 문제 풀기"}
                    <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" weight="bold" />
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="mt-8 max-w-[62ch] text-[12px] leading-relaxed text-faint">
        선수·구단·경력 데이터는 위키데이터(CC0)에서, 스쿼드와 엠블럼은 FotMob에서 가져옵니다. 데일리 게임은 한국
        시간 자정에 바뀝니다.
      </p>
    </GamePage>
  );
}
