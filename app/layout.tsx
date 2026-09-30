import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Seen } from "@/components/Seen";
import { Heartbeat } from "@/components/Heartbeat";

/*
 * Pretendard, as 요즘IT and most Korean product sites set it: drawn for Hangul
 * first, with Latin and numerals that sit level with it, so a headline mixing
 * "첼시" and "Palmer 7.4" reads as one line. Loaded from the dynamic-subset
 * build, which splits the face by the syllables a page actually uses - the
 * same reason the Plex cut before it had preloading switched off.
 */
const PRETENDARD =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export const viewport: Viewport = {
  themeColor: "#08090c",
  colorScheme: "dark",
};

export const metadata: Metadata = {
  title: "ITK+ 축구 이적 소식",
  description:
    "기자 신뢰도 티어로 거른 해외 축구 이적 소식. 누가 떴는지 보고 판단하세요.",
  applicationName: "ITK+",
  // Makes the share images' URLs absolute; a relative og:image is ignored by
  // every app that previews links.
  metadataBase: new URL("https://itkplus.vercel.app"),
  openGraph: {
    title: "ITK+ 축구 이적 소식",
    description: "기자 신뢰도 티어로 거른 해외 축구 이적 소식.",
    type: "website",
    siteName: "ITK+",
    locale: "ko_KR",
  },
  twitter: { card: "summary_large_image" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="stylesheet" href={PRETENDARD} crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <Seen />
        <Heartbeat />
        {children}
      </body>
    </html>
  );
}
