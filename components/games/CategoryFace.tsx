import {
  Cake,
  Flag,
  GlobeHemisphereWest,
  HandPalm,
  SoccerBall,
  Trophy,
} from "@phosphor-icons/react/dist/ssr";
import { imageUrl, type Category } from "@/lib/games/data";

/**
 * How long a label reads, for the original's four text sizes (≤8, ≤13, ≤18
 * characters and longer). A Hangul syllable is about as wide as two capitals
 * in a black weight, so it counts nearly double; "레알 마드리드" lands where
 * "REAL MADRID" does.
 */
function width(s: string): number {
  let n = 0;
  for (const ch of s.trim()) n += /[가-힣]/.test(ch) ? 1.8 : 1;
  return n;
}

function size(s: string): string {
  const n = width(s);
  return n <= 8
    ? "text-[10px] sm:text-[11px]"
    : n <= 13
      ? "text-[9px] sm:text-[10px]"
      : n <= 18
        ? "text-[8px] sm:text-[9px]"
        : "text-[7px] sm:text-[8px]";
}

/**
 * What a hex shows, laid out as the original lays it out: the crest at most
 * 30px tall, the name in black capitals under it, and on a longer name the
 * crest's foot fades into the fill so the name can tuck up under it.
 */
export function CategoryFace({ cat, ink, fill }: { cat: Category; ink: string; fill: string }) {
  const src = imageUrl(cat.img);
  const long = cat.short.replace(/\s+/g, "").length > 3;
  const Icon =
    cat.kind === "trophy"
      ? Trophy
      : cat.kind === "region"
        ? GlobeHemisphereWest
        : cat.id === "ps-gk"
          ? HandPalm
          : cat.id.startsWith("dc-")
            ? Cake
            : cat.kind === "group"
              ? SoccerBall
              : Flag;
  return (
    <div className="pointer-events-none absolute inset-[12%] flex flex-col items-center justify-center gap-1.5 text-center">
      <div className="relative min-h-0 w-full flex-[0_1_30px]">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            loading="lazy"
            className="absolute top-1/2 left-1/2 h-auto max-h-full w-auto max-w-full -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_0_4px_rgba(0,0,0,0.25)]"
          />
        ) : (
          <Icon
            className="absolute top-1/2 left-1/2 h-full max-h-[26px] w-auto -translate-x-1/2 -translate-y-1/2"
            style={{ color: ink }}
            weight="duotone"
          />
        )}
        {long && (
          <div
            className="absolute inset-x-0 bottom-0 h-4"
            style={{ background: `linear-gradient(to bottom, rgba(0,0,0,0) 0%, ${fill} 100%)` }}
          />
        )}
      </div>
      <div className={`relative w-full shrink-0 ${long ? "-mt-2.5" : ""}`} style={{ color: ink }}>
        <span className={`block w-full leading-none font-black break-keep uppercase ${size(cat.short)}`}>
          {cat.short}
        </span>
      </div>
    </div>
  );
}
