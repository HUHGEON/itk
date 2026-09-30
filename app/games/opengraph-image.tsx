import { OG_SIZE, siteImage } from "@/lib/og";

export const alt = "ITK+ 미니게임";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return siteImage("ITK+ 미니게임", "Possession Play · The Heatmap · Career Path · Who Are Ya?");
}
