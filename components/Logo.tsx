/**
 * The mark.
 *
 * The ribbon is a filled band rather than a stroked arc so it can taper — thin
 * where it leaves frame, thick at the shoulder — which is what makes a swoosh
 * look drawn instead of extruded. It is painted twice: once behind the ball and
 * once, for the stretch that crosses the lower left, in front. That single
 * overlap is what makes it read as wrapping rather than orbiting.
 *
 * The ball gets a specular highlight, a terminator shade and a rim line. Panels
 * are clipped to the sphere and shrink as they turn away from the light.
 *
 * Geometry generated rather than hand-typed; the arc points are sampled at 64
 * steps so the taper stays smooth at any size.
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
        <radialGradient id="itkSphere" cx="32%" cy="26%" r="76%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.42" stopColor="#EDF1F6" />
          <stop offset="0.78" stopColor="#B7C2D0" />
          <stop offset="1" stopColor="#5B6878" />
        </radialGradient>
        <radialGradient id="itkSpec" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="itkTerm" cx="34%" cy="28%" r="78%">
          <stop offset="0.6" stopColor="#0B1220" stopOpacity="0" />
          <stop offset="1" stopColor="#0B1220" stopOpacity="0.5" />
        </radialGradient>
        <linearGradient id="itkRib" x1="6%" y1="96%" x2="96%" y2="4%">
          <stop offset="0" stopColor="#B32400" />
          <stop offset="0.42" stopColor="#FF6B00" />
          <stop offset="1" stopColor="#FFC155" />
        </linearGradient>
        <radialGradient id="itkHalo" cx="50%" cy="50%" r="50%">
          <stop offset="0.48" stopColor="#FF6B00" stopOpacity="0.34" />
          <stop offset="1" stopColor="#FF6B00" stopOpacity="0" />
        </radialGradient>
        <clipPath id="itkBallClip">
          <circle cx="78" cy="104" r="52" />
        </clipPath>
      </defs>

      <circle cx="78" cy="104" r="78" fill="url(#itkHalo)" />

      <path
        d="M 11.7 142.2 14.1 146.0 16.6 149.6 19.3 153.1 22.2 156.5 25.3 159.6 28.6 162.6 32.0 165.4 35.6 168.0 39.4 170.4 43.2 172.6 47.2 174.6 51.3 176.3 55.5 177.8 59.8 179.1 64.2 180.1 68.6 180.9 73.0 181.4 77.5 181.7 82.0 181.7 86.5 181.4 91.0 180.9 95.4 180.2 99.8 179.2 104.2 177.9 108.4 176.4 112.6 174.6 116.7 172.6 120.7 170.4 124.6 167.9 128.3 165.2 131.8 162.3 135.2 159.2 138.4 155.9 141.4 152.4 144.2 148.8 146.8 144.9 149.2 141.0 151.3 136.8 153.2 132.6 154.9 128.2 156.3 123.8 157.4 119.3 158.3 114.7 158.9 110.0 159.2 105.3 159.3 100.6 159.1 95.9 158.6 91.2 157.8 86.6 156.7 82.0 155.4 77.4 153.8 73.0 152.0 68.6 149.9 64.4 147.5 60.2 145.0 56.2 142.1 52.4 139.1 48.8 135.8 45.3 132.4 42.0 128.7 39.0 124.9 36.1 120.9 33.5 116.7 31.2 L 105.9 51.5 108.9 53.2 111.8 55.0 114.6 57.0 117.3 59.2 119.8 61.5 122.2 64.0 124.5 66.6 126.6 69.3 128.6 72.1 130.4 75.1 132.1 78.1 133.6 81.3 134.9 84.5 136.0 87.8 136.9 91.1 137.7 94.5 138.2 98.0 138.6 101.5 138.8 105.0 138.7 108.5 138.5 112.0 138.0 115.5 137.4 119.0 136.6 122.5 135.5 125.9 134.3 129.2 132.9 132.5 131.2 135.7 129.4 138.8 127.4 141.8 125.3 144.7 123.0 147.4 120.5 150.0 117.8 152.5 115.0 154.9 112.1 157.0 109.1 159.0 105.9 160.9 102.6 162.5 99.2 164.0 95.8 165.2 92.2 166.3 88.6 167.1 85.0 167.7 81.3 168.1 77.6 168.3 73.9 168.3 70.1 168.1 66.4 167.6 62.7 166.9 59.1 166.0 55.5 164.9 52.0 163.6 48.6 162.1 45.2 160.3 42.0 158.4 38.9 156.3 35.9 154.0 33.0 151.5 30.3 148.8 27.8 146.0 25.4 143.1 23.3 140.0 21.3 136.8 Z"
        fill="url(#itkRib)"
      />
      <path
        d="M 84.8 27.2 L 127.5 17.3 L 117.5 44.6 L 102.6 64.0 Z"
        fill="url(#itkRib)"
      />

      <circle cx="78" cy="104" r="52" fill="url(#itkSphere)" />
      <g clipPath="url(#itkBallClip)" fill="#16233A">
        <path d="M 71.0 74.0 L 89.1 87.1 L 82.2 108.4 L 59.8 108.4 L 52.9 87.1 Z" />
        <path d="M 105.7 68.3 L 89.4 72.5 L 79.4 61.4 L 89.4 50.4 L 105.7 54.6 Z" />
        <path d="M 104.2 114.7 L 95.4 105.1 L 104.2 95.4 L 118.3 99.1 L 118.3 111.0 Z" />
        <path d="M 57.7 132.0 L 66.9 121.9 L 81.7 125.8 L 81.7 138.2 L 66.9 142.1 Z" />
        <path d="M 29.4 94.0 L 45.6 98.2 L 45.6 111.9 L 29.4 116.1 L 19.4 105.0 Z" />
        <path d="M 59.8 54.6 L 59.8 68.3 L 43.6 72.5 L 33.6 61.4 L 43.6 50.4 Z" />
      </g>
      <ellipse
        cx="59"
        cy="82"
        rx="25"
        ry="17"
        fill="url(#itkSpec)"
        transform="rotate(-24 59 82)"
      />
      <circle cx="78" cy="104" r="52" fill="url(#itkTerm)" />
      <circle
        cx="78"
        cy="104"
        r="52"
        fill="none"
        stroke="#0B1220"
        strokeOpacity="0.5"
        strokeWidth="2"
      />

      <path
        d="M 30.8 164.4 32.3 165.6 33.9 166.8 35.5 167.9 37.2 169.0 38.8 170.1 40.5 171.1 42.2 172.1 44.0 173.0 45.7 173.9 47.5 174.7 49.3 175.5 51.2 176.2 53.0 176.9 54.9 177.6 56.8 178.2 58.7 178.8 60.6 179.3 62.5 179.7 64.4 180.1 66.4 180.5 68.4 180.8 70.3 181.1 72.3 181.3 74.3 181.5 76.3 181.6 78.3 181.7 80.2 181.7 82.2 181.7 84.2 181.6 86.2 181.4 88.2 181.3 90.2 181.0 92.2 180.7 94.2 180.4 96.1 180.0 98.1 179.6 100.0 179.1 102.0 178.6 103.9 178.0 105.8 177.4 107.7 176.7 109.6 175.9 111.4 175.2 113.3 174.3 115.1 173.5 116.9 172.5 118.7 171.6 120.4 170.6 122.1 169.5 123.8 168.4 125.5 167.3 127.2 166.1 128.8 164.8 130.4 163.6 131.9 162.2 133.4 160.9 134.9 159.5 136.4 158.1 137.8 156.6 139.1 155.1 140.5 153.5 141.8 152.0 143.0 150.3 144.3 148.7 L 129.5 138.7 128.6 140.1 127.7 141.4 126.8 142.7 125.8 144.0 124.8 145.2 123.8 146.4 122.8 147.6 121.7 148.8 120.5 150.0 119.4 151.1 118.2 152.2 117.0 153.3 115.8 154.3 114.5 155.3 113.2 156.3 111.9 157.2 110.5 158.1 109.2 159.0 107.8 159.8 106.4 160.6 104.9 161.4 103.5 162.1 102.0 162.8 100.5 163.4 99.0 164.0 97.5 164.6 95.9 165.2 94.4 165.6 92.8 166.1 91.2 166.5 89.6 166.9 88.0 167.2 86.4 167.5 84.8 167.8 83.1 168.0 81.5 168.1 79.9 168.2 78.2 168.3 76.6 168.4 74.9 168.3 73.3 168.3 71.6 168.2 70.0 168.1 68.3 167.9 66.7 167.7 65.0 167.4 63.4 167.1 61.8 166.7 60.2 166.3 58.6 165.9 57.0 165.4 55.4 164.9 53.8 164.3 52.3 163.7 50.7 163.1 49.2 162.4 47.7 161.7 46.2 160.9 44.8 160.1 43.3 159.2 41.9 158.3 40.5 157.4 39.1 156.5 37.8 155.5 Z"
        fill="url(#itkRib)"
      />
    </svg>
  );
}

/** `size` is the cap size of "itk"; the rest is proportional to it. */
export function Logo({ size = 82 }: { size?: number }) {
  return (
    <span
      className="flex select-none items-center"
      style={{ fontSize: size, gap: "0.16em" }}
    >
      <LogoMark size={size * 1.42} className="shrink-0" />

      <span
        className="flex flex-col italic"
        style={{
          fontFamily: "var(--font-wordmark)",
          fontWeight: 900,
          lineHeight: 0.84,
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
            filter: "drop-shadow(0.02em 0.04em 0.05em rgba(0,0,0,0.55))",
          }}
        >
          itk
        </span>

        <span className="flex items-center" style={{ marginTop: "-0.12em" }}>
          <span
            style={{
              fontSize: "0.61em",
              marginRight: "0.02em",
              color: "#FF5500",
              WebkitTextStroke: "0.012em #C44000",
              filter: "drop-shadow(0.03em 0.04em 0.04em rgba(0,0,0,0.45))",
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
              filter: "drop-shadow(0.02em 0.04em 0.04em rgba(0,0,0,0.45))",
            }}
          >
            plus
          </span>
        </span>
      </span>
    </span>
  );
}
