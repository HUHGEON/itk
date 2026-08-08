import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR, Montserrat, Oswald } from "next/font/google";
import "./globals.css";

/*
 * Geist is Vercel's house face and reads as "a Next.js app" before it reads as
 * anything else. Plex has a drawn, editorial quality that suits a news wire,
 * and the KR cut means Korean headlines and English ones share one skeleton
 * instead of falling back to whatever the OS supplies.
 */
const sans = IBM_Plex_Sans_KR({
  variable: "--font-plex-kr",
  subsets: ["latin"],
  // 700 was used six times and 600 reads as bold enough at these sizes. Each
  // weight is ~100 subset files for Korean, so dropping one is real bytes.
  weight: ["400", "500", "600"],
  // The Korean cut is split into ~130 unicode-range subsets, and next/font
  // emits a <link rel="preload"> for every one — 134 eager font fetches on a
  // page that shows a couple of dozen distinct syllables. Off, the browser
  // pulls only the ranges it actually paints.
  preload: false,
  display: "swap",
});

/*
 * Logo only. Loaded through next/font so they are self-hosted at build time —
 * the supplied CSS pulled them from fonts.googleapis.com on every page view,
 * which is a render-blocking request to a third party for eight glyphs.
 */
const wordmark = Montserrat({
  variable: "--font-wordmark",
  subsets: ["latin"],
  weight: ["900"],
  style: ["italic"],
  display: "swap",
});

const strapline = Oswald({
  variable: "--font-strapline",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#08090c",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "ITK+ — 축구 이적 소식",
  description:
    "기자 신뢰도 티어로 거른 해외 축구 이적 소식. 누가 떴는지 보고 판단하세요.",
  applicationName: "ITK+",
  openGraph: {
    title: "ITK+ — 축구 이적 소식",
    description: "기자 신뢰도 티어로 거른 해외 축구 이적 소식.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body
        className={`${sans.variable} ${wordmark.variable} ${strapline.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
