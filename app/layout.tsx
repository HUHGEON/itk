import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
import "./globals.css";
import { Seen } from "@/components/Seen";

/*
 * Geist is Vercel's house face and reads as "a Next.js app" before it reads as
 * anything else. Plex has a drawn, editorial quality that suits a news wire,
 * and the KR cut means Korean headlines and English ones share one skeleton
 * instead of falling back to whatever the OS supplies.
 */
const sans = IBM_Plex_Sans_KR({
  variable: "--font-plex-kr",
  subsets: ["latin"],
  /*
   * Three weights, not four.
   *
   * The Korean cut is split into 94 unicode-range subsets per weight, and every
   * one of them is a @font-face rule in the render-blocking stylesheet.
   * Measured on production at four weights: 377 rules, 187kB of CSS that the
   * browser must parse before it paints anything, and 55 woff2 files totalling
   * 424kB once it starts painting Korean.
   *
   * 500 was the weight to lose. It sat between regular and semibold on labels,
   * column headings and chips - places where weight is doing almost no work at
   * 11 to 13 pixels - while 700 carries scores, ratings and bylines, where it
   * is doing all of it. Those uses moved up to 600 rather than down to 400, so
   * everything that asked for emphasis still has it.
   */
  weight: ["400", "600", "700"],
  // The Korean cut is split into ~130 unicode-range subsets, and next/font
  // emits a <link rel="preload"> for every one — 134 eager font fetches on a
  // page that shows a couple of dozen distinct syllables. Off, the browser
  // pulls only the ranges it actually paints.
  preload: false,
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#08090c",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "ITK+ 축구 이적 소식",
  description:
    "기자 신뢰도 티어로 거른 해외 축구 이적 소식. 누가 떴는지 보고 판단하세요.",
  applicationName: "ITK+",
  openGraph: {
    title: "ITK+ 축구 이적 소식",
    description: "기자 신뢰도 티어로 거른 해외 축구 이적 소식.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${sans.variable} antialiased`}>
        <Seen />
        {children}
      </body>
    </html>
  );
}
