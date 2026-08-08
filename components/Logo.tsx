/**
 * The mark.
 *
 * The ball is a real truncated icosahedron: the twelve pentagon centres are the
 * vertices of an icosahedron, each panel's corners sit a third of the way along
 * the edges to its neighbours, and the whole thing is projected after a
 * rotation. Six panels face the viewer, which is what you see holding a ball.
 * Scattering flat pentagons across a circle is what it looked like before, and
 * it read as a beach ball.
 *
 * The ribbon is a filled band, not a stroked arc, so it can taper. Its radius
 * ramps up over the last third so it spirals away from the ball instead of
 * orbiting it — that outward exit is what turns a ring into an arrow. It is
 * painted twice, once behind the ball and once for the stretch that crosses the
 * lower left in front; that single overlap is what makes it wrap.
 *
 * Geometry is generated, not hand-typed.
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
        <radialGradient id="itkSphere" cx="33%" cy="27%" r="75%">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.45" stopColor="#F1F4F8" />
          <stop offset="0.8" stopColor="#C2CCD8" />
          <stop offset="1" stopColor="#6B7787" />
        </radialGradient>
        <radialGradient id="itkSpec" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.92" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="itkTerm" cx="35%" cy="29%" r="78%">
          <stop offset="0.58" stopColor="#0B1220" stopOpacity="0" />
          <stop offset="1" stopColor="#0B1220" stopOpacity="0.52" />
        </radialGradient>
        <linearGradient id="itkRib" x1="4%" y1="98%" x2="98%" y2="2%">
          <stop offset="0" stopColor="#A81F00" />
          <stop offset="0.4" stopColor="#FF6B00" />
          <stop offset="0.8" stopColor="#FF9A1F" />
          <stop offset="1" stopColor="#FFCE6A" />
        </linearGradient>
        <radialGradient id="itkGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0.46" stopColor="#FF6B00" stopOpacity="0.32" />
          <stop offset="1" stopColor="#FF6B00" stopOpacity="0" />
        </radialGradient>
        <clipPath id="itkClip">
          <circle cx="78" cy="104" r="52" />
        </clipPath>
      </defs>

      <circle cx="78" cy="104" r="80" fill="url(#itkGlow)" />

      <path
        d="M 9.1 140.6 10.4 143.0 11.8 145.3 13.3 147.6 14.8 149.8 16.4 151.9 18.1 154.1 19.8 156.1 21.6 158.1 23.5 160.1 25.4 162.0 27.4 163.8 29.5 165.5 31.6 167.2 33.7 168.8 36.0 170.4 38.2 171.9 40.6 173.3 42.9 174.6 45.4 175.8 47.8 177.0 50.3 178.1 52.9 179.1 55.5 180.0 58.1 180.8 60.7 181.6 63.4 182.2 66.1 182.8 68.8 183.3 71.5 183.6 74.3 183.9 77.0 184.1 79.8 184.2 82.6 184.2 85.3 184.2 88.1 184.0 90.9 183.7 93.6 183.3 96.4 182.9 99.1 182.3 101.9 181.7 104.6 180.9 107.3 180.1 109.9 179.1 112.5 178.1 115.1 177.0 117.7 175.8 120.2 174.5 122.7 173.1 125.1 171.6 127.5 170.0 129.8 168.4 132.1 166.6 134.3 164.8 136.5 162.9 138.6 161.0 140.7 159.0 142.8 157.0 145.0 155.0 147.1 153.0 149.3 151.0 151.5 148.9 153.8 146.7 156.0 144.5 158.2 142.2 160.4 139.8 162.5 137.3 164.6 134.7 166.7 132.0 168.7 129.3 170.6 126.4 172.5 123.4 174.2 120.3 175.9 117.2 177.4 113.9 178.8 110.5 180.0 107.1 181.1 103.6 182.0 100.0 182.7 96.3 183.2 92.6 183.6 88.9 183.7 85.1 183.6 81.3 183.2 77.6 182.7 73.9 181.9 70.2 180.8 66.5 179.5 63.0 L 154.5 73.1 155.5 75.8 156.2 78.5 156.8 81.3 157.1 84.1 157.3 87.0 157.3 89.8 157.1 92.7 156.8 95.5 156.2 98.2 155.6 101.0 154.7 103.7 153.8 106.3 152.7 108.8 151.5 111.3 150.3 113.7 148.9 116.0 147.5 118.3 146.0 120.4 144.4 122.5 142.8 124.5 141.2 126.4 139.6 128.3 137.9 130.0 136.3 131.7 134.6 133.4 133.0 135.0 131.4 136.6 129.8 138.1 128.2 139.6 126.7 141.1 125.2 142.6 123.8 144.2 122.3 145.7 121.0 147.3 119.5 148.8 118.0 150.3 116.5 151.8 114.9 153.2 113.2 154.5 111.5 155.8 109.8 157.1 108.0 158.2 106.2 159.4 104.3 160.4 102.4 161.4 100.4 162.3 98.5 163.2 96.4 164.0 94.4 164.7 92.3 165.4 90.2 165.9 88.1 166.5 85.9 166.9 83.8 167.2 81.6 167.5 79.4 167.7 77.2 167.9 75.0 167.9 72.8 167.9 70.6 167.8 68.4 167.6 66.2 167.3 64.0 167.0 61.8 166.6 59.6 166.1 57.4 165.5 55.3 164.8 53.2 164.1 51.1 163.3 49.0 162.4 47.0 161.4 45.0 160.4 43.0 159.3 41.1 158.1 39.2 156.8 37.4 155.5 35.6 154.1 33.8 152.7 32.1 151.2 30.5 149.6 28.9 147.9 27.4 146.2 26.0 144.5 24.6 142.7 23.3 140.8 22.0 138.9 20.8 137.0 19.7 135.0 Z"
        fill="url(#itkRib)"
      />
      <path d="M 194.8 39.3 L 193.4 99.0 L 135.1 42.8 Z" fill="url(#itkRib)" />

      <circle cx="78" cy="104" r="52" fill="url(#itkSphere)" />
      <g clipPath="url(#itkClip)">
        <path
          d="M 116.9 137.9 L 104.1 143.4 L 87.6 153.3 L 90.3 154.0 L 108.4 144.5 Z"
          fill="#16233A"
          fillOpacity="0.38"
        />
        <path
          d="M 124.5 106.7 L 127.1 119.6 L 128.8 107.8 L 127.1 87.7 L 124.5 87.0 Z"
          fill="#16233A"
          fillOpacity="0.41"
        />
        <path
          d="M 39.1 133.9 L 51.9 148.2 L 68.4 150.4 L 65.7 137.5 L 47.6 127.3 Z"
          fill="#16233A"
          fillOpacity="0.73"
        />
        <path
          d="M 82.2 56.3 L 80.6 68.0 L 98.7 78.2 L 111.6 72.8 L 101.4 59.2 Z"
          fill="#16233A"
          fillOpacity="0.78"
        />
        <path
          d="M 62.4 77.6 L 45.9 75.3 L 35.7 93.6 L 45.9 107.2 L 62.4 97.3 Z"
          fill="#16233A"
          fillOpacity="0.98"
        />
        <path
          d="M 101.4 130.5 L 111.6 112.2 L 98.7 97.9 L 80.6 107.5 L 82.2 127.6 Z"
          fill="#16233A"
          fillOpacity="1.00"
        />
      </g>
      <ellipse
        cx="58"
        cy="80"
        rx="24"
        ry="16"
        fill="url(#itkSpec)"
        transform="rotate(-26 58 80)"
      />
      <circle cx="78" cy="104" r="52" fill="url(#itkTerm)" />
      <circle
        cx="78"
        cy="104"
        r="52"
        fill="none"
        stroke="#0B1220"
        strokeOpacity="0.55"
        strokeWidth="2"
      />

      <path
        d="M 27.7 164.0 28.6 164.9 29.6 165.7 30.7 166.5 31.7 167.3 32.7 168.1 33.8 168.9 34.9 169.6 35.9 170.4 37.0 171.1 38.1 171.8 39.3 172.5 40.4 173.2 41.5 173.8 42.7 174.4 43.8 175.1 45.0 175.7 46.2 176.2 47.4 176.8 48.6 177.3 49.8 177.9 51.0 178.4 52.2 178.8 53.5 179.3 54.7 179.7 56.0 180.2 57.2 180.6 58.5 181.0 59.8 181.3 61.0 181.7 62.3 182.0 63.6 182.3 64.9 182.6 66.2 182.8 67.5 183.1 68.8 183.3 70.2 183.5 71.5 183.6 72.8 183.8 74.1 183.9 75.5 184.0 76.8 184.1 78.1 184.2 79.5 184.2 80.8 184.2 82.1 184.2 83.5 184.2 84.8 184.2 86.2 184.1 87.5 184.0 88.8 183.9 90.2 183.8 91.5 183.6 92.9 183.4 94.2 183.3 95.5 183.0 96.8 182.8 98.2 182.5 99.5 182.2 100.8 181.9 102.1 181.6 103.4 181.2 104.7 180.9 106.0 180.5 107.3 180.0 108.6 179.6 109.9 179.1 111.2 178.6 112.4 178.1 113.7 177.6 114.9 177.1 116.2 176.5 117.4 175.9 118.6 175.3 119.8 174.7 121.0 174.0 122.2 173.3 123.4 172.6 124.6 171.9 125.8 171.2 126.9 170.4 128.0 169.6 129.2 168.8 130.3 168.0 131.4 167.2 132.5 166.3 133.5 165.5 134.6 164.6 135.6 163.7 L 120.4 147.9 119.7 148.7 119.0 149.4 118.3 150.1 117.5 150.8 116.8 151.5 116.0 152.2 115.3 152.9 114.5 153.5 113.7 154.2 112.9 154.8 112.1 155.5 111.2 156.1 110.4 156.7 109.5 157.2 108.7 157.8 107.8 158.4 106.9 158.9 106.0 159.4 105.1 160.0 104.2 160.5 103.3 161.0 102.4 161.4 101.4 161.9 100.5 162.3 99.5 162.7 98.6 163.1 97.6 163.5 96.6 163.9 95.6 164.3 94.7 164.6 93.7 165.0 92.7 165.3 91.6 165.6 90.6 165.8 89.6 166.1 88.6 166.3 87.6 166.6 86.5 166.8 85.5 167.0 84.4 167.1 83.4 167.3 82.3 167.4 81.3 167.6 80.2 167.7 79.2 167.7 78.1 167.8 77.0 167.9 76.0 167.9 74.9 167.9 73.8 167.9 72.8 167.9 71.7 167.8 70.6 167.8 69.6 167.7 68.5 167.6 67.4 167.5 66.4 167.4 65.3 167.2 64.2 167.0 63.2 166.8 62.1 166.6 61.1 166.4 60.0 166.2 59.0 165.9 57.9 165.6 56.9 165.3 55.9 165.0 54.8 164.7 53.8 164.3 52.8 163.9 51.8 163.6 50.8 163.1 49.8 162.7 48.8 162.3 47.8 161.8 46.8 161.3 45.8 160.8 44.9 160.3 43.9 159.8 43.0 159.3 42.0 158.7 41.1 158.1 40.2 157.5 39.3 156.9 38.4 156.3 37.5 155.6 36.6 155.0 35.8 154.3 Z"
        fill="url(#itkRib)"
      />
    </svg>
  );
}

/**
 * `size` is the cap size of "itk"; the rest is proportional.
 *
 * `translate="no"` is not decoration — Chrome's page translation was rendering
 * the brand as "itk 더하기".
 */
export function Logo({ size = 82 }: { size?: number }) {
  return (
    <span
      translate="no"
      className="notranslate flex select-none items-center"
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

        {/* The plus lives inside the bowl of the p rather than standing beside
            the word. */}
        <span
          className="relative inline-block"
          style={{
            marginTop: "-0.12em",
            fontSize: "0.83em",
            letterSpacing: "-0.024em",
            background:
              "linear-gradient(180deg, #FF6B00 0%, #FF3E00 50%, #D93000 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0.02em 0.04em 0.04em rgba(0,0,0,0.45))",
          }}
        >
          plus
          <span
            aria-hidden
            className="absolute"
            style={{
              left: "0.142em",
              top: "0.39em",
              width: "0.24em",
              height: "0.24em",
            }}
          >
            <span
              className="absolute bg-white"
              style={{
                left: 0,
                top: "0.081em",
                width: "0.24em",
                height: "0.078em",
                borderRadius: "0.026em",
              }}
            />
            <span
              className="absolute bg-white"
              style={{
                top: 0,
                left: "0.081em",
                height: "0.24em",
                width: "0.078em",
                borderRadius: "0.026em",
              }}
            />
          </span>
        </span>
      </span>
    </span>
  );
}
