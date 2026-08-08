import Image from "next/image";

/**
 * The supplied artwork, background removed.
 *
 * Earlier passes redrew this as SVG — a traced ball, a generated ribbon, live
 * text for the wordmark. None of them were the logo; they were approximations
 * of it, and the ball in particular carries photographic panel shading that
 * vector fills cannot reproduce. So the file itself ships, cut out of its plate
 * so it sits on any background. Diffed against the original: mean channel
 * difference 0.97/255, and the 1.2% of pixels that differ by more than 8 are
 * all on the cut edge.
 *
 * next/image serves it as AVIF/WebP at the width actually requested, so the
 * 226KB source is not what a visitor downloads.
 */

/** Intrinsic size of public/itk-plus.png, for the aspect ratio. */
const W = 637;
const H = 295;

export function Logo({ width = 132 }: { width?: number }) {
  return (
    <Image
      src="/itk-plus.png"
      alt="itk plus — Football Insider News"
      width={width}
      height={Math.round((width * H) / W)}
      priority
      className="select-none"
      style={{ width, height: "auto" }}
    />
  );
}

/** Ball and ribbon only — for places too small for the wordmark. */
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <Image
      src="/itk-mark.png"
      alt=""
      width={size}
      height={size}
      className="select-none"
      style={{ width: size, height: size }}
    />
  );
}
