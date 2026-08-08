/**
 * The mark, drawn rather than shipped.
 *
 * The artwork arrived as a 322KB raster with a transparency checkerboard baked
 * into it. At header size that would be a blurry downscale, it could not follow
 * the theme, and it cost more bytes than the article payload. This redraws it so
 * it stays sharp at any size and weighs a few hundred bytes.
 *
 * A first pass got the structure wrong — a dark ball, and the wordmark set on
 * one line. The ball is light with dark panels, and "plus" sits under "itk".
 */

export function LogoMark({
  size = 34,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      aria-hidden
      className={className}
    >
      <defs>
        <radialGradient id="itkGlow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0.55" stopColor="#F06000" stopOpacity="0.5" />
          <stop offset="1" stopColor="#F06000" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="itkSphere" cx="0.36" cy="0.3" r="0.78">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor="#DCE3EC" />
          <stop offset="1" stopColor="#8A97A8" />
        </radialGradient>
        <linearGradient id="itkRibbon" x1="10" y1="86" x2="92" y2="10">
          <stop offset="0" stopColor="#C42A00" />
          <stop offset="0.45" stopColor="#F06000" />
          <stop offset="1" stopColor="#FFB055" />
        </linearGradient>
      </defs>

      {/* The original sits in a warm halo; without it the ball floats. */}
      <circle cx="44" cy="52" r="42" fill="url(#itkGlow)" />

      <circle
        cx="44"
        cy="52"
        r="30"
        fill="url(#itkSphere)"
        stroke="#0D1725"
        strokeWidth="2"
      />
      <g fill="#16233A">
        <path d="M44 36l10.5 7.6-4 12.3H37.5l-4-12.3z" />
        <path d="M44 24.5l7.8 5.7-2.2 6.6-5.6-4-5.6 4-2.2-6.6z" opacity="0.9" />
        <path
          d="M17.6 46.6l7.6 5.5-2.9 8.9-7.4-.1a30 30 0 0 1 2.7-14.3z"
          opacity="0.9"
        />
        <path
          d="M70.4 46.6a30 30 0 0 1 2.6 14.2l-7.3.1-2.9-8.8z"
          opacity="0.9"
        />
        <path d="M36.5 68.9h15l4.3 12.6a30 30 0 0 1-23.6 0z" opacity="0.9" />
      </g>

      {/* One ribbon, one arrowhead, joined. Drawn as two shapes at first, which
          read as two pieces the moment the mark was scaled up. */}
      <path
        d="M23.1 78.8A34 34 0 1 0 70.8 31.1"
        stroke="url(#itkRibbon)"
        strokeWidth="12"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M82.8 19 62.3 22.6l17 17z" fill="url(#itkRibbon)" />
    </svg>
  );
}

/**
 * Mark plus wordmark, stacked the way the original is: "itk" over "plus" over
 * the strapline. The lettering is live text rather than paths so it takes the
 * page font and stays selectable; the slant is a transform because the Korean
 * cut of Plex ships no true italic.
 */
export function Logo({
  size = 34,
  withTagline = true,
}: {
  size?: number;
  withTagline?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className="flex flex-col leading-[0.92]">
        <span
          className="font-semibold tracking-[-0.04em] text-text"
          style={{
            fontSize: size * 0.47,
            transform: "skewX(-12deg)",
            transformOrigin: "left",
          }}
        >
          itk
        </span>
        <span
          className="mt-[1px] font-semibold tracking-[-0.03em] text-accent"
          style={{
            fontSize: size * 0.4,
            transform: "skewX(-12deg)",
            transformOrigin: "left",
          }}
        >
          plus
        </span>
        {withTagline && (
          <span
            className="mt-[3px] font-medium tracking-[0.16em] text-muted"
            style={{ fontSize: Math.max(6.5, size * 0.1) }}
          >
            FOOTBALL INSIDER NEWS
          </span>
        )}
      </span>
    </span>
  );
}
