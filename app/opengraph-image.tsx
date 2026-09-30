import { OG_SIZE, siteImage } from "@/lib/og";

export const alt = "ITK+ 축구 이적 소식";
export const size = OG_SIZE;
export const contentType = "image/png";

/** The site's link preview; every page without its own uses this one. */
export default function Image() {
  return siteImage("해외 축구 이적 소식,\n기자 티어로 거른다", "누가 먼저 보도했는지, 얼마나 믿을 만한지");
}
