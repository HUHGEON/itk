import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { GAMES, type GameSlug } from "@/lib/games/catalog";

/**
 * The pictures a link shows when it is shared - in KakaoTalk, Discord, X.
 *
 * Links went out with no picture at all: there was no og:image anywhere and
 * no metadataBase to make one absolute. These are drawn once at build time
 * (next/og), 1200x630, the size every one of those apps crops to.
 *
 * The default font in next/og has no Hangul, so Pretendard - the site's own
 * face - is fetched from jsDelivr (free, no key) for the build.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const FONT = (w: string) => `https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-${w}.otf`;
let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 500 | 800; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all(
    ([["Medium", 500], ["ExtraBold", 800]] as const).map(async ([w, weight]) => ({
      name: "Pretendard",
      data: await (await fetch(FONT(w))).arrayBuffer(),
      weight,
      style: "normal" as const,
    })),
  );
  return fonts;
}

async function logo(): Promise<string> {
  const png = await readFile(join(process.cwd(), "public", "itk-plus.png"));
  return `data:image/png;base64,${png.toString("base64")}`;
}

const BG = "#09090b";
const ACCENT = "#f1800b";

/**
 * The site's card: the wordmark, a line, and the tier ladder as a strip.
 *
 * Everything that matters sits in the middle 630px. A link preview is not
 * always the full card: Slack and KakaoTalk often show a square thumbnail cut
 * from the centre, and a left-aligned card lost its wordmark to that crop.
 */
export async function siteImage(title: string, sub: string) {
  const [f, src] = await Promise.all([loadFonts(), logo()]);
  const tiers = ["#f1800b", "#5fd68a", "#54c8e8", "#9aa4b5", "#7f8794"];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 34,
          backgroundColor: BG,
          // Two properties: satori rejects a gradient and a colour in one
          // background shorthand ("Invalid background image").
          backgroundImage: "radial-gradient(circle at 50% 38%, rgba(241,128,11,0.22), transparent 60%)",
          color: "#f4f4f5",
          fontFamily: "Pretendard",
          textAlign: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={288} height={100} alt="" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 60, fontWeight: 800, letterSpacing: -2, lineHeight: 1.18, whiteSpace: "pre-wrap" }}>{title}</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: "#bcbcc4" }}>{sub}</div>
        </div>
        <div style={{ display: "flex", gap: 8, width: 520 }}>
          {tiers.map((c, i) => (
            <div key={i} style={{ display: "flex", height: 8, flex: [3, 2, 4, 2, 2][i], background: c, borderRadius: 4 }} />
          ))}
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await f },
  );
}

const TONE: Record<GameSlug, string> = {
  possession: "#2563EB",
  heatmap: "#F59E0B",
  career: "#B0C4DE",
  who: "#22C55E",
};

/** A pointy-top hexagon as an SVG path, centred on (cx, cy). */
function hexPath(cx: number, cy: number, r: number) {
  const pts = [0, 1, 2, 3, 4, 5].map((k) => {
    const a = (Math.PI / 3) * k - Math.PI / 2;
    return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`;
  });
  return `M${pts.join("L")}Z`;
}

function HexFlower({ fills }: { fills: string[] }) {
  const r = 52;
  const w = r * Math.sqrt(3);
  const at: [number, number][] = [
    [0, 0], [-w, 0], [w, 0], [-w / 2, -1.5 * r], [w / 2, -1.5 * r], [-w / 2, 1.5 * r], [w / 2, 1.5 * r],
  ];
  return (
    <svg width="330" height="300" viewBox="-165 -150 330 300">
      {at.map(([x, y], i) => (
        <path key={i} d={hexPath(x, y, r - 4)} fill={fills[i]} />
      ))}
    </svg>
  );
}

function Art({ slug }: { slug: GameSlug }) {
  if (slug === "possession")
    return <HexFlower fills={["#2563EB", "#2563EB", "#EF4444", "#DCE6F2", "#EF4444", "#2563EB", "#DCE6F2"]} />;
  if (slug === "heatmap")
    return <HexFlower fills={["#EF4444", "#F97316", "#FDE047", "#F59E0B", "#E2E8F0", "#FEF9C3", "#991B1B"]} />;
  if (slug === "career")
    return (
      <div style={{ display: "flex", flexDirection: "column", width: 400, borderRadius: 14, overflow: "hidden", background: "#f8f9fa", color: "#111", fontSize: 24 }}>
        <div style={{ display: "flex", justifyContent: "center", background: "#b0c4de", padding: "14px 0", fontWeight: 800 }}>선수 경력</div>
        {[["2009–2013", "토트넘", "178"], ["2013–2015", "????", "??"], ["2015–2020", "????", "??"]].map((r, i) => (
          <div key={i} style={{ display: "flex", gap: 18, padding: "12px 20px", color: i ? "#8c959f" : "#111" }}>
            <span>{r[0]}</span>
            <span style={{ flex: 1 }}>{r[1]}</span>
            <span>{r[2]}</span>
          </div>
        ))}
      </div>
    );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", width: 330, gap: 16 }}>
      {([["KOR", 1], ["FW", 0], ["27↓", 0], ["#7", 1], ["MF", 1], ["?", 0]] as const).map(([t, ok], i) => (
        <div
          key={i}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center", width: 96, height: 96, borderRadius: 48,
            background: ok ? "#22C55E" : "#94a3b8", color: "#fff", fontSize: 30, fontWeight: 800,
          }}
        >
          {t}
        </div>
      ))}
    </div>
  );
}

/**
 * A game's card: its picture, its name and what it is, stacked in the middle
 * so a square crop from the centre (Slack, KakaoTalk) still shows all three.
 */
export async function gameImage(slug: GameSlug) {
  const game = GAMES.find((g) => g.slug === slug)!;
  const [f, src] = await Promise.all([loadFonts(), logo()]);
  const tone = TONE[slug];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 26,
          backgroundColor: BG,
          backgroundImage: `radial-gradient(circle at 50% 36%, ${tone}55, transparent 58%)`,
          color: "#f4f4f5",
          fontFamily: "Pretendard",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300 }}>
          <Art slug={slug} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <div style={{ fontSize: 74, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>{game.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 28, fontWeight: 500, color: "#bcbcc4" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} width={86} height={30} alt="" />
            <span style={{ color: ACCENT, fontWeight: 800 }}>·</span>
            {game.en}
          </div>
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: await f },
  );
}
