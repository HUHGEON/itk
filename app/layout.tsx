import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_KR } from "next/font/google";
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
  // 700 is back for one thing only: the byline. "매체보다 저자가 중요" is the
  // premise, so the reporter's name is the heaviest text on the row.
  weight: ["400", "500", "600", "700"],
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
      <body className={`${sans.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
