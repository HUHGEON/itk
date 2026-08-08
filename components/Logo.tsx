/**
 * The mark, as supplied — SVG for the ball and ribbon, live text for the
 * wordmark.
 *
 * Two changes from the source it came from. Every measurement is in `em` off a
 * single container font-size, so the header can run it at a third of its
 * natural size without a transform and without the layout box lying about how
 * much room it takes. And the two display faces load through next/font instead
 * of an `@import` from fonts.googleapis.com, which was a render-blocking
 * request to a third party for eight glyphs.
 */

export function LogoMark({
  size = 120,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      aria-hidden
      className={className}
    >
      <defs>
        <linearGradient id="itkOrange" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#FF3E00" />
          <stop offset="50%" stopColor="#FF6B00" />
          <stop offset="100%" stopColor="#FFAE00" />
        </linearGradient>

        {/* Declared here rather than mid-document: a forward reference works in
            browsers but not in every SVG rasteriser. */}
        <radialGradient id="itkBall" cx="30%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="60%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#475569" />
        </radialGradient>

        <filter id="itkShadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow
            dx="2"
            dy="4"
            stdDeviation="3"
            floodColor="#000"
            floodOpacity="0.4"
          />
        </filter>
      </defs>

      <circle cx="90" cy="110" r="65" fill="#1E2838" filter="url(#itkShadow)" />
      <circle cx="90" cy="110" r="62" fill="url(#itkBall)" />

      <polygon points="90,75 72,88 78,108 102,108 108,88" fill="#1E293B" />
      <polygon points="90,75 72,88 55,78 62,60 80,60" fill="#334155" />
      <polygon points="108,88 102,108 120,118 130,100 122,82" fill="#334155" />
      <polygon points="78,108 60,120 68,138 88,138 98,122" fill="#334155" />

      <path
        d="M 35 125 C 30 160, 80 175, 125 150 C 160 130, 165 70, 155 40"
        fill="none"
        stroke="url(#itkOrange)"
        strokeWidth="22"
        strokeLinecap="round"
        filter="url(#itkShadow)"
      />
      <path
        d="M 135 45 L 165 25 L 165 65 Z"
        fill="#FF5500"
        filter="url(#itkShadow)"
      />
    </svg>
  );
}

/**
 * `size` is the cap size of "itk"; everything else is proportional to it.
 */
export function Logo({
  size = 82,
  withTagline = true,
}: {
  size?: number;
  withTagline?: boolean;
}) {
  return (
    <span
      className="flex select-none items-center"
      style={{ fontSize: size, gap: "0.183em" }}
    >
      <LogoMark size={size * 1.463} className="shrink-0" />

      <span
        className="flex flex-col italic"
        style={{
          fontFamily: "var(--font-wordmark)",
          fontWeight: 900,
          lineHeight: 0.85,
        }}
      >
        <span
          style={{
            fontSize: "1em",
            letterSpacing: "-0.037em",
            background:
              "linear-gradient(180deg, #FFFFFF 0%, #E2E8F0 60%, #94A3B8 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0.024em 0.049em 0.061em rgba(0,0,0,0.5))",
          }}
        >
          itk
        </span>

        <span className="flex items-center" style={{ marginTop: "-0.122em" }}>
          <span
            style={{
              fontSize: "0.61em",
              marginRight: "0.024em",
              color: "#FF5500",
              WebkitTextStroke: "0.012em #CC4400",
              filter: "drop-shadow(0.033em 0.049em 0.049em rgba(0,0,0,0.4))",
            }}
          >
            +
          </span>
          <span
            style={{
              fontSize: "0.829em",
              letterSpacing: "-0.024em",
              background:
                "linear-gradient(180deg, #FF6B00 0%, #FF3E00 50%, #D93000 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0.024em 0.049em 0.049em rgba(0,0,0,0.4))",
            }}
          >
            plus
          </span>
        </span>

        {withTagline && (
          <span
            className="not-italic"
            style={{
              fontFamily: "var(--font-strapline)",
              fontWeight: 700,
              fontSize: "0.171em",
              letterSpacing: "0.143em",
              marginTop: "0.061em",
              color: "#FFFFFF",
              textShadow:
                "0.071em 0.143em 0.214em rgba(0,0,0,0.8), 0 0 0.143em rgba(0,0,0,0.5)",
            }}
          >
            FOOTBALL INSIDER NEWS
          </span>
        )}
      </span>
    </span>
  );
}
