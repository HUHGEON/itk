import Image from "next/image";

/**
 * The supplied artwork, background removed and the strapline cropped.
 *
 * Earlier passes redrew this as SVG — a traced ball, a generated ribbon, live
 * text for the wordmark. None of them were the logo; they were approximations
 * of it, and the ball carries photographic panel shading that vector fills
 * cannot reproduce. So the file itself ships, cut out of its plate so it sits
 * on any background. Diffed against the original: mean channel difference
 * 0.97/255, and the pixels that differ are all on the cut edge.
 *
 * "FOOTBALL INSIDER NEWS" is cropped off because at header size it renders
 * about two pixels tall — illegible, and it was most of what made the lockup
 * so deep.
 *
 * Sized by height, not width: the header's rhythm is vertical, and the wordmark
 * stacks "plus" under "itk" so the width follows from however tall it may be.
 */

/** Intrinsic size of public/itk-plus.png. */
const W = 637;
const H = 276;

export function Logo({ height = 38 }: { height?: number }) {
  const width = Math.round((height * W) / H);
  return (
    <Image
      src="/itk-plus.png"
      alt="itk plus"
      width={width}
      height={height}
      priority
      className="select-none"
      style={{ height, width: "auto" }}
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
