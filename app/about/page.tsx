import { permanentRedirect } from "next/navigation";

/**
 * Where the introduction used to live.
 *
 * It is the home page now. This stays behind as a permanent redirect so links
 * that were shared, bookmarked or indexed while it was at /about still land in
 * the right place rather than on a 404.
 */
export default function AboutMoved(): never {
  permanentRedirect("/");
}
