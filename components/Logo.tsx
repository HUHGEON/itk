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
 *
 * The artwork has been shortened 15% twice over. Each pass squashes the
 * wordmark on the vertical only — its width is what keeps "itk plus" readable
 * in a 200px rail — while the mark is scaled evenly, because a ball squashed
 * the same way reads as a rugby ball.
 */

/** Intrinsic size of public/itk-plus.png. */
const W = 576;
const H = 200;

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

/**
 * Driven by the width it is given rather than a fixed height.
 *
 * In the rail the mark is the only thing in its band, and a 30px lockup left
 * two thirds of that band empty. Here it takes the column.
 */
export function LogoFluid() {
  return (
    <Image
      src="/itk-plus.png"
      alt="itk plus"
      width={W}
      height={H}
      priority
      className="block h-auto w-full select-none"
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
