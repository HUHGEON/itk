import { OG_SIZE, siteImage } from "@/lib/og";

export const alt = "ITK+ 미니게임";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return siteImage("Football Quiz", "축구 게임 4종 · 매일 새 문제");
}
