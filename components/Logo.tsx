/**
 * The mark, drawn rather than shipped.
 *
 * The artwork arrived as a 322KB raster with a transparency checkerboard baked
 * into it. At header size that would be a blurry downscale, it could not follow
 * the theme, and it cost more bytes than the article payload. This redraws it —
 * ball, ribbon, wordmark — so it stays sharp at any size, weighs a few hundred
 * bytes, and takes its colours from the same tokens as everything else.
 */

export function LogoMark({
  size = 30,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="itkBall" x1="16" y1="16" x2="44" y2="52">
          <stop offset="0" stopColor="#3C5170" />
          <stop offset="1" stopColor="#0D1725" />
        </linearGradient>
        <linearGradient id="itkRibbon" x1="8" y1="52" x2="58" y2="8">
          <stop offset="0" stopColor="#C42A00" />
          <stop offset="0.5" stopColor="#F06000" />
          <stop offset="1" stopColor="#FF9E3D" />
        </linearGradient>
      </defs>

      <circle cx="29" cy="35" r="19" fill="url(#itkBall)" />

      {/* Panels: the centre pentagon and its neighbours, pared back to what
          still reads at 20px. */}
      <path d="M29 23l7.6 5.5-2.9 8.9h-9.4l-2.9-8.9z" fill="#EEF2F8" />
      <path
        d="M29 17.2l4.9 3.6-1.1 3.4-3.8-2.7-3.8 2.7-1.1-3.4z"
        fill="#EEF2F8"
        opacity="0.45"
      />
      <path
        d="M14 32.6l4.5 3.3-1.8 5.4-4.2.1a19 19 0 0 1 1.5-8.8z"
        fill="#EEF2F8"
        opacity="0.34"
      />
      <path
        d="M44 32.6a19 19 0 0 1 1.4 8.7l-4.1-.1-1.8-5.3z"
        fill="#EEF2F8"
        opacity="0.34"
      />
      <path
        d="M24.3 44.2h9.4l2.8 8.2a19 19 0 0 1-15 0z"
        fill="#EEF2F8"
        opacity="0.38"
      />

      {/* One ribbon: under the ball, up its right side, then out. The arrow is
          the point of the mark — news moving, not a ball sitting still. */}
      <path
        d="M10.8 47.3A24 24 0 1 0 49.8 21.6"
        stroke="url(#itkRibbon)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M58.5 11.5 47.2 16.4l8.4 7.8z" fill="url(#itkRibbon)" />
    </svg>
  );
}

/**
 * Mark plus wordmark. The lettering is live text rather than paths so it takes
 * the page font and stays selectable; the slant is a transform because the
 * Korean cut of Plex ships no true italic.
 */
export function Logo({
  size = 30,
  withTagline = false,
}: {
  size?: number;
  withTagline?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <LogoMark size={size} />
      <span className="flex flex-col leading-none">
        <span
          className="font-semibold tracking-[-0.03em]"
          style={{
            fontSize: size * 0.74,
            transform: "skewX(-10deg)",
            transformOrigin: "left",
          }}
        >
          <span className="text-text">itk</span>
          <span className="text-accent">plus</span>
        </span>
        {withTagline && (
          <span className="mt-[4px] text-[7.5px] font-medium tracking-[0.19em] text-faint">
            FOOTBALL INSIDER NEWS
          </span>
        )}
      </span>
    </span>
  );
}
