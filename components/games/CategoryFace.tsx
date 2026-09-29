import {
  Cake,
  Flag,
  GlobeHemisphereWest,
  HandPalm,
  Trophy,
} from "@phosphor-icons/react/dist/ssr";
import { imageUrl, type Category } from "@/lib/games/data";

/**
 * What a hex shows: a crest or flag where one exists, an icon where it does
 * not, and the category's short Korean name under it.
 */
export function CategoryFace({ cat, dim = false }: { cat: Category; dim?: boolean }) {
  const src = imageUrl(cat.img);
  const Icon =
    cat.kind === "award"
      ? Trophy
      : cat.kind === "region"
        ? GlobeHemisphereWest
        : cat.kind === "decade"
          ? Cake
          : cat.kind === "position"
            ? HandPalm
            : Flag;
  return (
    <span
      className={`pointer-events-none flex h-full w-full flex-col items-center justify-center gap-[0.6cqw] px-[1.2cqw] text-center ${
        dim ? "opacity-70" : ""
      }`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          className="size-[7.2cqw] object-contain drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]"
        />
      ) : (
        <Icon className="size-[6cqw]" weight="duotone" />
      )}
      <span className="line-clamp-2 text-[2.35cqw] leading-[1.1] font-semibold tracking-tight break-keep">
        {cat.short}
      </span>
    </span>
  );
}
